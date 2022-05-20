import { GraphicsLibrary } from "..";
import {getRandomInt} from "../utils";
import { ChromatinViewport } from "../viewports";
import { computeContours, computeDistanceTransform, computeMaxDistanceCPU } from "./labelingAlgorithms";
import { Label } from "./label";


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

        this.createFixedSizeTextures();

        console.log("</LabelLayoutGenerator constructor!>");
    }

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
        // const oldWidth = this._viewport?.width;
        // const oldHeight = this._viewport?.height;
        this._viewport = vp;

        console.log("labelLayoutGenerator::          setting viewport...");
        if ((vp) && ((vp.width != 0) || (vp.height != 0))) {
            this.resizeTextures(vp.width, vp.height);
        }
    }

    public get viewport() : ChromatinViewport | null {
        return this._viewport;
    }

    public async getLabelPositions(): Promise<Label[]> {
        if (!this.graphicsLibrary || !this.viewport) return [];

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
        const labelsCPU = await computeMaxDistanceCPU(globals, this.distanceTransformTexture, this.smallIDTexture);

        // return this.debug_getRandomLabelPositions();
        // return labels;
        return labelsCPU;
    }

    private async computeMaxDistance(): Promise<Label[]> {
        if (!this.graphicsLibrary) return []; 

        const device = this.graphicsLibrary.device;
        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        if (!this.viewport) return [];
        const idBuffer = this.viewport.getIDBuffer();
        if (!idBuffer) return [];

        if (!this.distanceTransformTexture) return [];
        const inputTexturesBindGroup = device.createBindGroup({
            label: "Max DT: input textures bind group",
            layout: this.graphicsLibrary.bindGroupLayouts.maxDTInputTextures,
            entries: [
                // { binding: 0, resource: inputTex.createView() },
                // { binding: 1, resource: outputTex.createView() },
                { binding: 0, resource: idBuffer.createView() },
                { binding: 1, resource: this.distanceTransformTexture.createView() },
            ]
        })

        if (!this.viewport || !this.viewport.camera) return [];
        const cameraBindGroup = device.createBindGroup({
            label: "Camera bind group",
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

        //~ generating initial buffer:
        const MAX_LABELS = 256;
        const BUFFER_SIZE = MAX_LABELS * 4 * 4;
        const labelCandidates = new Float32Array(new ArrayBuffer(BUFFER_SIZE));
        for (let i = 0; i < MAX_LABELS; i++) {
            labelCandidates[i * 4 + 0] = -1; // regionId (i32)
            // labelCandidates[i * 4 + 1] = 1.0; // dtValue (f32)
            labelCandidates[i * 4 + 1] = 0.0; // dtValue (f32)
            labelCandidates[i * 4 + 2] = 0; // uvPosition.x (vec2<f32>)
            labelCandidates[i * 4 + 3] = 0; // uvPosition.y (vec2<f32>)
        }

        const labelsBufferGPU = device.createBuffer({
            size: BUFFER_SIZE,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
          });
          
          const stagingBuffer = device.createBuffer({
            size: BUFFER_SIZE,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
          });
          
          const candidatesBufferBindGroup = device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.maxDTCandidatesBuffer,
            entries: [{
              binding: 0,
              resource: {
                buffer: labelsBufferGPU,
              },
            }],
          });

        device.queue.writeBuffer(labelsBufferGPU, 0, labelCandidates);

        passEncoder.setPipeline(this.graphicsLibrary.computePipelines.maxDT);
        passEncoder.setBindGroup(0, cameraBindGroup);
        passEncoder.setBindGroup(1, inputTexturesBindGroup);
        passEncoder.setBindGroup(2, candidatesBufferBindGroup);

        // console.log("DT: dispatching workgroups!");
        passEncoder.dispatchWorkgroups(
            DOWNSCALED_TEX_SIZE / 8,
            DOWNSCALED_TEX_SIZE / 8,
            1);

        passEncoder.end();
        commandEncoder.copyBufferToBuffer(labelsBufferGPU, 0, stagingBuffer, 0, BUFFER_SIZE);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        //~ reading back the buffer
        await stagingBuffer.mapAsync(GPUMapMode.READ, 0, BUFFER_SIZE);
        const copyArrayBuffer = stagingBuffer.getMappedRange(0, BUFFER_SIZE);
        const data = copyArrayBuffer.slice(0);
        stagingBuffer.unmap();
        // console.log(new Float32Array(data));
        const dataArray = new Float32Array(data);
        // console.log(dataArray);

        // labelCandidates[i * 4 + 0] = -1; // regionId (i32)
        // labelCandidates[i * 4 + 1] = 0; // dtValue (f32)
        // labelCandidates[i * 4 + 2] = 0; // uvPosition.x (vec2<f32>)
        // labelCandidates[i * 4 + 3] = 0; // uvPosition.y (vec2<f32>)

        const labels: Label[] = [];
        for (let i = 0; i < MAX_LABELS; i++) {
            // console.log(i);
            const regionId = dataArray[i * 4 + 0] as number;
            const dtValue = dataArray[i * 4 + 1] as number;
            const x = dataArray[i * 4 + 2] as number;
            const y = dataArray[i * 4 + 3] as number;
            //~ TODO: recalculate to screen/pixel coordinates
            const xScreen = x * (this.viewport.width / 2.0);
            const yScreen = y * (this.viewport.height / 2.0);
            const lbl = {
                x: xScreen,
                y: yScreen,
                id: regionId,
                text: "Label test",
            };
            // console.log(lbl);

            if (lbl.id == -1) {
                // break;
            } else {
                labels.push(lbl);
                console.log("regionId: %d, uvPosition: (%f, %f), dtValue: %f", regionId, x, y, dtValue);
            }
        }
        console.log("Labels:");
        // console.log(labels);

        return labels;
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

    public debug_getDTTexture(): GPUTexture | null {
        return this.distanceTransformTexture;
    }


}