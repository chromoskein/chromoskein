import { LowLevelStructure, LL_STRUCTURE_SIZE_BYTES } from "./shared";
import { vec3 } from "gl-matrix";
import { BoundingBox, BoundingBoxEmpty, BoundingBoxExtendByPoint } from "../shared";

export function writeCylinderToArrayBuffer(
    view: DataView,
    offset: number,
    from: vec3,
    to: vec3,
    radius: number,
    color: vec3 = vec3.fromValues(1.0, 1.0, 1.0)
): void {
    const offsetBytes = offset * LL_STRUCTURE_SIZE_BYTES;

    view.setFloat32(offsetBytes + 0, from[0], true);
    view.setFloat32(offsetBytes + 4, from[1], true);
    view.setFloat32(offsetBytes + 8, from[2], true);
    view.setFloat32(offsetBytes + 12, radius, true);

    view.setFloat32(offsetBytes + 16, to[0], true);
    view.setFloat32(offsetBytes + 20, to[1], true);
    view.setFloat32(offsetBytes + 24, to[2], true);
    view.setFloat32(offsetBytes + 28, radius, true);

    view.setFloat32(offsetBytes + 32, color[0], true);
    view.setFloat32(offsetBytes + 36, color[1], true);
    view.setFloat32(offsetBytes + 40, color[2], true);

    view.setInt32(offsetBytes + 124, LowLevelStructure.Cylinder, true);
}

export function cylinderToBoundingBox(view: DataView, offset: number): BoundingBox {
    const result = BoundingBoxEmpty();

    const cylinderFrom = vec3.fromValues(
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 0, true),
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 4, true),
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 8, true)
    );
    const cylinderRadius = view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 12, true);
    const cylinderTo = vec3.fromValues(
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 16, true),
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 20, true),
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 24, true)
    );

    const a = vec3.sub(vec3.create(), cylinderTo, cylinderFrom);
    const d = (1.0 / vec3.dot(a, a));
    const e = vec3.create();
    e[0] = cylinderRadius * Math.sqrt(1.0 - a[0] * a[0] * d);
    e[1] = cylinderRadius * Math.sqrt(1.0 - a[1] * a[1] * d);
    e[2] = cylinderRadius * Math.sqrt(1.0 - a[2] * a[2] * d);

    result.min = vec3.min(vec3.create(), vec3.sub(vec3.create(), cylinderFrom, e), vec3.sub(vec3.create(), cylinderTo, e));
    result.max = vec3.max(vec3.create(), vec3.add(vec3.create(), cylinderFrom, e), vec3.add(vec3.create(), cylinderTo, e));

    return result;
}

export function aabbToBoundingBox(view: DataView, offset: number): BoundingBox {
    const result = BoundingBoxEmpty();

    const from = vec3.fromValues(
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 0, true),
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 4, true),
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 8, true)
    );
    const to = vec3.fromValues(
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 16, true),
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 20, true),
        view.getFloat32(offset * LL_STRUCTURE_SIZE_BYTES + 24, true)
    );

    BoundingBoxExtendByPoint(result, from);
    BoundingBoxExtendByPoint(result, to);

    return result;
}


