export const GBUFFER_NORMAL_FORMAT = 'rgba8unorm';

export interface RenderPipelines {
    [key: string]: GPURenderPipeline;
}

export interface ComputePipelines {
    [key: string]: GPUComputePipeline;
}


export interface BindGroupLayouts {
    [key: string]: GPUBindGroupLayout;
}

export interface PipelineLayouts {
    [key: string]: GPUPipelineLayout;
}
