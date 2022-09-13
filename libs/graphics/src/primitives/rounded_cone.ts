import { vec3, vec4 } from "gl-matrix";
import { GraphicsLibrary } from "..";
import { ArrayViews, LinearImmutableArray } from "../allocators/";
import { BoundingBox, BoundingBoxCalculateCenter, BoundingBoxEmpty } from "../shared";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE, LL_STRUCTURE_SIZE_BYTES } from "./shared";

export function writeRoundedConeToArrayBuffer(
    array: LinearImmutableArray,
    offset: number,
    {
        from = null,
        to = null,
        radius = null,
        leftPlane = null,
        rightPlane = null,
        color = null,
        color2 = null,
        borderColor = null,
        borderColor2 = null,
        borderRatio = 0.0,
        selectionId = -1.0,
        selectionId2 = -1.0,
        cull = true,
    }: {
        from?: vec3 | null;
        to?: vec3 | null;
        radius?: number | null;
        leftPlane?: vec4 | null;
        rightPlane?: vec4 | null;
        color?: vec4 | null;
        color2?: vec4 | null;
        borderColor?: vec4 | null;
        borderColor2?: vec4 | null;
        borderRatio?: number | null;
        selectionId?: number | null;
        selectionId2?: number | null;
        cull?: boolean | null;
    } = {}
): void {
    const offsetBytes = offset * LL_STRUCTURE_SIZE_BYTES;
    const offsetWords = offset * LL_STRUCTURE_SIZE;

    if (from) {
        array.f32View.set([from[0], from[1], from[2]], offsetWords + 0);
    }

    if (to) {
        array.f32View.set([to[0], to[1], to[2]], offsetWords + 4);
    }

    if (radius != null) {
        array.f32View.set([radius], offsetWords + 3);
        array.f32View.set([radius], offsetWords + 7);
    }

    if (color) {
        array.u8view.set([color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255], offsetBytes + 64);
    }

    if (color2) {
        array.u8view.set([color2[0] * 255, color2[1] * 255, color2[2] * 255, color2[3] * 255], offsetBytes + 68);
    }

    if (cull != null) {
        array.u32View.set([cull ? 1 : 0], offsetWords + 20);
    }

    if (selectionId) {
        array.f32View.set([selectionId], /* TODO: is this right? */ offsetWords + 24);
    }

    if (selectionId2) {
        array.f32View.set([selectionId2], /* TODO: is this right? */ offsetWords + 28);
    }

    array.i32View.set([LowLevelStructure.RoundedCone], offsetWords + 31);
}

export function roundedConeToBoundingBox(array: ArrayViews, offset: number): BoundingBox {
    const result = BoundingBoxEmpty();

    const cylinderFrom = vec3.fromValues(
        array.f32View[offset * LL_STRUCTURE_SIZE + 0],
        array.f32View[offset * LL_STRUCTURE_SIZE + 1],
        array.f32View[offset * LL_STRUCTURE_SIZE + 2]
    );
    const cylinderRadius = array.f32View[offset * LL_STRUCTURE_SIZE + 3];
    const cylinderTo = vec3.fromValues(
        array.f32View[offset * LL_STRUCTURE_SIZE + 4],
        array.f32View[offset * LL_STRUCTURE_SIZE + 5],
        array.f32View[offset * LL_STRUCTURE_SIZE + 6]
    );

    const a = vec3.sub(vec3.create(), cylinderTo, cylinderFrom);

    const directionExpand = vec3.normalize(vec3.create(), a);
    vec3.scale(directionExpand, directionExpand, cylinderRadius * 1.1);

    vec3.add(cylinderTo, cylinderTo, directionExpand);
    vec3.negate(directionExpand, directionExpand);
    vec3.add(cylinderFrom, cylinderFrom, directionExpand);

    const d = (1.0 / vec3.dot(a, a));
    const e = vec3.create();
    e[0] = cylinderRadius * Math.sqrt(1.0 - a[0] * a[0] * d);
    e[1] = cylinderRadius * Math.sqrt(1.0 - a[1] * a[1] * d);
    e[2] = cylinderRadius * Math.sqrt(1.0 - a[2] * a[2] * d);

    result.min = vec3.min(vec3.create(), vec3.sub(vec3.create(), cylinderFrom, e), vec3.sub(vec3.create(), cylinderTo, e));
    result.max = vec3.max(vec3.create(), vec3.add(vec3.create(), cylinderFrom, e), vec3.add(vec3.create(), cylinderTo, e));
    BoundingBoxCalculateCenter(result);

    return result;
}
