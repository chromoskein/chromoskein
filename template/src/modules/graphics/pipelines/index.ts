import { ShaderModules } from "../shaders";
import { aabbsPipelineDescriptor, cylindersPipelineDescriptor, roundedConesPipelineDescriptor, quadraticBeziersPipelineDescriptor, spheresPipelineDescriptor, gBufferWorldPositionsBindGroupLayout } from "./primitives";
import { cameraBindGroupLayout, primitivesBindGroupLayout, primitivesPipelineLayout, passthroughPipelineLayout, passthroughBindGroupLayout, passthroughPipelineDescriptor, renderGBufferBindGroupLayout, renderGBufferPipelineLayout, renderGBufferPipelineDescriptor, primitivesTextureBindGroupLayout, primitivesTexturePipelineLayout, cullObjectsBindGroupLayout } from "./default_layouts";
import { BindGroupLayouts, PipelineLayouts, RenderPipelines, ComputePipelines } from "./shared";
import { distanceMapBindGroupLayout, distanceMapPipelineDescriptor, tadmapPipelineDescriptor, distanceMapPipelineLayout } from "./2d";
import { boundingVolumeHierarchyBindGroupLayout, rayTracingGBufferOutputBindGroupLayout, rayTracingAmbientOcclusionOutputBindGroupLayout, rayTracingAmbientOcclusionPipelineLayout, rayTracingGBufferPipelineLayout, rayTracingGBufferPipelineDescriptor, rayTracingAmbientOcclusionPipelineDescriptor } from "./ray_tracing";
import { ssaoGBufferBindGroupLayout, ssaoGlobalsBindGroupLayout, ssaoPipelineLayout, ssaoJoinPipelineLayout, ssaoPipelineDescriptor, aoBlurPipelineDescriptor, aoBlurParametersBindGroupLayout, aoBlurIOBindGroupLayout, aoBlurPipelineLayout, ssaoJoinBindGroupLayout, ssaoJoinPipelineDescriptor } from "./postprocess";

