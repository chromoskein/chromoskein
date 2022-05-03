import { GraphicsLibrary } from './index';

const tileDim = 128;
const batch = [4, 4];

export class Blur {
    private graphicsLibrary: GraphicsLibrary;

    private _width = 0;
    private _height = 0;

    private _filterDimension = 0;
    private _blockDimension = 0;

    private parametersGPU: GPUBuffer;
    private flipGPU: Array<GPUBuffer> = new Array(2);

    private computeConstantsBindGroup: GPUBindGroup | null = null;
    private computeBindGroup0: GPUBindGroup | null = null;
    private computeBindGroup1: GPUBindGroup | null = null;

    private _textures: [GPUTexture, GPUTexture] | null = null;

    constructor(graphicsLibrary: GraphicsLibrary) {
        this.graphicsLibrary = graphicsLibrary;

        const device = this.graphicsLibrary.device;

        this.flipGPU[0] = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.flipGPU[0], 0, new Float32Array([0]), 0, 1);

        this.flipGPU[1] = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.flipGPU[1], 0, new Float32Array([1]), 0, 1);

        this.parametersGPU = device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
    }

    private createBindGroups() {
        if (!this._textures) {
            return;
        }

        const device = this.graphicsLibrary.device;
        const pipeline = this.graphicsLibrary.computePipelines.ambientOcclusionBlur;

        this.computeConstantsBindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.graphicsLibrary.linearSampler },
                { binding: 1, resource: { buffer: this.parametersGPU } },
            ],
        });

        this.computeBindGroup0 = device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.aoBlurIO,
            entries: [
                { binding: 0, resource: this._textures[0].createView() },
                { binding: 1, resource: this._textures[1].createView() },
                { binding: 2, resource: { buffer: this.flipGPU[0] } },
            ],
        });

        this.computeBindGroup1 = device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.aoBlurIO,
            entries: [
                { binding: 0, resource: this._textures[1].createView() },
                { binding: 1, resource: this._textures[0].createView() },
                { binding: 2, resource: { buffer: this.flipGPU[1] } },
            ],
        });
    }

    public recordComputePass(computePass: GPUComputePassEncoder): void {
        if (!this._textures 
            || this._filterDimension <= 0
            || this._width <= 0
            || this._height <= 0
            || !this.computeConstantsBindGroup
            || !this.computeBindGroup0
            || !this.computeBindGroup1) {
            return;
        }

        const pipeline = this.graphicsLibrary.computePipelines.ambientOcclusionBlur;

        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, this.computeConstantsBindGroup);

        computePass.setBindGroup(1, this.computeBindGroup0);
        computePass.dispatchWorkgroups(
            Math.ceil(this._width / this._blockDimension),
            Math.ceil(this._height / batch[1])
        );

        computePass.setBindGroup(1, this.computeBindGroup1);
        computePass.dispatchWorkgroups(
            Math.ceil(this._height / this._blockDimension),
            Math.ceil(this._width / batch[1])
        );
    }

    //#region Setters & Getters
    public set width(width: number) {
        this._width = width;
    }

    public set height(height: number) {
        this._height = height;
    }

    public set filterDimension(filterDimension: number) {
        this._filterDimension = filterDimension;

        if (filterDimension % 2 == 1) {
            this._filterDimension = filterDimension + 1;
        }

        this.updateSettings();
    }

    public get filterDimension(): number {
        return this._filterDimension;
    }

    public set textures(textures: [GPUTexture, GPUTexture]) {
        this._textures = textures;

        this.createBindGroups();
    }

    private updateSettings() {
        this._blockDimension = tileDim - (this._filterDimension - 1);
        this.graphicsLibrary.device.queue.writeBuffer(
            this.parametersGPU,
            0,
            new Uint32Array([this._filterDimension, this._blockDimension])
        );
    }
    //#endregion
}