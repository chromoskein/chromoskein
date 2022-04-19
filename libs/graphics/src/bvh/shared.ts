import { vec3, vec4 } from "gl-matrix";
import { CullObject, CullPlane } from "../culling";
import { LL_STRUCTURE_SIZE_BYTES, LowLevelStructure } from "../primitives";
import { QuadraticBezier } from "../primitives/quadratic_bezier";
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
        case 'Sphere': result = intersectSphere(primitive, ray, offset); break;
        case 'Cylinder': result = intersectCylinder(primitive, ray, offset); break;
        case 'AABB': result = intersectAABB(primitive, ray, offset); break;
        case 'RoundedCone': result = intersectRoundedConeWithCutPlanes(primitive, ray, offset, cullObjects); break;
        case 'QuadraticBezierCurve': result = intersectQuadraticBezier(primitive, ray, offset, cullObjects); break;
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
export class RayBezierIntersection {
    co: vec3 = vec3.create();
    cd: vec3 = vec3.create();
    s: number = 0.0;
    dt: number = 0.0;
    dp: number = 0.0;
    dc: number = 0.0;
    sp: number = 0.0;
    phantom = true;

    constructor(
        co: vec3,
        cd: vec3,
        s: number,
        dt: number,
        dp: number,
        dc: number,
        sp: number,
        phantom: boolean,
    ) {
        this.co = co;
        this.cd = cd;
        this.s = s;
        this.dt = dt;
        this.dp = dp;
        this.dc = dc;
        this.sp = sp;
        this.phantom = phantom;
    }
};

export function rayBezierIntersectStep(intersectionIn: RayBezierIntersection, r: number): RayBezierIntersection {
    let r2: number = r * r;
    let drr: number = 0.0;

    let intersectionOut: RayBezierIntersection = new RayBezierIntersection(
        intersectionIn.co,
        intersectionIn.cd,
        intersectionIn.s,
        intersectionIn.dt,
        intersectionIn.dp,
        intersectionIn.dc,
        intersectionIn.sp,
        intersectionIn.phantom
    );

    let co = intersectionIn.co;
    let cd = intersectionIn.cd;

    let ddd = cd[0] * cd[0] + cd[1] * cd[1];
    intersectionOut.dp = co[0] * co[0] + co[1] * co[1];
    let cdd = co[0] * cd[0] + co[1] * cd[1];
    let cxd = co[0] * cd[1] - co[1] * cd[0];

    let c = ddd;
    let b = cd[2] * (drr - cdd);
    let cdz2 = cd[2] * cd[2];
    ddd = ddd + cdz2;
    let a = 2.0 * drr * cdd + cxd * cxd - ddd * r2 + intersectionOut.dp * cdz2;

    let discr = b * b - a * c;
    if (discr > 0.0) {
        intersectionOut.s = (b - Math.sqrt(discr)) / c;
    } else {
        intersectionOut.s = (b - 0.0) / c;
    }
    intersectionOut.dt = (intersectionOut.s * cd[2] - cdd) / ddd;
    intersectionOut.dc = intersectionOut.s * intersectionOut.s + intersectionOut.dp;
    intersectionOut.sp = cdd / cd[2];
    intersectionOut.dp = intersectionOut.dp + intersectionOut.sp * intersectionOut.sp;
    intersectionOut.phantom = discr > 0.0;

    return intersectionOut;
}

export function make_orthonormal_basis(n: vec3): Array<vec3> {
    let b1: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    let b2: vec3 = vec3.fromValues(0.0, 0.0, 0.0);

    if (n[2] < 0.0) {
        let a = 1.0 / (1.0 - n[2]);
        let b = n[0] * n[1] * a;

        b1 = vec3.fromValues(1.0 - n[0] * n[0] * a, -b, n[0]);
        b2 = vec3.fromValues(b, n[1] * n[1] * a - 1.0, -n[1]);
    } else {
        let a = 1.0 / (1.0 + n[2]);
        let b = -n[0] * n[1] * a;

        b1 = vec3.fromValues(1.0 - n[0] * n[0] * a, b, -n[0]);
        b2 = vec3.fromValues(b, 1.0 - n[1] * n[1] * a, -n[1]);
    }

    return new Array(b1, b2);
}

export function transformToRayFramePoint(p: vec3, origin: vec3, u: vec3, v: vec3, w: vec3): vec3 {
    let q: vec3 = vec3.sub(vec3.create(), p, origin);
    return vec3.fromValues(vec3.dot(q, u), vec3.dot(q, v), vec3.dot(q, w));
}