export function createRenderPipelines(device: GPUDevice, shaderModules: ShaderModules): [BindGroupLayouts, PipelineLayouts, RenderPipelines, ComputePipelines] {
    // console.time('createRenderPipelines');

    const bindGroupLayouts = {
        camera: device.createBindGroupLayout(cameraBindGroupLayout()),
        cullObjects: device.createBindGroupLayout(cullObjectsBindGroupLayout()),
        primitives: device.createBindGroupLayout(primitivesBindGroupLayout()),
        primitivesTexture: device.createBindGroupLayout(primitivesTextureBindGroupLayout()),
        boundingVolumeHierarchy: device.createBindGroupLayout(boundingVolumeHierarchyBindGroupLayout()),
        rayTracingGBufferOutput: device.createBindGroupLayout(rayTracingGBufferOutputBindGroupLayout()),
        rayTracingAmbientOcclusionOutput: device.createBindGroupLayout(rayTracingAmbientOcclusionOutputBindGroupLayout()),
        passthrough: device.createBindGroupLayout(passthroughBindGroupLayout()),
        renderGBuffer: device.createBindGroupLayout(renderGBufferBindGroupLayout()),

        ssaoGBuffer: device.createBindGroupLayout(ssaoGBufferBindGroupLayout()),
        ssaoGlobals: device.createBindGroupLayout(ssaoGlobalsBindGroupLayout()),
        ssaoJoin: device.createBindGroupLayout(ssaoJoinBindGroupLayout()),
        aoBlurParameters: device.createBindGroupLayout(aoBlurParametersBindGroupLayout()),
        aoBlurIO: device.createBindGroupLayout(aoBlurIOBindGroupLayout()),

        gBufferWorldPositionsBindGroupLayout: device.createBindGroupLayout(gBufferWorldPositionsBindGroupLayout()),

        distanceMap: device.createBindGroupLayout(distanceMapBindGroupLayout()),
    };

    const pipelineLayouts = {
        primitives: device.createPipelineLayout(primitivesPipelineLayout(bindGroupLayouts)),
        primitivesTexture: device.createPipelineLayout(primitivesTexturePipelineLayout(bindGroupLayouts)),
        rayTracingGBuffer: device.createPipelineLayout(rayTracingGBufferPipelineLayout(bindGroupLayouts)),
        rayTracingAmbientOcclusion: device.createPipelineLayout(rayTracingAmbientOcclusionPipelineLayout(bindGroupLayouts)),
        passthrough: device.createPipelineLayout(passthroughPipelineLayout(bindGroupLayouts)),
        renderGBuffer: device.createPipelineLayout(renderGBufferPipelineLayout(bindGroupLayouts)),
        ssao: device.createPipelineLayout(ssaoPipelineLayout(bindGroupLayouts)),
        ssaoJoin: device.createPipelineLayout(ssaoJoinPipelineLayout(bindGroupLayouts)),
        aoBlurParameters: device.createPipelineLayout(aoBlurPipelineLayout(bindGroupLayouts)),

        distanceMap: device.createPipelineLayout(distanceMapPipelineLayout(bindGroupLayouts)),
    };

    const renderPipelines = {
        spheresWriteDepth: device.createRenderPipeline(spheresPipelineDescriptor(device, bindGroupLayouts, pipelineLayouts, shaderModules, true)),
        spheresDiscardDepth: device.createRenderPipeline(spheresPipelineDescriptor(device, bindGroupLayouts, pipelineLayouts, shaderModules, false)),
        cylindersWriteDepth: device.createRenderPipeline(cylindersPipelineDescriptor(pipelineLayouts, shaderModules, true)),
        cylindersDiscardDepth: device.createRenderPipeline(cylindersPipelineDescriptor(pipelineLayouts, shaderModules, false)),
        quadraticBeziersWriteDepth: device.createRenderPipeline(quadraticBeziersPipelineDescriptor(pipelineLayouts, shaderModules, true)),
        quadraticBeziersDiscardDepth: device.createRenderPipeline(quadraticBeziersPipelineDescriptor(pipelineLayouts, shaderModules, false)),
        aabbsWriteDepth: device.createRenderPipeline(aabbsPipelineDescriptor(pipelineLayouts, shaderModules, true)),
        aabbsDiscardDepth: device.createRenderPipeline(aabbsPipelineDescriptor(pipelineLayouts, shaderModules, false)),
        roundedConesWriteDepth: device.createRenderPipeline(roundedConesPipelineDescriptor(pipelineLayouts, shaderModules, true)),
        roundedConesDiscardDepth: device.createRenderPipeline(roundedConesPipelineDescriptor(pipelineLayouts, shaderModules, false)),

        tadmap: device.createRenderPipeline(tadmapPipelineDescriptor(pipelineLayouts, shaderModules)),
        distanceMap: device.createRenderPipeline(distanceMapPipelineDescriptor(pipelineLayouts, shaderModules)),

        passthrough: device.createRenderPipeline(passthroughPipelineDescriptor(pipelineLayouts, shaderModules)),
        renderGBuffer: device.createRenderPipeline(renderGBufferPipelineDescriptor(pipelineLayouts, shaderModules)),
    };

    const computePipelines = {
        rayTracingGBuffer: device.createComputePipeline(rayTracingGBufferPipelineDescriptor(pipelineLayouts, shaderModules)),
        rayTracingAmbientOcclusion: device.createComputePipeline(rayTracingAmbientOcclusionPipelineDescriptor(pipelineLayouts, shaderModules)),
        screenSpaceAmbientOcclusion: device.createComputePipeline(ssaoPipelineDescriptor(pipelineLayouts, shaderModules)),
        ambientOcclusionBlur: device.createComputePipeline(aoBlurPipelineDescriptor(pipelineLayouts, shaderModules)),
        ssaoJoin: device.createComputePipeline(ssaoJoinPipelineDescriptor(pipelineLayouts, shaderModules)),
    };

    // console.timeEnd('createRenderPipelines');

    return [bindGroupLayouts, pipelineLayouts, renderPipelines, computePipelines];
}

