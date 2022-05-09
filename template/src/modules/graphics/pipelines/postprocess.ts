import { BindGroupLayouts, PipelineLayouts, GBUFFER_NORMAL_FORMAT } from "./shared";
import { ShaderModules } from "../shaders";

export function ssaoGBufferBindGroupLayout(): GPUBindGroupLayoutDescriptor {
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
        ],
    };
}

export function ssaoGlobalsBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'uniform',
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                sampler: {
                    type: 'filtering'
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            }
        ],
    };
}

export function ssaoPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.camera, bindGroupLayouts.ssaoGBuffer, bindGroupLayouts.ssaoGlobals
        ],
    }
}

export function ssaoPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPUComputePipelineDescriptor {
    return {
        layout: pipelineLayouts.ssao,
        compute: {
            module: shaderModules.ssao,
            entryPoint: "main",
        }
    };
}

export function aoBlurParametersBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                sampler: {
                    type: 'filtering'
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'uniform',
                }
            }
        ],
    };
}

export function aoBlurIOBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'depth',
                    viewDimension: '2d',
                    multisampled: false,
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
        ],
    };
}
export function aoBlurPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.aoBlurIO
        ],
    }
}

export function aoBlurPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPUComputePipelineDescriptor {
    return {
        layout: pipelineLayouts.aoBlurParameters,
        compute: {
            module: shaderModules.aoBlur,
            entryPoint: "main",
        }
    };
}


export function ssaoJoinBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: 'write-only',
                    format: 'r32float',
                    viewDimension: '2d',
                }
            },
        ],
    };
}
export function ssaoJoinPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.ssaoJoin
        ],
    }
}

export function ssaoJoinPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPUComputePipelineDescriptor {
    return {
        layout: pipelineLayouts.ssaoJoin,
        compute: {
            module: shaderModules.ssaoJoin,
            entryPoint: "main",
        }
    };
}