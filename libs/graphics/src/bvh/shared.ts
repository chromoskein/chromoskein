import { vec3, vec4 } from "gl-matrix";
import { CullObject, CullPlane } from "../culling";
import { LL_STRUCTURE_SIZE_BYTES, LowLevelStructure } from "../primitives";
import { BoundingBox, BoundingBoxEmpty, Ray } from "../shared";

export const NODE_SIZE = 12;
export const NODE_SIZE_BYTES: number = NODE_SIZE * 4;

export const BOUNDING_BOX_SIZE = 8;
export const BOUNDING_BOX_SIZE_BYTES: number = NODE_SIZE * 4;

export type Node = {
    boundingBox: BoundingBox;
    primitiveCount: number;
    firstChildOrPrimitive: number;
    axis: number;
}

export function NodeEmpty(): Node {
    return {
        boundingBox: BoundingBoxEmpty(),
        primitiveCount: 0,
        firstChildOrPrimitive: 0,
        axis: 0,
    }
}

export function NodeIsLeaf(node: Node): boolean {
    return node.primitiveCount != 0;
}

export function intersectPrimitive(primitive: DataView, ray: Ray, offset: number, cullObjects: Array<CullObject> = []): number {
    const byteOffset = offset * LL_STRUCTURE_SIZE_BYTES;
    const ty = LowLevelStructure[primitive.getInt32(byteOffset + 124, true)];

    let result;
    switch (ty) {
        //case 'Sphere': result = intersectSphere(primitive, ray, offset); break;
        case 'Cylinder': result = intersectCylinder(primitive, ray, offset); break;
        case 'AABB': result = intersectAABB(primitive, ray, offset); break;
        case 'RoundedCone': result = intersectRoundedConeWithCutPlanes(primitive, ray, offset, cullObjects); break;
        default: result = -1.0;
    }

    if (isNaN(result) || !isFinite(result)) {
        return -1.0;
    }

    return result;
}

export function intersectSphere(sphere: DataView, ray: Ray, offset: number): number {
    const byteOffset = offset * LL_STRUCTURE_SIZE_BYTES;

    const spherePosition = vec3.fromValues(
        sphere.getFloat32(byteOffset + 0, true),
        sphere.getFloat32(byteOffset + 4, true),
        sphere.getFloat32(byteOffset + 8, true)
    );
    const sphereRadius = sphere.getFloat32(12, true);

    const a = vec3.dot(ray.direction, ray.direction);
    const s0_r0 = vec3.sub(vec3.create(), ray.origin, spherePosition);
    const b = 2.0 * vec3.dot(ray.direction, s0_r0);
    const c = vec3.dot(s0_r0, s0_r0) - (sphereRadius * sphereRadius);
    if (b * b - 4.0 * a * c < 0.0) {
        return -1.0;
    }
    return (-b - Math.sqrt((b * b) - 4.0 * a * c)) / (2.0 * a);
}

export function intersectCylinder(cylinder: DataView, ray: Ray, offset: number): number {
    const byteOffset = offset * LL_STRUCTURE_SIZE_BYTES;

    const cylinderFrom = vec3.fromValues(
        cylinder.getFloat32(byteOffset + 0, true),
        cylinder.getFloat32(byteOffset + 4, true),
        cylinder.getFloat32(byteOffset + 8, true)
    );
    const cylinderRadius = cylinder.getFloat32(12, true);
    const cylinderTo = vec3.fromValues(
        cylinder.getFloat32(byteOffset + 16, true),
        cylinder.getFloat32(byteOffset + 20, true),
        cylinder.getFloat32(byteOffset + 24, true)
    );

    const ba = vec3.sub(vec3.create(), cylinderTo, cylinderFrom);
    const oc = vec3.sub(vec3.create(), ray.origin, cylinderFrom);

    const baba = vec3.dot(ba, ba);
    const bard = vec3.dot(ba, ray.direction);
    const baoc = vec3.dot(ba, oc);

    const k2 = baba - bard * bard;
    const k1 = baba * vec3.dot(oc, ray.direction) - baoc * bard;
    const k0 = baba * vec3.dot(oc, oc) - baoc * baoc - cylinderRadius * cylinderRadius * baba;

    let h = k1 * k1 - k2 * k0;
    if (h < 0.0) {
        return -1.0;
    }
    h = Math.sqrt(h);
    let t = (-k1 - h) / k2;

    // body
    const y = baoc + t * bard;
    if (y > 0.0 && y < baba) {
        return t;
    }

    // caps
    if (y < 0.0) {
        t = -baoc / bard;
    } else {
        t = (baba - baoc) / bard;
    }

    if (Math.abs(k1 + k2 * t) < h) {
        return t;
    }

    return -1.0;
}

export function intersectAABB(sphere: DataView, ray: Ray, offset: number): number {
    return -1.0;
}

