import math from "./math.wgsl";
import rayTracing from "./ray_tracing.wgsl";

import primitivesShared from "./primitives/shared.wgsl";
import { spheres } from "./primitives/spheres";
import { cylinders } from "./primitives/cylinders";
import primitiveBeziers from "./beziers.wgsl";
import { beziers } from "./primitives/beziers";
import { roundedCones } from "./primitives/rounded_cones";

import rayTracingGBuffer from "./raytrace_gbuffer.wgsl";
import rayTracingAmbientOcclusion from "./raytrace_ao.wgsl";

import passthrough from "./util/passthrough.wgsl";
import renderGBuffer from "./util/render_gbuffer.wgsl";
import textureBlit from "./util/textureBlit.wgsl";

import tadmap from "./2d/tadmap.wgsl";
import distanceMap from "./2d/distance_map.wgsl";

import ssao from "./postprocess/ssao.wgsl";
import aoBlur from "./postprocess/ssao_blur.wgsl";
import ssaoJoin from "./postprocess/ssao_join.wgsl";

import contours from "./labeling/contours.wgsl";
import distanceTransform from "./labeling/distance-transform.wgsl";
import maxDT from "./labeling/max-dt.wgsl";
import maxDT_1D from "./labeling/max-dt_1Dversion.wgsl";
import maxDTAtomics from "./labeling/max-dt-atomics.wgsl";

export interface ShaderModules {
    [key: string]: GPUShaderModule;
}

export function createShaderModules(device: GPUDevice): ShaderModules {
    // console.time('createShaderModules');

    const primitivesBase = math + rayTracing + primitivesShared;

    const shaders = {
        //#region Rasterization - primitives
        spheresWriteDepth: device.createShaderModule({ code: primitivesBase + spheres(true) }),
        spheresDiscardDepth: device.createShaderModule({ code: primitivesBase + spheres(false) }),
        cylindersWriteDepth: device.createShaderModule({ code: primitivesBase + cylinders(true) }),
        cylindersDiscardDepth: device.createShaderModule({ code: primitivesBase + cylinders(false) }),
        quadraticBeziersWriteDepth: device.createShaderModule({ code: primitivesBase + primitiveBeziers + beziers(true) }),
        quadraticBeziersDiscardDepth: device.createShaderModule({ code: primitivesBase + primitiveBeziers + beziers(false) }),
        roundedConesWriteDepth: device.createShaderModule({ code: primitivesBase + roundedCones(true) }),
        roundedConesDiscardDepth: device.createShaderModule({ code: primitivesBase + roundedCones(false) }),
        //#endregion

        //#region Ray-Tracing
        rayTracingGBuffer: device.createShaderModule({ code: primitivesBase + rayTracingGBuffer }),
        rayTracingAmbientOcclusion: device.createShaderModule({ code: primitivesBase + rayTracingAmbientOcclusion }),
        //#endregion

        //#region 2D
        tadmap: device.createShaderModule({ code: tadmap }),
        distanceMap: device.createShaderModule({ code: distanceMap }),
        //#endregion

        //#region Post-Process
        passthrough: device.createShaderModule({ code: passthrough }),
        renderGBuffer: device.createShaderModule({ code: renderGBuffer }),
        ssao: device.createShaderModule({ code: ssao }),
        ssaoJoin: device.createShaderModule({ code: ssaoJoin }),
        aoBlur: device.createShaderModule({ code: aoBlur }),
        textureBlit: device.createShaderModule({ code: textureBlit }),
        //#endregion

        //#region Labeling
        contours: device.createShaderModule({ code: contours }),
        distanceTransformStep: device.createShaderModule({ code: distanceTransform }),
        // maxDT: device.createShaderModule({ code: maxDT }),
        maxDT: device.createShaderModule({ code: maxDT_1D }),
        maxDTAtomics: device.createShaderModule({ code: maxDTAtomics }),
        //#endregion
    };

    // console.timeEnd('createShaderModules');

    return shaders;
}
