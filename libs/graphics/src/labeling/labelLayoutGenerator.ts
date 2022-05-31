import { GraphicsLibrary } from "..";
import {getRandomInt} from "../utils";
import { ChromatinViewport } from "../viewports";
import { computeContours, computeDistanceTransform, computeMaxDistanceCPU } from "./labelingAlgorithms";
import { Label } from "./label";
import { Selection } from "../../storage/models/selections";


const DOWNSCALED_TEX_SIZE = 512;
// const DOWNSCALED_TEX_SIZE = 1024;

export class LabelLayoutGenerator {

    private _viewport: ChromatinViewport | null = null;
    private graphicsLibrary: GraphicsLibrary | null = null;

    //~ private textures
    private contoursTexture: GPUTexture | null = null;
    private distanceTransformTexture: GPUTexture | null = null;
    private pingTexture: GPUTexture | null = null;
    private pongTexture: GPUTexture | null = null;
    private smallIDTexture: GPUTexture | null = null;

    //~ internal state
    private labelingEnabled = true;
    private lastFrameLabels: Label[] = [];
    private _selections: Selection[] = [];

    //#region Constructor
    constructor(viewport: ChromatinViewport, graphicsLib: GraphicsLibrary) {
        this._viewport = viewport;
        this.graphicsLibrary = graphicsLib;

        if (viewport.width == 0 || viewport.height == 0) {
            this.resizeTextures(123, 123); //~ just making sure I don't have a texture with size 0x0 but I can still tell there's a problem
        } else {
            this.resizeTextures(viewport.width, viewport.height);
        }

        this.createFixedSizeTextures();
    }
    //#endregion

    //#region Main entry point
    public async getLabelPositions(): Promise<Label[]> {
        if (!this.graphicsLibrary || !this.viewport) return [];

        if (!this.labelingEnabled) {
            return [];
        }

        //~ get together two global objects used throughout the algorithms
        const globals = {
            graphicsLibrary: this.graphicsLibrary,
            viewport: this.viewport,
        }

        //~ get ID buffer (main input for labeling)
        const idBuffer = this.viewport.getIDBuffer();
        if (!this.contoursTexture || !this.distanceTransformTexture || !idBuffer) {
            return [];
        }

        //~ Step 1: contours seed initialization
        computeContours(globals, idBuffer, this.contoursTexture);
        //~ just an experiment:
        if (!this.graphicsLibrary || !this.smallIDTexture) return [];
        this.graphicsLibrary.blit(idBuffer, this.smallIDTexture);

        //~ Step 2: distance transform using jump flooding
        if (!this.pingTexture || !this.pongTexture) return [];
        computeDistanceTransform(globals, this.pingTexture, this.pongTexture, this.contoursTexture, this.distanceTransformTexture);

        //~ Step 3: get label positions by computing max distance from contour
        // const labels = await this.computeMaxDistance();
        const globalsWithSelections = {
            ...globals,
            selections: this.selections,
        }
        const labelsCPU = await computeMaxDistanceCPU(globalsWithSelections, this.distanceTransformTexture, this.smallIDTexture);
        //~ debug output
        // console.log("labels = ");
        // console.log(labelsCPU);
        console.log("Labels were recomputed.");

        // return this.debug_getRandomLabelPositions();
        // return labels;
        return labelsCPU;
    }
    //#endregion


    private createFixedSizeTextures(): void {
        if (!this.graphicsLibrary) {
            return;
        }

        const size = {
            width: DOWNSCALED_TEX_SIZE,
            height: DOWNSCALED_TEX_SIZE,
        }
        const usageFlags = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING;
        const format = 'rgba32float';

        this.pingTexture = this.graphicsLibrary.device.createTexture({ label: "DT: Ping (Labeling)", size, format: format, usage: usageFlags});
        this.pongTexture = this.graphicsLibrary.device.createTexture({ label: "DT: Pong (Labeling)", size, format: format, usage: usageFlags});
        //~ TODO: this probably shouldn't be downscaled...
        this.distanceTransformTexture = this.graphicsLibrary.device.createTexture({ label: "DT: Final (Labeling)", size, format: format, usage: usageFlags | GPUTextureUsage.COPY_SRC});
        //~ just an experiment: I wanted to make a "ground truth" CPU implementation of max dist but from that I need both DT texture and ID textures as array
        this.smallIDTexture = this.graphicsLibrary.device.createTexture({ label: "Downscaled ID Texture (Labeling)", size, format: format, usage: usageFlags | GPUTextureUsage.COPY_SRC});
    }

    public resizeTextures(width: number, height: number): void {
        if (width <= 0 || height <= 0) return;

        const size = {
            width: width,
            height: height,
        };

        if (!this.graphicsLibrary) {
            console.log("error: graphicsLibrary is null")
            return;
        }

        this.contoursTexture = this.graphicsLibrary.device.createTexture({
            label: "Contours pass texture (Labeling)",
            size,
            format: 'rgba32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
    }

    //#region Getters / Setters
    public set viewport(vp: ChromatinViewport | null) {
        this._viewport = vp;

        if ((vp) && ((vp.width != 0) || (vp.height != 0))) {
            this.resizeTextures(vp.width, vp.height);
        }
    }

    public get viewport() : ChromatinViewport | null {
        return this._viewport;
    }

    public getContoursTexture(): GPUTexture | null {
        return this.contoursTexture;
    }

    public getDTTexture(): GPUTexture | null {
        return this.distanceTransformTexture;
    }

    public enableLabeling(): void {
        this.labelingEnabled = true;
    }

    public disableLabeling(): void {
        this.labelingEnabled = false;
    }

    // public set selections(s: string[]) {
    public set selections(s: Selection[]) {
        this._selections = s;
    }

    public get selections(): Selection[] {
        return this._selections;
    }
    //#endregion

    //#region Helper methods
    private debug_getRandomLabelPositions(force = false): Label[] {
        let retLabels = this.lastFrameLabels;

        if (this.lastFrameLabels.length == 0 || force) {
            const black = {r: 0, g: 0, b: 0, a: 0};
            retLabels = Array.from({ length: 100 }, (_, index) => ({ id: index, x: getRandomInt(800), y: getRandomInt(600), text: "Label " + index, color: black}));
            this.lastFrameLabels = retLabels;
        }

        return retLabels;
    }
    //#endregion

}