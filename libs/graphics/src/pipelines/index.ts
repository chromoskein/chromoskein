import { ShaderModules } from "../shaders";
import { aabbsPipelineDescriptor, cylindersPipelineDescriptor, roundedConesPipelineDescriptor, quadraticBeziersPipelineDescriptor, spheresPipelineDescriptor, gBufferWorldPositionsBindGroupLayout } from "./primitives";
import { cameraBindGroupLayout, primitivesBindGroupLayout, primitivesPipelineLayout, passthroughPipelineLayout, passthroughBindGroupLayout, passthroughPipelineDescriptor, renderGBufferBindGroupLayout, renderGBufferPipelineLayout, renderGBufferPipelineDescriptor, primitivesTextureBindGroupLayout, primitivesTexturePipelineLayout, cullObjectsBindGroupLayout, singleTextureLayout, textureBlitPipelineDescriptor, textureBlitPipelineLayout, textureBlitFloatPipelineDescriptor } from "./default_layouts";
import { BindGroupLayouts, PipelineLayouts, RenderPipelines, ComputePipelines } from "./shared";
import { distanceMapBindGroupLayout, distanceMapPipelineDescriptor, tadmapPipelineDescriptor, distanceMapPipelineLayout } from "./2d";
import { boundingVolumeHierarchyBindGroupLayout, rayTracingGBufferOutputBindGroupLayout, rayTracingAmbientOcclusionOutputBindGroupLayout, rayTracingAmbientOcclusionPipelineLayout, rayTracingGBufferPipelineLayout, rayTracingGBufferPipelineDescriptor, rayTracingAmbientOcclusionPipelineDescriptor } from "./ray_tracing";
import { ssaoGBufferBindGroupLayout, ssaoGlobalsBindGroupLayout, ssaoPipelineLayout, ssaoJoinPipelineLayout, ssaoPipelineDescriptor, aoBlurPipelineDescriptor, aoBlurParametersBindGroupLayout, aoBlurIOBindGroupLayout, aoBlurPipelineLayout, ssaoJoinBindGroupLayout, ssaoJoinPipelineDescriptor, contoursBindGroupLayout, contoursPipelineLayout, contoursPipelineDescriptor, distanceTransformPipelineDescriptor, distanceTransformPipelineLayout, dtStepBindGroupLayout, maxDTPipelineLayout, maxDTPipelineDescriptor, maxDTInputTexturesBindGroupLayout, maxDTCandidatesBufferBindGroupLayout, maxDTInputBuffersBindGroupLayout, maxDTParametersBindGroupLayout, maxDTOutputBufferBindGroupLayout, maxDTAtomicsPipelineLayout, maxDTAtomicsPipelineDescriptor } from "./postprocess";
import { pipeline } from "stream";

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
        singleTexture: device.createBindGroupLayout(singleTextureLayout()),
        //~ labeling
        contours: device.createBindGroupLayout(contoursBindGroupLayout()),
        distanceTransformStepParams: device.createBindGroupLayout(dtStepBindGroupLayout()),
        maxDTInputTextures: device.createBindGroupLayout(maxDTInputTexturesBindGroupLayout()),//~ old
        maxDTInputBuffers: device.createBindGroupLayout(maxDTInputBuffersBindGroupLayout()),
        maxDTParameters: device.createBindGroupLayout(maxDTParametersBindGroupLayout()),
        maxDTCandidatesBuffer: device.createBindGroupLayout(maxDTCandidatesBufferBindGroupLayout()),
        maxDTOutputBuffer: device.createBindGroupLayout(maxDTOutputBufferBindGroupLayout()),
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
        textureBlit: device.createPipelineLayout(textureBlitPipelineLayout(bindGroupLayouts)),
        //~ labeling
        contours: device.createPipelineLayout(contoursPipelineLayout(bindGroupLayouts)),
        distanceTransform: device.createPipelineLayout(distanceTransformPipelineLayout(bindGroupLayouts)),
        maxDT: device.createPipelineLayout(maxDTPipelineLayout(bindGroupLayouts)),
        maxDTAtomics: device.createPipelineLayout(maxDTAtomicsPipelineLayout(bindGroupLayouts)),
    };

    const renderPipelines = {
        spheresWriteDepth: device.createRenderPipeline(spheresPipelineDescriptor(device, bindGroupLayouts, pipelineLayouts, shaderModules, true)),
        spheresDiscardDepth: device.createRenderPipeline(spheresPipelineDescriptor(device, bindGroupLayouts, pipelineLayouts, shaderModules, false)),
        cylindersWriteDepth: device.createRenderPipeline(cylindersPipelineDescriptor(pipelineLayouts, shaderModules, true)),
        cylindersDiscardDepth: device.createRenderPipeline(cylindersPipelineDescriptor(pipelineLayouts, shaderModules, false)),
        quadraticBeziersWriteDepth: device.createRenderPipeline(quadraticBeziersPipelineDescriptor(pipelineLayouts, shaderModules, true)),
        quadraticBeziersDiscardDepth: device.createRenderPipeline(quadraticBeziersPipelineDescriptor(pipelineLayouts, shaderModules, false)),
        roundedConesWriteDepth: device.createRenderPipeline(roundedConesPipelineDescriptor(pipelineLayouts, shaderModules, true)),
        roundedConesDiscardDepth: device.createRenderPipeline(roundedConesPipelineDescriptor(pipelineLayouts, shaderModules, false)),

        // tadmap: device.createRenderPipeline(tadmapPipelineDescriptor(pipelineLayouts, shaderModules)),
        distanceMap: device.createRenderPipeline(distanceMapPipelineDescriptor(pipelineLayouts, shaderModules)),

        passthrough: device.createRenderPipeline(passthroughPipelineDescriptor(pipelineLayouts, shaderModules)),
        renderGBuffer: device.createRenderPipeline(renderGBufferPipelineDescriptor(pipelineLayouts, shaderModules)),
        textureBlit: device.createRenderPipeline(textureBlitPipelineDescriptor(pipelineLayouts, shaderModules)),
        textureBlitFloat: device.createRenderPipeline(textureBlitFloatPipelineDescriptor(pipelineLayouts, shaderModules)),
    };

    const computePipelines = {
        rayTracingGBuffer: device.createComputePipeline(rayTracingGBufferPipelineDescriptor(pipelineLayouts, shaderModules)),
        rayTracingAmbientOcclusion: device.createComputePipeline(rayTracingAmbientOcclusionPipelineDescriptor(pipelineLayouts, shaderModules)),
        screenSpaceAmbientOcclusion: device.createComputePipeline(ssaoPipelineDescriptor(pipelineLayouts, shaderModules)),
        ambientOcclusionBlur: device.createComputePipeline(aoBlurPipelineDescriptor(pipelineLayouts, shaderModules)),
        ssaoJoin: device.createComputePipeline(ssaoJoinPipelineDescriptor(pipelineLayouts, shaderModules)),
        //~ labeling
        contours: device.createComputePipeline(contoursPipelineDescriptor(pipelineLayouts, shaderModules)),
        distanceTransform: device.createComputePipeline(distanceTransformPipelineDescriptor(pipelineLayouts, shaderModules)),
        maxDT: device.createComputePipeline(maxDTPipelineDescriptor(pipelineLayouts, shaderModules)),
        maxDTAtomics: device.createComputePipeline(maxDTAtomicsPipelineDescriptor(pipelineLayouts, shaderModules)),
    };

    // console.timeEnd('createRenderPipelines');

    return [bindGroupLayouts, pipelineLayouts, renderPipelines, computePipelines];
}

