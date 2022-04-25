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

    private viewport: ChromatinViewport | null = null;
    private graphicsLibrary: GraphicsLibrary | null = null;

    //~ private textures
    private contoursTexture: GPUTexture;

    constructor(viewport: ChromatinViewport, graphicsLib: GraphicsLibrary) {
        this.viewport = viewport;
        this.graphicsLibrary = graphicsLib;

        const size = {
            width: this.viewport.width,
            height: this.viewport.height,
        };

        this.contoursTexture = this.graphicsLibrary.device.createTexture({
            size,
            format: 'r32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
    }

    // #region High-level labeling workflow

    public computeContours() {
        if (!this.viewport || !this.viewport.camera || !this.graphicsLibrary) {
            return;
        }

        const idBuffer = this.viewport.getIDBuffer();
        if (!idBuffer) { return; }

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
            gBufferBindGroup: device.createBindGroup({
                layout: this.graphicsLibrary.bindGroupLayouts.ssaoGBuffer,
                entries: [
                    { binding: 0, resource: idBuffer.createView() },
                    { binding: 1, resource: this.contoursTexture.createView() },
                    // { binding: 0, resource: this.depthTexture.createView() },
                    // { binding: 1, resource: this.gBuffer.worldNormals.createView() },
                    // { binding: 2, resource: this.gBuffer.ambientOcclusion[0].createView() }
                ]
            }),
            passEncoder: computePassEncoder,
        });

        computePassEncoder.end();
    }

    public computeVoronoi(): void {
        const a = "test";
    }

    public getLabelPositions(): Label[] {
        return this.debug_getRandomLabelPositions();
    }

    // #endregion

    // #region Low-level implementation and helper functions
    public renderContoursPass(parameters: {
        width: number,
        height: number,
        cameraBindGroup: GPUBindGroup,
        gBufferBindGroup: GPUBindGroup,
        passEncoder: GPUComputePassEncoder,
    }): void {
        if (!this.graphicsLibrary) {
            return;
        }

        parameters.passEncoder.setPipeline(this.graphicsLibrary.computePipelines.screenSpaceAmbientOcclusion);
        parameters.passEncoder.setBindGroup(0, parameters.cameraBindGroup);
        parameters.passEncoder.setBindGroup(1, parameters.gBufferBindGroup);
        // parameters.passEncoder.setBindGroup(2, parameters.ssaoBindGroup);

        parameters.passEncoder.dispatch(
            Math.ceil((parameters.width + 7) / 8),
            Math.ceil((parameters.height + 7) / 8),
            1);
    }


    public debug_getRandomLabelPositions(): Label[] {
        const retLabels = Array.from({ length: 100 }, (_, index) => ({ id: index, x: getRandomInt(800), y: getRandomInt(600), text: "Label " + index }));
        return retLabels;
    }

    // #endregion
}