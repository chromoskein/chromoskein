export const beziers = (writeDepth: boolean) => {
  return /* wgsl */`
struct CurveIntersectionResult {
  rayT: f32,
  curveT: f32,
  hit: bool,
};

// How to resolve the equation below can be seen on this image.
// http://www.perbloksgaard.dk/research/DistanceToQuadraticBezier.jpg
fn rayQuadraticBezierFalseIntersection(p0: vec3<f32>, p1: vec3<f32>, p2: vec3<f32>, thickness: f32) -> vec3<f32>
{
  let PI: f32 = 3.14159265358979;
  let HALFPI: f32 = 1.57079632679;

	let A2 = p1.xy - p0.xy;
	let B2 = p2.xy - p1.xy - A2;
	let r = vec3<f32>(-3.0*dot(A2,B2), (dot(-p0.xy,B2) - 2.0*dot(A2,A2)), dot(-p0.xy,A2)) / -dot(B2,B2);
	let t = clamp(cubicRoots(r.x, r.y, r.z), vec2<f32>(0.0), vec2<f32>(1.0));
	let A3 = p1 - p0;
	let B3 = p2 - p1 - A3;
	let D3 = A3 * 2.0;
	var pos1 = (D3+B3*t.x)*t.x + p0;
	var pos2 = (D3+B3*t.y)*t.y + p0;
	pos1.x = pos1.x / thickness;
  pos1.y = pos1.x / thickness;
	pos2.x = pos2.x / thickness;
  pos2.y = pos2.y / thickness;
	let pos1Len = length(pos1.xy);
	if (pos1Len>1.)
	{
		pos1 = vec3<f32>(1e8);
	}
	let pos2Len = length(pos2.xy);
	if (pos2Len>1.)
	{
		pos2 = vec3<f32>(1e8);
	}
	pos1.z -= cos(pos1Len*HALFPI)*thickness;
	pos2.z -= cos(pos2Len*HALFPI)*thickness;

  if (length(pos1) < length(pos2)) {
    return vec3<f32>(pos1Len,pos1.z,t.x);
  } else {
    return vec3<f32>(pos2Len,pos2.z,t.y);
  }
}


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

    for(var i: i32 = 0; i < 5; i = i + 1) {
      rci.co = evaluateQuadraticBezier(curve, t);
      rci.cd = evaluateDifferentialQuadraticBezier(curve, t);

      rci = rayBezierIntersect(rci, curve.radius);
      
      if (rci.phantom && abs(rci.dt) < 0.1) {
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
    p0: vec4<f32>,    
    p1: vec4<f32>,
    p2: vec4<f32>,

    colorFrom: vec4<f32>,
    borderColor: vec4<f32>,

    padding: array<f32, 11>,

    ty: i32,
};


struct CurvesBuffer {
    curves:  array<BufferQuadraticBezierCurve>,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read> curvesBuffer: CurvesBuffer;
@group(2) @binding(0) var<storage, read> cullObjectsBuffer: CullObjectsBuffer;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) p0 : vec3<f32>,
  @location(1) p1 : vec3<f32>,
  @location(2) p2 : vec3<f32>,
  @location(3) radius: f32,
  @location(4) color : vec3<f32>,
  @location(5) borderColor : vec3<f32>,
  @location(6) p0n: vec3<f32>,
  @location(7) p1n: vec3<f32>,
  @location(8) p0p: vec3<f32>,
  @location(9) p1p: vec3<f32>,
};

fn rnd(i: f32) -> f32 {
	return (4000.0*sin(23464.345*i+45.345)) % 1.0;
}

@stage(vertex)
fn main_vertex(@builtin(vertex_index) VertexIndex : u32,
               @builtin(instance_index) InstanceIndex : u32
) -> VertexOutput {
  let curveBuffer: BufferQuadraticBezierCurve = curvesBuffer.curves[InstanceIndex];

  // if (curveBuffer.ty != 2) {
  //   return VertexOutput(
  //     vec4<f32>(0.0, 0.0, 0.0, 0.0), 
  //     vec3<f32>(0.0, 0.0, 0.0),
  //     vec3<f32>(0.0, 0.0, 0.0),
  //     vec3<f32>(0.0, 0.0, 0.0),
  //     0.0,
  //     vec3<f32>(0.0, 0.0, 0.0),
  //   );
  // }

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
    curveBuffer.borderColor.xyz,
    curvesBuffer.curves[i32(InstanceIndex) - 1].p0.xyz,
    curvesBuffer.curves[i32(InstanceIndex) - 1].p1.xyz,
    curvesBuffer.curves[i32(InstanceIndex) + 1].p1.xyz,
    curvesBuffer.curves[i32(InstanceIndex) + 1].p2.xyz
    // vec3<f32>(rnd(f32(InstanceIndex) + 5.0), rnd(f32(InstanceIndex)), rnd(f32(InstanceIndex) + 2.0))
  );
}

struct FragmentOutput {
  ${writeDepth ? '@builtin(frag_depth) fragmentDepth : f32,' : ''}
  @location(0) color : vec4<f32>,  
  ${writeDepth ? '@location(1) worldNormal : vec4<f32>,' : ''}  
};

@stage(fragment)
fn main_fragment(@builtin(position) Position : vec4<f32>, 
                 @location(0) p0 : vec3<f32>,
                 @location(1) p1 : vec3<f32>,
                 @location(2) p2 : vec3<f32>,
                 @location(3) radius: f32,
                 @location(4) color : vec3<f32>,
                 @location(5) borderColor : vec3<f32>,
                 @location(6) p0n: vec3<f32>,
                 @location(7) p1n: vec3<f32>,
                 @location(8) p0p: vec3<f32>,
                 @location(9) p1p: vec3<f32>,
                 ) -> FragmentOutput {
  // Fragment in framebuffer/window coordinates
  var fragmentScreenSpace: vec4<f32> = vec4<f32>(Position.xyz, 1.0); 

  let smallRadius = radius * 0.66;

  // Define curve
  let curve_ws: QuadraticBezierCurve = QuadraticBezierCurve(p0, p1, p2, radius);
  let curve_wsn: QuadraticBezierCurve = QuadraticBezierCurve(p0n, p1n, p0, smallRadius);
  let curve_wsp: QuadraticBezierCurve = QuadraticBezierCurve(p2, p0p, p1p, smallRadius);

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
  var curven: QuadraticBezierCurve = transformToRayFrame(ray, curve_wsn);
  var curvep: QuadraticBezierCurve = transformToRayFrame(ray, curve_wsp);

  // 
  var curve2 = curve;
  curve2.radius = smallRadius;
  var result: CurveIntersectionResult = rayQuadraticBezierIntersection(ray, curve);
  let result2: CurveIntersectionResult = rayQuadraticBezierIntersection(ray, curve2);

  let resultPrevious = rayQuadraticBezierIntersection(ray, curven);
  let resultNext = rayQuadraticBezierIntersection(ray, curvep);

  var intersectionBezier: vec3<f32> = vec3<f32>(0.0);
  var intersection: vec3<f32> = ray.origin + result.rayT * ray.direction;
  var normal: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);
  var depth: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 0.0);

    // Discard based on culling objects
    var cull = false;

  if (!result.hit) {
    // discard;
    cull = true;
  } else {
      intersection = ray.origin + result.rayT * ray.direction;
      intersectionBezier = evaluateQuadraticBezier(curve_ws, result.curveT);
      normal = normalize(intersection - intersectionBezier);
      depth = camera.projectionView * vec4<f32>(intersection, 1.0);
      depth = depth * (1.0 / depth.w);
  }

  var fragmentColor = borderColor;
  
  if (result2.hit || resultPrevious.hit || resultNext.hit) {
    fragmentColor = color;
  }



  if (cullObjectsBuffer.len <= u32(0)) {
    cull = false;
  }

  for (var i: u32 = u32(0); i < cullObjectsBuffer.len; i = i + u32(1)) {
    let object = cullObjectsBuffer.objects[i];

    if (object.ty == u32(2)) {
      let plane = vec4<f32>(bitcast<f32>(object.content[0]), bitcast<f32>(object.content[1]), bitcast<f32>(object.content[2]), bitcast<f32>(object.content[3]));

      if (dot(plane, vec4<f32>(intersection, 1.0)) < 0.0) {
        let planeT = -(dot(ray.origin, plane.xyz) + plane.w) / dot(ray.direction, plane.xyz);
        cull = true;
      }
    }
  }

  if (cull) {
    discard;
  }

  // Final write
  return FragmentOutput(
    ${writeDepth ? 'depth.z,' : ''}
    vec4<f32>(fragmentColor, 1.0),    
    ${writeDepth ? '0.5 * vec4<f32>(normal, 1.0) + vec4<f32>(0.5),' : ''}
  );  
}
`};