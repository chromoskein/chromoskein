export const beziers = (writeDepth: boolean) => { return /* wgsl */`
struct CurveIntersectionResult {
  rayT: f32;
  curveT: f32;
  hit: bool;
};

fn rayQuadraticBezierIntersection(ray: Ray, curve: QuadraticBezierCurve) -> CurveIntersectionResult {
  var result: CurveIntersectionResult = CurveIntersectionResult(
    0.0,
    0.0,
    false,
  );

  var tstart: f32 = 1.0;
  if (dot(curve.p2.xyz - curve.p0.xyz, ray.direction) > 0.0) {
    tstart = 0.0;
  } 

  for(var ep: i32 = 0; ep < 2; ep = ep + 1) {
    var t: f32 = tstart;

    var rci: RayBezierIntersection = RayBezierIntersection(
      vec3<f32>(0.0, 0.0, 0.0),
      vec3<f32>(0.0, 0.0, 0.0),
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      true
    );

    var told: f32 = 0.0;
    var dt1: f32 = 0.0;
    var dt2: f32 = 0.0;

    for(var i: i32 = 0; i < 80; i = i + 1) {
      rci.co = evaluateQuadraticBezier(curve, t);
      rci.cd = evaluateDifferentialQuadraticBezier(curve, t);

      rci = rayBezierIntersect(rci, curve.radius);
      
      if (rci.phantom && abs(rci.dt) < 0.00001) {
        rci.s = rci.s + rci.co.z;
        
        result.rayT = rci.s;
        result.curveT = t;
        result.hit = true;

        break;
      }

      rci.dt = min(rci.dt, 0.5);
      rci.dt = max(rci.dt, -0.5);

      dt1 = dt2;
      dt2 = rci.dt;

      // Regula falsi
      if (dt1 * dt2 < 0.0) {
        var tnext: f32 = 0.0;
        if((i & 3) == 0) {
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

      if(t < 0.0 || t > 1.0) {
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

fn quadraticBezierBoundingSphere(curve: QuadraticBezierCurve) -> Sphere {
  let thickness: f32 = curve.radius;

  let aabb_min: vec3<f32> = min(curve.p0.xyz, min(curve.p1.xyz, curve.p2.xyz));
  let aabb_max: vec3<f32> = max(curve.p0.xyz, max(curve.p1.xyz, curve.p2.xyz));

  return Sphere(
    0.5 * (aabb_max + aabb_min),
    0.5 * length(aabb_max - aabb_min) + thickness
  );
}

//
struct BufferQuadraticBezierCurve {
    p0: vec4<f32>;    
    p1: vec4<f32>;
    p2: vec4<f32>;

    colorFrom: vec4<f32>;

    padding: array<f32, 15>;

    ty: i32;
};


struct CurvesBuffer {
    curves:  array<BufferQuadraticBezierCurve>;
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read> curvesBuffer: CurvesBuffer;
@group(2) @binding(0) var<storage, read> cullObjectsBuffer: CullObjectsBuffer;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>;
  @location(0) p0 : vec3<f32>;
  @location(1) p1 : vec3<f32>;
  @location(2) p2 : vec3<f32>;
  @location(3) radius: f32;
  @location(4) color : vec3<f32>;
};

@stage(vertex)
fn main_vertex(@builtin(vertex_index) VertexIndex : u32,
               @builtin(instance_index) InstanceIndex : u32
) -> VertexOutput {
  let curveBuffer: BufferQuadraticBezierCurve = curvesBuffer.curves[InstanceIndex];

  if (curveBuffer.ty != 2) {
    return VertexOutput(
      vec4<f32>(0.0, 0.0, 0.0, 0.0), 
      vec3<f32>(0.0, 0.0, 0.0),
      vec3<f32>(0.0, 0.0, 0.0),
      vec3<f32>(0.0, 0.0, 0.0),
      0.0,
      vec3<f32>(0.0, 0.0, 0.0),
    );
  }

  let curve: QuadraticBezierCurve = QuadraticBezierCurve(
    curveBuffer.p0.xyz,
    curveBuffer.p1.xyz,
    curveBuffer.p2.xyz,
    curveBuffer.p0.w
  );

  let boundingSphere: Sphere = quadraticBezierBoundingSphere(curve);
  let boundingRectangle: BoundingRectangle = sphereBoundingRectangle(boundingSphere, camera.projectionView);

  var position: vec2<f32>;
  switch(i32(VertexIndex) % 4) {
    case 0: {
      position = boundingRectangle.center + vec2<f32>(-boundingRectangle.half_size.x, boundingRectangle.half_size.y);
    }
    case 1: {
      position = boundingRectangle.center +  vec2<f32>(boundingRectangle.half_size.x, boundingRectangle.half_size.y);
    }
    case 2: {
      position = boundingRectangle.center + vec2<f32>(-boundingRectangle.half_size.x, -boundingRectangle.half_size.y);
    }
    default: { // 3
      position = boundingRectangle.center + vec2<f32>(boundingRectangle.half_size.x, -boundingRectangle.half_size.y);
    }
  }

  var center: vec4<f32> = camera.view * vec4<f32>(boundingSphere.position, 1.0);
  center.z = center.z + boundingSphere.radius;
  center = camera.projection * center;
  center.z = center.z / center.w;

  return VertexOutput(
    vec4<f32>(position, center.z, 1.0), 
    curve.p0,
    curve.p1,
    curve.p2,
    curve.radius,
    curveBuffer.colorFrom.xyz,
  );
}

struct FragmentOutput {
  ${writeDepth ? '@builtin(frag_depth) fragmentDepth : f32;' : ''}
  @location(0) color : vec4<f32>;  
  ${writeDepth ? '@location(1) worldNormal : vec4<f32>;' : ''}  
};

@stage(fragment)
fn main_fragment(@builtin(position) Position : vec4<f32>, 
                 @location(0) p0 : vec3<f32>,
                 @location(1) p1 : vec3<f32>,
                 @location(2) p2 : vec3<f32>,
                 @location(3) radius: f32,
                 @location(4) color : vec3<f32>,
                 ) -> FragmentOutput {
  // Fragment in framebuffer/window coordinates
  var fragmentScreenSpace: vec4<f32> = vec4<f32>(Position.xyz, 1.0); 

  // Define curve
  let curve_ws: QuadraticBezierCurve = QuadraticBezierCurve(p0, p1, p2, radius);

  var fragmentNormalizedSpace: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  fragmentNormalizedSpace.x = fragmentScreenSpace.x;
  fragmentNormalizedSpace.y = fragmentScreenSpace.y;
  fragmentNormalizedSpace.x = (fragmentNormalizedSpace.x / camera.viewportSize.x) * 2.0 - 1.0;
  fragmentNormalizedSpace.y = (1.0 - (fragmentNormalizedSpace.y / camera.viewportSize.y)) * 2.0 - 1.0;

  // Fragment in view space
  var fragmentViewSpace: vec4<f32> = camera.projectionInverse * fragmentNormalizedSpace;
  fragmentViewSpace.z = -1.0;
  fragmentViewSpace.w = 1.0;

  // Fragment in word space
  let fragmentWorldSpace: vec4<f32>  = camera.viewInverse * fragmentViewSpace;

  // Ray
  let ray: Ray = Ray(
    camera.position.xyz,
    normalize((fragmentWorldSpace - camera.position).xyz)
  );

  // Transform the curve to ray-centric coordinates
  var curve: QuadraticBezierCurve = transformToRayFrame(ray, curve_ws);

  // 
  let result: CurveIntersectionResult = rayQuadraticBezierIntersection(ray, curve);

  var intersection: vec3<f32> = ray.origin + result.rayT * ray.direction;
  var normal: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);
  var depth: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 0.0);

  if (!result.hit) {
    let startDiskNormal = normalize(evaluateDifferentialQuadraticBezier(curve_ws, 0.0));
    let startDiskIntersection = rayDiskIntersection(ray, Disk(
      evaluateQuadraticBezier(curve_ws, 0.0),
      normalize(evaluateDifferentialQuadraticBezier(curve_ws, 0.0)),
      radius,
    ));

    let endDiskNormal = -normalize(evaluateDifferentialQuadraticBezier(curve_ws, 1.0));
    let endDiskIntersection = rayDiskIntersection(ray, Disk(
      evaluateQuadraticBezier(curve_ws, 1.0),
      endDiskNormal,
      radius,
    ));

    if (startDiskIntersection.w >= 0.0) {
      intersection = startDiskIntersection.xyz;
      normal = -startDiskNormal;
      depth = camera.projectionView * vec4<f32>(startDiskIntersection.xyz, 1.0);
      depth = depth * (1.0 / depth.w);
    } else if (endDiskIntersection.w >= 0.0) {
      intersection = endDiskIntersection.xyz;
      normal = -endDiskNormal;
      depth = camera.projectionView * vec4<f32>(endDiskIntersection.xyz, 1.0);
      depth = depth * (1.0 / depth.w);
    } else {
      discard;
    }
  } else {
    intersection = ray.origin + result.rayT * ray.direction;
    let intersectionBezier: vec3<f32> = evaluateQuadraticBezier(curve_ws, result.curveT);
    normal = normalize(intersection - intersectionBezier);
    depth = camera.projectionView * vec4<f32>(intersection, 1.0);
    depth = depth * (1.0 / depth.w);
  }

  // Final write
  return FragmentOutput(
    ${writeDepth ? 'depth.z,' : ''}
    vec4<f32>(color.xyz, 1.0),    
    ${writeDepth ? 'vec4<f32>(normal, 1.0),' : ''}    
  );  
}
`};