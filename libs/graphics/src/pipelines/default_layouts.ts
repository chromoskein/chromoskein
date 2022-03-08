import { BindGroupLayouts } from "./shared";
import { ShaderModules } from "../shaders";
import { PipelineLayouts } from "./shared";

export function cameraBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        label: "Camera BGL",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'uniform',
                }
            }
        ],
    };
}

export function primitivesBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        label: "Primitives BGL",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'read-only-storage',
                }
            }
        ],
    };
}

export function cullObjectsBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        label: "Cull Objects BGL",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: 'read-only-storage',
                }
            }
        ],
    };
}

export function primitivesTextureBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            // {
            //     binding: 0,
            //     visibility: GPUShaderStage.FRAGMENT,
            //     sampler: {
            //         type: 'filtering'
            //     }
            // },
            // {
            //     binding: 1,
            //     visibility: GPUShaderStage.FRAGMENT,
            //     texture: {
            //         sampleType: 'float',
            //         viewDimension: '2d',
            //     }
            // }
        ],
    };
}

export function primitivesPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.camera, bindGroupLayouts.primitives, bindGroupLayouts.cullObjects
        ],
    }
}

export function primitivesTexturePipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.camera, bindGroupLayouts.primitives, bindGroupLayouts.primitivesTexture
        ],
    }
}

export function passthroughBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            }
        ],
    };
}

export function passthroughPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.passthrough
        ],
    }
}

export function passthroughPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPURenderPipelineDescriptor {
    return {
        layout: pipelineLayouts.passthrough,
        vertex: {
            module: shaderModules.passthrough,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: shaderModules.passthrough,
            entryPoint: "main_fragment",
            targets: [
                {
                    format: "bgra8unorm",
                },
            ]
        },
        primitive: {
            topology: 'triangle-strip',
            stripIndexFormat: 'uint32',
        },
    };
};

export function renderGBufferBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'depth',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 4,
                visibility:GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'unfilterable-float',
                    viewDimension: '2d',
                    multisampled: false,
                }
            },
            {
                binding: 5,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'uniform',
                }
            },
            {
                binding: 6,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'uniform',
                }
            }
        ],
    };
}

export function renderGBufferPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.renderGBuffer
        ],
    }
}

export function renderGBufferPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPURenderPipelineDescriptor {
    return {
        layout: pipelineLayouts.renderGBuffer,
        vertex: {
            module: shaderModules.renderGBuffer,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: shaderModules.renderGBuffer,
            entryPoint: "main_fragment",
            targets: [
                {
                    format: "bgra8unorm",
                },
            ]
        },
        primitive: {
            topology: 'triangle-strip',
            stripIndexFormat: 'uint32',
        },
    };
};

