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

//#region Contours (Labeling)

export function contoursBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
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
                storageTexture: {
                    access: 'write-only',
                    format: 'rgba32float',
                    viewDimension: '2d',
                }
            },
        ],
    }
}

export function contoursPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.camera, bindGroupLayouts.contours
        ],
    };
}

export function contoursPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPUComputePipelineDescriptor {
    return {
        label: "Contours (Labeling)",
        layout: pipelineLayouts.contours,
        compute: {
            module: shaderModules.contours,
            entryPoint: "main",
        },
    }
}
//#endregion

//#region Distance Transform (Labeling)
export function dtStepBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            { //~ stepSize
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'uniform',
                }
            },
            // { //~ widthScale
            //     binding: 1,
            //     visibility: GPUShaderStage.COMPUTE,
            //     buffer: {
            //         type: 'uniform',
            //     }
            // },
            // { //~ heightScale
            //     binding: 2,
            //     visibility: GPUShaderStage.COMPUTE,
            //     buffer: {
            //         type: 'uniform',
            //     }
            // }
        ],
    }
}

export function distanceTransformPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.camera, bindGroupLayouts.contours/*maybe don't reuse? */, bindGroupLayouts.distanceTransformStepParams,
        ],
    };
}

export function distanceTransformPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPUComputePipelineDescriptor {
    return {
        label: "Distance Transform step (Labeling)",
        layout: pipelineLayouts.distanceTransform,
        compute: {
            module: shaderModules.distanceTransformStep,
            entryPoint: "main",
        },
    }
}
//#endregion

//#region Max Distance Transfrom (Labeling)
export function maxDTInputTexturesBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        label: "Max DT: Input Textures",
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
            // Distance transform texture (input)
            { 
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            // // Contours (output)
            // {
            //     binding: 1,
            //     visibility: GPUShaderStage.COMPUTE,
            //     storageTexture: {
            //         access: 'write-only',
            //         format: 'rgba32float',
            //         viewDimension: '2d',
            //     }
            // },
        ],
    }
}

export function maxDTCandidatesBufferBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        label: "Max DT: Buffer(s)",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage",
                }
            },
        ]
    }
}

export function maxDTPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        label: "Max DT pipeline layout",
        bindGroupLayouts: [
            bindGroupLayouts.camera, bindGroupLayouts.maxDTInputTextures, bindGroupLayouts.maxDTCandidatesBuffer,
        ]
    };
}

export function maxDTPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPUComputePipelineDescriptor {
    return {
        label: "Max Distance Transform (Labeling)",
        layout: pipelineLayouts.maxDT,
        compute: {
            module: shaderModules.maxDT,
            entryPoint: "main",
        }
    }
}