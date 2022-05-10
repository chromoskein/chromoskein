import { SlabAllocator } from "./allocators/index";
import { Camera, OrbitCamera } from "./cameras/index";
import { SmoothCamera } from "./cameras/smooth";
import { createRenderPipelines } from "./pipelines/index";
import { BindGroupLayouts, ComputePipelines, PipelineLayouts, RenderPipelines } from "./pipelines/shared";
import { Scene } from "./scene";
import { createShaderModules, ShaderModules } from "./shaders/index";
import { ChromatinViewport, DistanceViewport, Viewport3D } from "./viewports/index";

export * from "./cameras/index";
export * from "./allocators/index";
export * from "./shaders/index";
export * from "./pipelines/index";
export * from "./primitives/index";
export * from "./viewports/index";
export * from "./utils";
export * from "./blur";
export * from "./culling";

export class GraphicsLibrary {
    private _adapter: GPUAdapter;
    private _device: GPUDevice;
    private _allocator: SlabAllocator;
    private _shaderModules: ShaderModules;
    private _bindGroupLayouts: BindGroupLayouts;
    private _pipelineLayouts: PipelineLayouts;
    private _renderPipelines: RenderPipelines; 
    private _computePipelines: ComputePipelines;
    private _nearestClampSampler: GPUSampler;
    private _nearestRepeatSampler: GPUSampler;
    private _linearSampler: GPUSampler;
    private _dummy1DTextureView: GPUTextureView;

    constructor(adapter: GPUAdapter, device: GPUDevice) {
        this._adapter = adapter;
        this._device = device;
        this._allocator = new SlabAllocator(device);
        this._shaderModules = createShaderModules(device);

        const [bindGroupLayouts, pipelineLayouts, renderPipelines, computePipelines] = createRenderPipelines(device, this._shaderModules);
        this._bindGroupLayouts = bindGroupLayouts;
        this._pipelineLayouts = pipelineLayouts;
        this._renderPipelines = renderPipelines;
        this._computePipelines = computePipelines;

        this._nearestClampSampler = this._device.createSampler({
            magFilter: 'nearest',
            minFilter: 'nearest',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
        });
        this._nearestRepeatSampler = this._device.createSampler({
            magFilter: 'nearest',
            minFilter: 'nearest',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            addressModeW: 'repeat',
        });
        this._linearSampler = this._device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
        this._dummy1DTextureView = device.createTexture({
            size: {
                width: 4,
                height: 1,
            },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        }).createView({
        });
    }

    public create3DViewport(canvas: HTMLCanvasElement | null, scene: Scene | null = null, camera: OrbitCamera | SmoothCamera | null = null): Viewport3D {
        return new Viewport3D(this, canvas, scene, camera);
    }

    public createChromatinViewport(canvas: HTMLCanvasElement | null, scene: Scene | null = null, camera: OrbitCamera | SmoothCamera | null = null): ChromatinViewport {
        return new ChromatinViewport(this, canvas, scene, camera);
    }

    public createDistanceViewport(canvas: HTMLCanvasElement | null): DistanceViewport {
        return new DistanceViewport(this, canvas);
    }

    public createScene(): Scene {
        return new Scene(this);
    }

    public get adapter(): GPUAdapter {
        return this._adapter;
    }

    public get device(): GPUDevice {
        return this._device;
    }

    public get allocator(): SlabAllocator {
        return this._allocator;
    }

    public get shaderModules(): ShaderModules {
        return this._shaderModules;
    }

    public get bindGroupLayouts(): BindGroupLayouts {
        return this._bindGroupLayouts;
    }

    public get pipelineLayouts(): PipelineLayouts {
        return this._pipelineLayouts;
    }

    public get renderPipelines(): RenderPipelines {
        return this._renderPipelines;
    }

    public get computePipelines(): ComputePipelines {
        return this._computePipelines;
    }

    public get nearestSampler(): GPUSampler {
        return this._nearestClampSampler;
    }

    public get nearestClampSampler(): GPUSampler {
        return this._nearestClampSampler;
    }

    public get nearestRepeatSampler(): GPUSampler {
        return this._nearestClampSampler;
    }

    public get linearSampler(): GPUSampler {
        return this._linearSampler;
    }

    public get dummy1DTextureView(): GPUTextureView {
        return this._dummy1DTextureView;
    }
}
