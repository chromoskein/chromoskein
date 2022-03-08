import { ShaderModules } from "../shaders";
import { GBUFFER_NORMAL_FORMAT, PipelineLayouts } from "./shared";
import { BindGroupLayouts } from "./shared";

const gBufferOutputs = (writeDepth: boolean): Array<GPUColorTargetState> => writeDepth ? [
    // Color
    {
        format: "rgba8unorm",
    },
    // World Positions
    // {
    //     format: "rgba32float",
    // },
    // World Normals
    {
        format: GBUFFER_NORMAL_FORMAT,
    }
] : [
    // Color
    {
        format: "rgba8unorm",
        blend: {
            color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
            },
            alpha: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
            }
        }
    },
];

const depthDescription = (writeDepth: boolean): GPUDepthStencilState => {
    return writeDepth ? {
        depthWriteEnabled: true,
        depthCompare: 'greater',
        format: 'depth32float',
    } : {
        depthWriteEnabled: false,
        depthCompare: 'greater',
        format: 'depth32float',
    };
};

export function gBufferWorldPositionsBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'depth',
                    viewDimension: '2d',
                    multisampled: false,
                }
            }
        ]
    };
}

export function spheresPipelineDescriptor(device: GPUDevice, bindGroupLayouts: BindGroupLayouts, pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules, depth: boolean): GPURenderPipelineDescriptor {
    if (depth) {
        return {
            label: 'Spheres Pipeline Descriptor',
            layout: pipelineLayouts.primitives,
            vertex: {
                module: depth ? shaderModules.spheresWriteDepth : shaderModules.spheresDiscardDepth,
                entryPoint: "main_vertex",
            },
            fragment: {
                module: depth ? shaderModules.spheresWriteDepth : shaderModules.spheresDiscardDepth,
                entryPoint: "main_fragment",
                targets: gBufferOutputs(depth),
    
            },
            primitive: {
                topology: 'triangle-strip',
                stripIndexFormat: 'uint32',
            },
            depthStencil: depthDescription(depth),
        };
    }

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            bindGroupLayouts.camera, bindGroupLayouts.primitives, bindGroupLayouts.cullObjects, bindGroupLayouts.gBufferWorldPositionsBindGroupLayout
        ],
    })

    return {
        label: 'Spheres Pipeline Descriptor (without depth)',
        layout: pipelineLayout,
        vertex: {
            module: depth ? shaderModules.spheresWriteDepth : shaderModules.spheresDiscardDepth,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: depth ? shaderModules.spheresWriteDepth : shaderModules.spheresDiscardDepth,
            entryPoint: "main_fragment",
            targets: gBufferOutputs(depth),

        },
        primitive: {
            topology: 'triangle-strip',
            stripIndexFormat: 'uint32',
        },
    };
}

export function cylindersPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules, depth: boolean): GPURenderPipelineDescriptor {
    return {
        layout: pipelineLayouts.primitives,
        vertex: {
            module: depth ? shaderModules.cylindersWriteDepth : shaderModules.cylindersDiscardDepth,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: depth ? shaderModules.cylindersWriteDepth : shaderModules.cylindersDiscardDepth,
            entryPoint: "main_fragment",
            targets: gBufferOutputs(depth),
        },
        primitive: {
            topology: 'triangle-strip',
            stripIndexFormat: 'uint32',
        },
        depthStencil: depthDescription(depth),
    };
}

export function quadraticBeziersPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules, depth: boolean): GPURenderPipelineDescriptor {
    return {
        layout: pipelineLayouts.primitives,
        vertex: {
            module: depth ? shaderModules.quadraticBeziersWriteDepth : shaderModules.quadraticBeziersDiscardDepth,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: depth ? shaderModules.quadraticBeziersWriteDepth : shaderModules.quadraticBeziersDiscardDepth,
            entryPoint: "main_fragment",
            targets: gBufferOutputs(depth),
        },
        primitive: {
            topology: 'triangle-strip',
            stripIndexFormat: 'uint32',
        },
        depthStencil: depthDescription(depth),
    };
}

export function aabbsPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules, depth: boolean): GPURenderPipelineDescriptor {
    return {
        layout: pipelineLayouts.primitives,
        vertex: {
            module: depth ? shaderModules.aabbsWriteDepth : shaderModules.aabbsDiscardDepth,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: depth ? shaderModules.aabbsWriteDepth : shaderModules.aabbsDiscardDepth,
            entryPoint: "main_fragment",
            targets: gBufferOutputs(depth),
        },
        primitive: {
            topology: 'triangle-strip',
            stripIndexFormat: 'uint32',
        },
        depthStencil: depthDescription(depth),
    };
}

export function roundedConesPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules, depth: boolean): GPURenderPipelineDescriptor {
    return {
        label: depth ? 'Rounded Cones' : 'Rounded Cones (without depth)',
        layout: pipelineLayouts.primitives,
        vertex: {
            module: depth ? shaderModules.roundedConesWriteDepth : shaderModules.roundedConesDiscardDepth,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: depth ? shaderModules.roundedConesWriteDepth : shaderModules.roundedConesDiscardDepth,
            entryPoint: "main_fragment",
            targets: gBufferOutputs(depth),
        },
        primitive: {
            topology: 'triangle-strip',
            stripIndexFormat: 'uint32',
        },
        depthStencil: depth ? depthDescription(depth) : undefined,
    };
}
