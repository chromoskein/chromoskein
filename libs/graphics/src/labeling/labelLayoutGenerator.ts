import { GraphicsLibrary } from "..";
import { cameraBindGroupLayout } from "../pipelines/default_layouts";
import {getRandomInt} from "../utils";
import { ChromatinViewport } from "../viewports";

//~ Shaders
import contours from "./shaders/contours.wgsl";

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

    constructor(viewport: ChromatinViewport, graphicsLib: GraphicsLibrary) {
        this._viewport = viewport;
        this.graphicsLibrary = graphicsLib;

        if (viewport.width == 0 || viewport.height == 0) {
            this.resizeTextures(123, 123); //~ just making sure I don't have a texture with size 0x0 but I can still tell there's a problem
        } else {
            this.resizeTextures(viewport.width, viewport.height);
        }
    }

    private resizeTextures(width: number, height: number) {
        const size = {
            width: width,
            height: height,
        };

        if (!this.graphicsLibrary) {
            console.log("error: graphicsLibrary is null")
            return;
        }

        this.contoursTexture = this.graphicsLibrary.device.createTexture({
            size,
            format: 'r32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
    }

    public set viewport(vp: ChromatinViewport | null) {
        this._viewport = vp;

        if (vp) {
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

        const layout = device.createBindGroupLayout({
            entries: [
                // ID Buffer (input)
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: 'unfilterable-float',
                        viewDimension: '2d',
                        multisampled: false,
                    }
                },
                // Contours (output)
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: 'unfilterable-float',
                        viewDimension: '2d',
                        multisampled: false,
                    }
                },
                // // gBufferAmbientOcclusion
                // {
                //     binding: 2,
                //     visibility: GPUShaderStage.COMPUTE,
                //     storageTexture: {
                //         access: 'write-only',
                //         format: 'r32float',
                //         viewDimension: '2d',
                //     }
                // },
            ],
        });


        this.renderContoursPass({
            width: this.viewport.width,
            height: this.viewport.height,
            cameraBindGroup: cameraBindGroup,
            cameraBGLayout: this.graphicsLibrary.bindGroupLayouts.camera,
            gBufferBindGroup: device.createBindGroup({
                // layout: this.graphicsLibrary.bindGroupLayouts.ssaoGBuffer,
                layout: layout,
                entries: [
                    { binding: 0, resource: idBuffer.createView() },
                    { binding: 1, resource: this.contoursTexture.createView() },
                    // { binding: 0, resource: this.depthTexture.createView() },
                    // { binding: 1, resource: this.gBuffer.worldNormals.createView() },
                    // { binding: 2, resource: this.gBuffer.ambientOcclusion[0].createView() }
                ]
            }),
            gBufferBindGroupLayout: layout,
            passEncoder: computePassEncoder,
        });

        computePassEncoder.end();
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
        gBufferBindGroup: GPUBindGroup,
        gBufferBindGroupLayout: GPUBindGroupLayout,
        passEncoder: GPUComputePassEncoder,
    }): void {
        if (!this.graphicsLibrary) {
            console.log("computeContours failed. #3")
            return;
        }

        const device = this.graphicsLibrary.device;
        const pipelineLayoutDescriptor =
        {
            bindGroupLayouts: [
                parameters.cameraBGLayout, parameters.gBufferBindGroupLayout
            ],
        }

        const contoursShader = device.createShaderModule({ code: contours });

        const pipelineLayout = device.createPipelineLayout(pipelineLayoutDescriptor);
        const contoursPipelineDescriptor = {
            // layout: pipelineLayouts.ssao,
            layout: pipelineLayout,
            compute: {
                // module: shaderModules.ssao,
                module: contoursShader,
                entryPoint: "main",
            },
        };
        const contoursPipeline = device.createComputePipeline(contoursPipelineDescriptor);

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