// Operations on bezier curve:
// - evaluate
// - evaluate differential
// - split
// - compute AABB
// - 

//
struct QuadraticBezierCurve {
    p0: vec3<f32>,    
    p1: vec3<f32>,
    p2: vec3<f32>,
    radius: f32,
};

fn evaluateQuadraticBezier(curve: QuadraticBezierCurve, t: f32) -> vec3<f32> {
    let p0: vec3<f32> = curve.p0.xyz;
    let p1: vec3<f32> = curve.p1.xyz;
    let p2: vec3<f32> = curve.p2.xyz;
    let tinv: f32 = 1.0 - t;
    
    return tinv * tinv * p0 + 2.0 * tinv * t * p1+ t * t * p2;
}

fn evaluateDifferentialQuadraticBezier(curve: QuadraticBezierCurve, t: f32) -> vec3<f32> {
    let p0: vec3<f32> = curve.p0.xyz;
    let p1: vec3<f32> = curve.p1.xyz;
    let p2: vec3<f32> = curve.p2.xyz;
    let tinv: f32 = 1.0 - t;

    return 2.0 * tinv * (p1 - p0) + 2.0 * t * (p2 - p1);
}

fn evaluateSecondDifferentialQuadraticBezier(curve: QuadraticBezierCurve, t: f32) -> vec3<f32> {
    let p0: vec3<f32> = curve.p0.xyz;
    let p1: vec3<f32> = curve.p1.xyz;
    let p2: vec3<f32> = curve.p2.xyz;
    let tinv: f32 = 1.0 - t;

    return 2.0 * (p2 - 2.0 * p1 + p0);
}

fn splitQuadraticBezier(curve: QuadraticBezierCurve, t: f32) -> array<QuadraticBezierCurve, 2> {
    return array<QuadraticBezierCurve, 2>(
        QuadraticBezierCurve(
            curve.p0,            
            t * curve.p1 - (t - 1.0) * curve.p0,
            t * t * curve.p2 - 2.0 * t * (t - 1.0) * curve.p1 + (t - 1.0)*(t - 1.0)*curve.p0,
            curve.radius
        ),
        QuadraticBezierCurve(
            t * t * curve.p2 - 2.0 * t * (t - 1.0) * curve.p1 + (t - 1.0)*(t - 1.0)*curve.p0,            
            t * curve.p2 - (t - 1.0) * curve.p1,
            curve.p2,
            curve.radius
        )
    );
}

fn distanceToCylinderQuadraticBezier(curve: QuadraticBezierCurve, pt: vec3<f32>) -> f32 {
    return length(cross(pt - curve.p0.xyz, pt - curve.p2.xyz)) / length(curve.p2.xyz - curve.p0.xyz);
}

fn transformToRayFramePoint(p: vec3<f32>, 
                            origin: vec3<f32>,
                            u: vec3<f32>,
                            v: vec3<f32>,
                            w: vec3<f32>) -> vec3<f32> {
    let q: vec3<f32> = p - origin;
    return vec3<f32>(dot(q, u) , dot(q, v) , dot(q, w));
}

fn transformToRayFrame(ray: Ray, curve: QuadraticBezierCurve) -> QuadraticBezierCurve {
    let onb: array<vec3<f32>, 2> = make_orthonormal_basis(ray.direction);

    return QuadraticBezierCurve(
        transformToRayFramePoint(curve.p0.xyz, ray.origin, onb[0], onb[1], ray.direction),        
        transformToRayFramePoint(curve.p1.xyz, ray.origin, onb[0], onb[1], ray.direction),
        transformToRayFramePoint(curve.p2.xyz, ray.origin, onb[0], onb[1], ray.direction),
        curve.radius,
    );
}

//
// struct CubicBezierCurve {
//     p0: vec4<f32>;
//     p1: vec4<f32>;
//     p2: vec4<f32>;
//     p3: vec4<f32>;
// };

// fn evaluateCubicBezier(curve: CubicBezierCurve, t: f32) -> vec3<f32> {
//     let p0: vec3<f32> = curve.p0.xyz;
//     let p1: vec3<f32> = curve.p1.xyz;
//     let p2: vec3<f32> = curve.p2.xyz;
//     let p3: vec3<f32> = curve.p3.xyz;
//     let tinv: f32 = 1.0 - t;

