import { BindGroupLayouts, PipelineLayouts } from "./shared";
import { ShaderModules } from "../shaders";

export function boundingVolumeHierarchyBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'read-only-storage',
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'read-only-storage',
                }
            }
        ],
    };
};

export function rayTracingGBufferOutputBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: 'write-only',
                    format: 'rgba8unorm',
                    viewDimension: '2d',
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: 'write-only',
                    format: 'rgba32float',
                    viewDimension: '2d',
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: 'write-only',
                    format: 'rgba8unorm',
                    viewDimension: '2d',
                }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: 'write-only',
                    format: 'r32float',
                    viewDimension: '2d',
                }
            },
            {
                binding: 4,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'uniform',
                }
            }
        ],
    };
};

export function rayTracingGBufferPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.camera,
            bindGroupLayouts.primitives,
            bindGroupLayouts.boundingVolumeHierarchy,
            bindGroupLayouts.rayTracingGBufferOutput
        ],
    }
}

export function rayTracingGBufferPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPUComputePipelineDescriptor {
    return {
        layout: pipelineLayouts.rayTracingGBuffer,
        compute: {
            module: shaderModules.rayTracingGBuffer,
            entryPoint: "main",
        }
    };
}

export function rayTracingAmbientOcclusionOutputBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
             // Depth/gBufferWorldPositions
             {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'depth',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            // gBufferWorldNormals
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            // gBufferAmbientOcclusion
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: 'write-only',
                    format: 'r32float',
                    viewDimension: '2d',
                }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'uniform',
                }
            }
        ],
    };
};

export function rayTracingAmbientOcclusionPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.camera,
            bindGroupLayouts.primitives,
            bindGroupLayouts.boundingVolumeHierarchy,
            bindGroupLayouts.rayTracingAmbientOcclusionOutput
        ],
    }
}

export function rayTracingAmbientOcclusionPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPUComputePipelineDescriptor {
    return {
        layout: pipelineLayouts.rayTracingAmbientOcclusion,
        compute: {
            module: shaderModules.rayTracingAmbientOcclusion,
            entryPoint: "main",
        }
    };
}
