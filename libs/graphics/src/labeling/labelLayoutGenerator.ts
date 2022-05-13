import { GraphicsLibrary } from "..";
import {getRandomInt} from "../utils";
import { ChromatinViewport } from "../viewports";

export type Label = {
    x: number;
    y: number;
    id: number;
    text: string;
};

export class LabelLayoutGenerator {

    private _viewport: ChromatinViewport | null = null;
    private graphicsLibrary: GraphicsLibrary | null = null;

    //~ private textures
    private contoursTexture: GPUTexture | null = null;

    //~ internal state
    private lastFrameLabels: Label[] = [];

    constructor(viewport: ChromatinViewport, graphicsLib: GraphicsLibrary) {
        console.log("<LabelLayoutGenerator constructor!>");
        this._viewport = viewport;
        this.graphicsLibrary = graphicsLib;

        if (viewport.width == 0 || viewport.height == 0) {
            this.resizeTextures(123, 123); //~ just making sure I don't have a texture with size 0x0 but I can still tell there's a problem
        } else {
            this.resizeTextures(viewport.width, viewport.height);
        }

        if (!this.graphicsLibrary) return;


        console.log("</LabelLayoutGenerator constructor!>");
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

        // console.log("resizing...");
        // console.log("viewport size = " + width + " x " + height);

        this.contoursTexture = this.graphicsLibrary.device.createTexture({
            label: "Contours pass texture (Labeling)",
            size,
            format: 'rgba32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
    }

    public set viewport(vp: ChromatinViewport | null) {
        const oldWidth = this._viewport?.width;
        const oldHeight = this._viewport?.height;
        this._viewport = vp;

        console.log("labelLayoutGenerator::          setting viewport...");
        if ((vp) && ((vp.width != 0) || (vp.height != 0))) {
            this.resizeTextures(vp.width, vp.height);
        }
    }

    public get viewport() : ChromatinViewport | null {
        return this._viewport;
    }

    // #region High-level labeling workflow

    public computeContours() : void {
        console.log("computeContours STARTING.");
        if (!this.viewport || !this.viewport.camera || !this.graphicsLibrary) {
            return;
        }

        const idBuffer = this.viewport.getIDBuffer();
        if (!idBuffer || !this.contoursTexture) { 
            return; 
        }

        this.debug_clearContoursTexture(); //~ just for testing whether the blitting pipeline works fine. it does.

        const device = this.graphicsLibrary.device;

        const commandEncoder = device.createCommandEncoder();
        const computePassEncoder = commandEncoder.beginComputePass();

        const cameraBindGroup = device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.camera,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.viewport.camera.bufferGPU,
                        offset: 0,
                    }
                },
            ]
        });

        this.renderContoursPass({
            width: this.viewport.width,
            height: this.viewport.height,
            cameraBindGroup: cameraBindGroup,
            cameraBGLayout: this.graphicsLibrary.bindGroupLayouts.camera,
            contoursBindGroup: device.createBindGroup({
                layout: this.graphicsLibrary.bindGroupLayouts.contours,
                entries: [
                    { binding: 0, resource: idBuffer.createView() },
                    { binding: 1, resource: this.contoursTexture.createView() },
                ]
            }),
            passEncoder: computePassEncoder,
        });

        computePassEncoder.end();
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        console.log("computeContours SUCCEEDED!");
    }

    public computeVoronoi(): void {
        const a = "test";
    }

    public getLabelPositions(): Label[] {
        this.computeContours();
        return this.debug_getRandomLabelPositions();
    }

    // #endregion

    // #region Low-level implementation and helper functions
    public renderContoursPass(parameters: {
        width: number,
        height: number,
        cameraBindGroup: GPUBindGroup,
        cameraBGLayout: GPUBindGroupLayout,
        contoursBindGroup: GPUBindGroup,
        passEncoder: GPUComputePassEncoder,
    }): void {
        if (!this.graphicsLibrary) return;

        parameters.passEncoder.setPipeline(this.graphicsLibrary.computePipelines.contours);
        parameters.passEncoder.setBindGroup(0, parameters.cameraBindGroup);
        parameters.passEncoder.setBindGroup(1, parameters.contoursBindGroup);

        parameters.passEncoder.dispatchWorkgroups(
            Math.ceil((parameters.width + 7) / 8),
            Math.ceil((parameters.height + 7) / 8),
            1);
    }

    private debug_clearContoursTexture() {
        if (!this.graphicsLibrary) {
            return;
        }

        const device = this.graphicsLibrary.device;

        const commandEncoder = device.createCommandEncoder();

        // // const textureToShow = this._mainViewport.getIDBuffer();
        // const textureToShow = this._labelingGenerator.debug_getContoursTexture();
        // if (!textureToShow) {
        //     return;
        // }
        if (!this.contoursTexture) {
            return;
        }
        const textureView = this.contoursTexture.createView();

        const backgroundColor: GPUColorDict = { r: 1.0, g: 0.0, b: 0.0, a: 1.0};
        const passthroughPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: backgroundColor,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });
        // passthroughPassEncoder.setPipeline(this.graphicsLibrary.renderPipelines.textureBlit);
        // passthroughPassEncoder.setBindGroup(0, device.createBindGroup({
        //     layout: this.graphicsLibrary.bindGroupLayouts.singleTexture,
        //     entries: [
        //         {
        //             binding: 0,
        //             resource: textureToShow.createView(),
        //         },
        //     ]
        // }));
        // // passthroughPassEncoder.draw(3, 1, 0, 0);
        passthroughPassEncoder.end();

        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

    }


    public debug_getRandomLabelPositions(force = false): Label[] {
        let retLabels = this.lastFrameLabels;

        if (this.lastFrameLabels.length == 0 || force) {
            retLabels = Array.from({ length: 100 }, (_, index) => ({ id: index, x: getRandomInt(800), y: getRandomInt(600), text: "Label " + index }));
            this.lastFrameLabels = retLabels;
        }

        return retLabels;
    }

    public debug_getContoursTexture(): GPUTexture | null {
        return this.contoursTexture;
    }

    // #endregion

}