import { Label } from "@fluentui/react";
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
    private distanceTransformTexture: GPUTexture | null = null;
    private pingTexture: GPUTexture | null = null;
    private pongTexture: GPUTexture | null = null;

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
            width: 512,
            height: 512,
        }

        const usageFlags = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING;
        const format = 'rgba32float';
        this.pingTexture = this.graphicsLibrary.device.createTexture({ label: "DT: Ping (Labeling)", size, format: format, usage: usageFlags});
        this.pongTexture = this.graphicsLibrary.device.createTexture({ label: "DT: Pong (Labeling)", size, format: format, usage: usageFlags});
        //~ TODO: this probably shouldn't be downscaled...
        this.distanceTransformTexture = this.graphicsLibrary.device.createTexture({ label: "DT: Final (Labeling)", size, format: format, usage: usageFlags});
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

    public computeContours(inputIDTexture: GPUTexture, outputContoursTexture: GPUTexture) : void {
        // console.log("computeContours STARTING.");
        if (!this.viewport || !this.viewport.camera || !this.graphicsLibrary) {
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
                    { binding: 0, resource: inputIDTexture.createView() },
                    { binding: 1, resource: outputContoursTexture.createView() },
                ]
            }),
            passEncoder: computePassEncoder,
        });

        computePassEncoder.end();
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // console.log("computeContours SUCCEEDED!");
    }

    public computeDistanceTransform(contoursSeedTex: GPUTexture, distanceTransfromTex: GPUTexture): void {
        if (!this.graphicsLibrary || !this.pingTexture || !this.pongTexture) return;

        //~ copy contours seed to ping texture
        this.graphicsLibrary.blit(contoursSeedTex, this.pingTexture);

        //~ Compute DT steps
        this.computeDTStep(this.pingTexture, this.pongTexture, 512.0 / 2.0);
        this.computeDTStep(this.pongTexture, this.pingTexture, 512.0 / 4.0);
        this.computeDTStep(this.pingTexture, this.pongTexture, 512.0 / 8.0);
        this.computeDTStep(this.pongTexture, this.pingTexture, 512.0 / 16.0);
        this.computeDTStep(this.pingTexture, this.pongTexture, 512.0 / 32.0);
        this.computeDTStep(this.pongTexture, this.pingTexture, 512.0 / 64.0);
        this.computeDTStep(this.pingTexture, this.pongTexture, 512.0 / 128.0);
        this.computeDTStep(this.pongTexture, this.pingTexture, 512.0 / 256.0);
        this.computeDTStep(this.pingTexture, this.pongTexture, 512.0 / 512.0);

        //~ copy result to final distance transform texture
        this.graphicsLibrary.blit(this.pongTexture, distanceTransfromTex);
    }

    public async getLabelPositions(): Promise<Label[]> {
        if (!this.contoursTexture || !this.distanceTransformTexture) {
            return [];
        }

        //~ contours
        if (!this.viewport) return [];
        const idBuffer = this.viewport.getIDBuffer();
        if (!idBuffer) { 
            return []; 
        }
        this.computeContours(idBuffer, this.contoursTexture);

        //~ distance transform
        if (!this.contoursTexture || !this.distanceTransformTexture) return [];
        this.computeDistanceTransform(this.contoursTexture, this.distanceTransformTexture);

        //~ max distance
        // this.computeMaxDistance();
        const labels = await this.computeMaxDistance();
        // let labels = await this.computeMaxDistance();

        //~ TODO: for now just returning a bunch of random labels
        // return this.debug_getRandomLabelPositions();
        return labels;
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

    public computeDTStep(inputTex: GPUTexture, outputTex: GPUTexture, stepSize: number): void {
        //~ todo
        if (!this.graphicsLibrary) return; 

        const device = this.graphicsLibrary.device;

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        const contoursBindGroup = device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.contours,
            entries: [
                { binding: 0, resource: inputTex.createView() },
                { binding: 1, resource: outputTex.createView() },
                // { binding: 0, resource: idBuffer.createView() },
                // { binding: 1, resource: this.contoursTexture.createView() },
            ]
        })

        if (!this.viewport || !this.viewport.camera) return;
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

        // console.log("stepSize = " + stepSize);
        const stepParams = {
            stepSize: stepSize, //~ do I need to somehow convert so that it's compatible with f32 in wgsl?
            widthScale: this.viewport.width / 512.0,
            heightScale: this.viewport.height / 512.0,
        };
        
          const stepParamBufferSize = 3 * Float32Array.BYTES_PER_ELEMENT;
          const stepParamBuffer = device.createBuffer({
            size: stepParamBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          });

        device.queue.writeBuffer(
            stepParamBuffer,
            0,
            new Float32Array([
                stepParams.stepSize,
                stepParams.widthScale,
                stepParams.heightScale,
            ])
        );

        const dtParamsBindGroup = device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.distanceTransformStepParams,
            entries: [
                { binding: 0, resource: {
                    buffer: stepParamBuffer
                } },
            ]
        });

        // passEncoder.setPipeline(this.graphicsLibrary.computePipelines.contours);
        passEncoder.setPipeline(this.graphicsLibrary.computePipelines.distanceTransform);
        passEncoder.setBindGroup(0, cameraBindGroup);
        passEncoder.setBindGroup(1, contoursBindGroup);
        passEncoder.setBindGroup(2, dtParamsBindGroup);

        // console.log("DT: dispatching workgroups!");
        passEncoder.dispatchWorkgroups(
            512 / 8,
            512 / 8,
            1);
        // passEncoder.dispatchWorkgroups(
        //     Math.ceil((parameters.width + 7) / 8),
        //     Math.ceil((parameters.height + 7) / 8),
        //     1);

        passEncoder.end();
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

    }

    // private async computeMaxDistance(): Promise<void> {
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
            labelCandidates[i * 4 + 1] = 0; // dtValue (f32)
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
            512 / 8,
            512 / 8,
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
            }
        }
        console.log("Labels:");
        console.log(labels);

        return labels;
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

    public debug_getDTTexture(): GPUTexture | null {
        return this.distanceTransformTexture;
    }

    // #endregion

}