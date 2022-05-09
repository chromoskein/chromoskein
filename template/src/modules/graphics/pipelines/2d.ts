import { ShaderModules } from "../shaders";
import { BindGroupLayouts, PipelineLayouts } from "./shared";

export function distanceMapBindGroupLayout(): GPUBindGroupLayoutDescriptor {
    return {
        label: "Distance Map BGL",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: 'uniform',
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: 'uniform',
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: 'read-only-storage',
                }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: 'read-only-storage',
                }
            }
        ],
    };
}

export function distanceMapPipelineLayout(bindGroupLayouts: BindGroupLayouts): GPUPipelineLayoutDescriptor {
    return {
        bindGroupLayouts: [
            bindGroupLayouts.distanceMap
        ],
    }
}

export function tadmapPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPURenderPipelineDescriptor {
    return {
        vertex: {
            module: shaderModules.tadmap,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: shaderModules.tadmap,
            entryPoint: "main_fragment",
            targets: [
                {
                    format: "bgra8unorm",
                },
            ]
        },
        primitive: {
            topology: 'triangle-list',
        },
    };
}

export function distanceMapPipelineDescriptor(pipelineLayouts: PipelineLayouts, shaderModules: ShaderModules): GPURenderPipelineDescriptor {
    return {
        layout: pipelineLayouts.distanceMap,
        vertex: {
            module: shaderModules.distanceMap,
            entryPoint: "main_vertex",
        },
        fragment: {
            module: shaderModules.distanceMap,
            entryPoint: "main_fragment",
            targets: [
                {
                    format: "bgra8unorm",
                },
            ]
        },
        primitive: {
            topology: 'triangle-list',
        },
    };
};