export function intersectRoundedCone(roundedCone: DataView, ray: Ray, offset: number): number {
    const byteOffset = offset * LL_STRUCTURE_SIZE_BYTES;

    const from = vec3.fromValues(
        roundedCone.getFloat32(byteOffset + 0, true),
        roundedCone.getFloat32(byteOffset + 4, true),
        roundedCone.getFloat32(byteOffset + 8, true)
    );
    const radius = roundedCone.getFloat32(byteOffset + 12, true);
    const to = vec3.fromValues(
        roundedCone.getFloat32(byteOffset + 16, true),
        roundedCone.getFloat32(byteOffset + 20, true),
        roundedCone.getFloat32(byteOffset + 24, true)
    );

    const ba = vec3.sub(vec3.create(), to, from);
    const oa = vec3.sub(vec3.create(), ray.origin, from);
    const ob = vec3.sub(vec3.create(), ray.origin, to);

    const rr = radius - radius;
    const m0 = vec3.dot(ba, ba);
    const m1 = vec3.dot(ba, oa);
    const m2 = vec3.dot(ba, ray.direction);
    const m3 = vec3.dot(ray.direction, oa);
    const m5 = vec3.dot(oa, oa);
    const m6 = vec3.dot(ob, ray.direction);
    const m7 = vec3.dot(ob, ob);

    const d2 = m0 - rr * rr;

    const k2 = d2 - m2 * m2;
    const k1 = d2 * m3 - m1 * m2 + m2 * rr * radius;
    const k0 = d2 * m5 - m1 * m1 + m1 * rr * radius * 2.0 - m0 * radius * radius;

    const h = k1 * k1 - k0 * k2;

    if (h < 0.0) {
        return -1.0;
    }

    let t = (-Math.sqrt(h) - k1) / k2;

    const y = m1 - radius * rr + t * m2;
    if (y > 0.0 && y < d2) {
        return t;
    }

    const h1 = m3 * m3 - m5 + radius * radius;
    const h2 = m6 * m6 - m7 + radius * radius;
    if (Math.max(h1, h2) < 0.0) {
        return -1.0;
    }

    let r = (100000000.0);
    if (h1 > 0.0) {
        t = -m3 - Math.sqrt(h1);
        r = t;
    }
    if (h2 > 0.0) {
        t = -m6 - Math.sqrt(h2);
        if (t < r) {
            r = t;
        }
    }

    return r;
}

export function distanceRoundedCone(roundedCone: DataView, ray: Ray, offset: number, point: vec3): number {
    const byteOffset = offset * LL_STRUCTURE_SIZE_BYTES;

    const a = vec3.fromValues(
        roundedCone.getFloat32(byteOffset + 0, true),
        roundedCone.getFloat32(byteOffset + 4, true),
        roundedCone.getFloat32(byteOffset + 8, true)
    );
    const b = vec3.fromValues(
        roundedCone.getFloat32(byteOffset + 16, true),
        roundedCone.getFloat32(byteOffset + 20, true),
        roundedCone.getFloat32(byteOffset + 24, true)
    );
    const r1 = roundedCone.getFloat32(byteOffset + 12, true);
    const r2 = r1;

    // sampling independent computations (only depend on shape)
    const ba = vec3.sub(vec3.create(), b, a);
    const l2 = vec3.dot(ba, ba);
    const rr = r1 - r2;
    const a2 = l2 - rr * rr;
    const il2 = 1.0 / l2;

    // sampling dependant computations
    const pa = vec3.sub(vec3.create(), point, a);
    const y = vec3.dot(pa, ba);
    const z = y - l2;
    const x2Help = vec3.sub(vec3.create(), vec3.scale(vec3.create(), pa, l2), vec3.scale(vec3.create(), ba, y));
    const x2 = vec3.dot(x2Help, x2Help);
    const y2 = y * y * l2;
    const z2 = z * z * l2;

    // single square root!
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * a2 * z2 > k) { return Math.sqrt(x2 + z2) * il2 - r2; }
    if (Math.sign(y) * a2 * y2 < k) { return Math.sqrt(x2 + y2) * il2 - r1; }

    return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

export function intersectRoundedConeWithCutPlanes(roundedCone: DataView, ray: Ray, offset: number, cullObjects: Array<CullObject> = []): number {
    const byteOffset = offset * LL_STRUCTURE_SIZE_BYTES;

    const leftPlane = vec4.fromValues(
        roundedCone.getFloat32(byteOffset + 32, true),
        roundedCone.getFloat32(byteOffset + 36, true),
        roundedCone.getFloat32(byteOffset + 40, true),
        roundedCone.getFloat32(byteOffset + 44, true)
    );

    const rightPlane = vec4.fromValues(
        roundedCone.getFloat32(byteOffset + 48, true),
        roundedCone.getFloat32(byteOffset + 52, true),
        roundedCone.getFloat32(byteOffset + 56, true),
        roundedCone.getFloat32(byteOffset + 60, true)
    );

    const t = intersectRoundedCone(roundedCone, ray, offset);

    const nullVector = vec4.fromValues(0.0, 0.0, 0.0, 0.0);
    const intersection = vec3.add(vec3.create(), ray.origin, vec3.scale(vec3.create(), ray.direction, t));
    const intersectionVec4 = vec4.fromValues(intersection[0], intersection[1], intersection[2], 1.0);

    // if (!vec4.exactEquals(nullVector, leftPlane) && vec4.dot(leftPlane, intersectionVec4) > 0.0) {
    //     return -1.0;
    // }

    // if (!vec4.exactEquals(nullVector, rightPlane) && vec4.dot(rightPlane, intersectionVec4) > 0.0) {
    //     return -1.0;
    // }

    if (t > 0.0) {
        for (const cullObject of cullObjects) {
            if (cullObject instanceof CullPlane && cullObject.cullsPoint(intersection)) {
                const planeNormal = cullObject.normal;
                const denom = vec3.dot(ray.direction, planeNormal);

                const planeT = vec3.dot(vec3.sub(vec3.create(), cullObject.point, ray.origin), planeNormal) / denom;
                const planeIntersection = vec3.add(vec3.create(), ray.origin, vec3.scale(vec3.create(), ray.direction, planeT));
                const coneDistance = distanceRoundedCone(roundedCone, ray, offset, planeIntersection);

                if (planeT > 0.0 && planeT > t && coneDistance < 0.0) {
                    return planeT;
                } else {
                    return -1.0;
                }
            }
        }
    }

    return t;
}