//     return tinv * tinv * tinv * p0
//          + 3.0  * tinv * tinv * t * p1
//             + 3.0  * tinv * t * t * p2
//                       + t * t * t * p3;
// }

// fn evaluateDifferentialCubicBezier(curve: CubicBezierCurve, t: f32) -> vec3<f32> {
//     let p0: vec3<f32> = curve.p0.xyz;
//     let p1: vec3<f32> = curve.p1.xyz;
//     let p2: vec3<f32> = curve.p2.xyz;
//     let p3: vec3<f32> = curve.p3.xyz;
//     let tinv: f32 = 1.0 - t;

//     return -3.0 * tinv * tinv * p0
//           + 3.0 * (3.0 * t * t - 4.0 * t + 1.0) * p1
//                     + 3.0 * (2.0 - 3.0 * t) * t * p2
//                                     + 3.0 * t * t * p3;
// }

// fn splitCubicBezier(curve: CubicBezierCurve, t: f32) -> array<CubicBezierCurve, 2> {
//     let p0: vec3<f32> = curve.p0.xyz;
//     let p1: vec3<f32> = curve.p1.xyz;
//     let p2: vec3<f32> = curve.p2.xyz;
//     let p3: vec3<f32> = curve.p3.xyz;

//     let q0: vec3<f32> = (p0 + p1) * t;
//     let q1: vec3<f32> = (p1 + p2) * t;
//     let q2: vec3<f32> = (p2 + p3) * t;

//     let r0: vec3<f32> = (q0 + q1) * t;
//     let r1: vec3<f32> = (q1 + q2) * t;

//     let s0: vec3<f32> = (r0 + r1) * t;

//     return array<CubicBezierCurve, 2>(
//         CubicBezierCurve(vec4<f32>(p0, 1.0), vec4<f32>(q0, 1.0), vec4<f32>(r0, 1.0), vec4<f32>(s0, 1.0)),
//         CubicBezierCurve(vec4<f32>(s0, 1.0), vec4<f32>(r1, 1.0), vec4<f32>(q2, 1.0), vec4<f32>(p3, 1.0)),
//     );
// }

struct RayBezierIntersection
{
    co: vec3<f32>,
    cd: vec3<f32>,
    s: f32,
    dt: f32,
    dp: f32,
    dc: f32,
    sp: f32,
    phantom: bool,
};

fn rayBezierIntersect(intersectionIn: RayBezierIntersection, r: f32) -> RayBezierIntersection {
    let r2: f32  = r * r;
    let drr: f32 = 0.0;

    var intersectionOut: RayBezierIntersection = RayBezierIntersection(
        intersectionIn.co,
        intersectionIn.cd,
        intersectionIn.s,
        intersectionIn.dt,
        intersectionIn.dp,
        intersectionIn.dc,
        intersectionIn.sp,
        intersectionIn.phantom
    );

    let co: vec3<f32> = intersectionIn.co;
    let cd: vec3<f32> = intersectionIn.cd;

    var ddd: f32 = cd.x * cd.x + cd.y * cd.y;
    intersectionOut.dp = co.x * co.x + co.y * co.y;
    let cdd: f32 = co.x * cd.x + co.y * cd.y;
    let cxd: f32 = co.x * cd.y - co.y * cd.x;

    let c: f32 = ddd;
    let b: f32 = cd.z * (drr - cdd);
    let cdz2: f32 = cd.z * cd.z;
    ddd = ddd + cdz2;
    let a: f32 = 2.0 * drr * cdd + cxd * cxd - ddd * r2 + intersectionOut.dp * cdz2;

    let discr: f32 = b * b - a * c;
    if (discr > 0.0) {
        intersectionOut.s   = (b - sqrt(discr)) / c;
    } else {
        intersectionOut.s   = (b - 0.0) / c;
    }    
    intersectionOut.dt  = (intersectionOut.s * cd.z - cdd) / ddd;
    intersectionOut.dc  = intersectionOut.s * intersectionOut.s + intersectionOut.dp;
    intersectionOut.sp  = cdd / cd.z;
    intersectionOut.dp  = intersectionOut.dp + intersectionOut.sp * intersectionOut.sp;
    intersectionOut.phantom = discr > 0.0;

    return intersectionOut;
}