export function transformToRayFrame(ray: Ray, curve: QuadraticBezier): QuadraticBezier {
    const onb = make_orthonormal_basis(ray.direction);

    return new QuadraticBezier(
        transformToRayFramePoint(curve.p0, ray.origin, onb[0], onb[1], ray.direction),
        transformToRayFramePoint(curve.p1, ray.origin, onb[0], onb[1], ray.direction),
        transformToRayFramePoint(curve.p2, ray.origin, onb[0], onb[1], ray.direction),
    );
}

export class CurveIntersectionResult {
    rayT = 0.0;
    curveT = 0.0;
    hit = false;
};

export function rayQuadraticBezierIntersection(ray: Ray, curve: QuadraticBezier, r: number): CurveIntersectionResult {
    let result: CurveIntersectionResult = new CurveIntersectionResult();

    let tstart = 1.0;
    if (vec3.dot(vec3.sub(vec3.create(), curve.p2, curve.p0), ray.direction) > 0.0) {
        tstart = 0.0;
    }

    for (let ep = 0; ep < 2; ep = ep + 1) {
        let t = tstart;

        let rci: RayBezierIntersection = new RayBezierIntersection(
            vec3.fromValues(0.0, 0.0, 0.0),
            vec3.fromValues(0.0, 0.0, 0.0),
            0.0,
            0.0,
            0.0,
            0.0,
            0.0,
            true
        );

        let told = 0.0;
        let dt1 = 0.0;
        let dt2 = 0.0;

        for (let i = 0; i < 16; i = i + 1) {
            rci.co = curve.evaluate(t);
            rci.cd = curve.evaluateDifferential(t);
      
            rci = rayBezierIntersectStep(rci, r);

            if (rci.phantom && Math.abs(rci.dt) < 0.01) {
                rci.s = rci.s + rci.co[2];

                result.rayT = rci.s;
                result.curveT = t;
                result.hit = true;

                break;
            }

            rci.dt = Math.min(rci.dt, 0.5);
            rci.dt = Math.max(rci.dt, -0.5);

            dt1 = dt2;
            dt2 = rci.dt;

            // Regula falsi
            if (dt1 * dt2 < 0.0) {
                let tnext = 0.0;
                if ((i & 3) == 0) {
                    tnext = 0.5 * (told + t);
                } else {
                    tnext = (dt2 * told - dt1 * t) / (dt2 - dt1);
                }
                told = t;
                t = tnext;
            } else {
                told = t;
                t = t + rci.dt;
            }

            if (t < 0.0 || t > 1.0) {
                break;
            }
        }

        if (!result.hit) {
            tstart = 1.0 - tstart;
        } else {
            break;
        }
    }

    return result;
}

export function intersectQuadraticBezier(buffer: DataView, ray: Ray, offset: number, cullObjects: Array<CullObject> = []): number {
    const byteOffset = offset * LL_STRUCTURE_SIZE_BYTES;

    const p0 = vec3.fromValues(
        buffer.getFloat32(byteOffset + 0, true),
        buffer.getFloat32(byteOffset + 4, true),
        buffer.getFloat32(byteOffset + 8, true),
    );

    const p1 = vec3.fromValues(
        buffer.getFloat32(byteOffset + 16, true),
        buffer.getFloat32(byteOffset + 20, true),
        buffer.getFloat32(byteOffset + 24, true),
    );

    const p2 = vec3.fromValues(
        buffer.getFloat32(byteOffset + 32, true),
        buffer.getFloat32(byteOffset + 36, true),
        buffer.getFloat32(byteOffset + 40, true),
    );

    const radius = buffer.getFloat32(byteOffset + 12, true);

    let curve = new QuadraticBezier(p0, p1, p2);
    curve = transformToRayFrame(ray, curve);
    const curveIntersection = rayQuadraticBezierIntersection(ray, curve, radius);

    const intersection = vec3.add(vec3.create(), ray.origin, vec3.scale(vec3.create(), ray.direction, curveIntersection.rayT));

    if (curveIntersection.hit && curveIntersection.rayT > 0.0) {
        // for (const cullObject of cullObjects) {
        //     if (cullObject instanceof CullPlane && cullObject.cullsPoint(intersection)) {
        //         const planeNormal = cullObject.normal;
        //         const denom = vec3.dot(ray.direction, planeNormal);

        //         const planeT = vec3.dot(vec3.sub(vec3.create(), cullObject.point, ray.origin), planeNormal) / denom;

        //         if (planeT > 0.0 && planeT > curveIntersection.rayT) {
        //             return planeT;
        //         } else {
        //             return -1.0;
        //         }
        //     }
        // }

        return curveIntersection.rayT;
    }

    return -1.0;
}