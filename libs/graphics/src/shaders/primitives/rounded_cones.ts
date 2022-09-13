export const roundedCones = (writeDepth: boolean) => {
  return /*wgsl*/`
fn roundedConeBoundingSphere(pa: vec3<f32>, pb: vec3<f32>, ra: f32) -> Sphere
{
    let a: vec3<f32> = pb - pa;
    let e: vec3<f32> = ra * sqrt( vec3<f32>(1.0, 1.0, 1.0) - a*a*(1.0 / dot(a,a)) );
    
    return Sphere(
      0.5 * (max( pa + e, pb + e ) + min( pa - e, pb - e )),
      0.5 * length(max( pa + e, pb + e ) - min( pa - e, pb - e ))
    );
}

fn isInfiniteCylinderIntersected(ro: vec3<f32>, rd: vec3<f32>, cb: vec3<f32>, ca: vec3<f32>, cr: f32) -> bool
{
    let  oc = ro - cb;
    let card = dot(ca,rd);
    let caoc = dot(ca,oc);
    let a = 1.0 - card*card;
    let b = dot( oc, rd) - caoc*card;
    let c = dot( oc, oc) - caoc*caoc - cr*cr;
    let h = b*b - a*c;
    
    return h > 0.0;
}

fn isSphereIntersected(ro: vec3<f32>, rd: vec3<f32>, ce: vec3<f32>, ra: f32) -> bool
{
  let oc = ro - ce;
    let b = dot( oc, rd );
    let c = dot( oc, oc ) - ra*ra;
    let h = b*b - c;
    
    return h > 0.0;
}

//
struct BufferRoundedCone {
    //                        // size   |   aligned at   | ends at
    from: vec3<f32>,          // 12          0             12
    //                        
    radius: f32,              // 4          12             16
    // 
    to: vec3<f32>,            // 12         16             28
    // (radius2)
    leftPlane: vec4<f32>,     // 16         32             48
    // 
    rightPlane: vec4<f32>,    // 16         48             64
    //
    colors: vec4<u32>,        // 16         64             80

    cull: u32,                //  4         80             84
    //
    selectionId: f32,         //  4         84             88
    selectionId2: f32,        //  4         88             92

    padding: array<u32, 8>,   // 36                  

    ty: i32,
};

struct RoundedConesBuffer {
    roundedCones: array<BufferRoundedCone>,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read> roundedConesBuffer: RoundedConesBuffer;
@group(2) @binding(0) var<storage, read> cullObjectsBuffer: CullObjectsBuffer;

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,

  @location(0) from : vec3<f32>,
  @location(1) to : vec3<f32>,

  @location(2) radius: f32,

  @location(3) color: vec4<f32>,
  @location(4) color2: vec4<f32>,

  @location(5) @interpolate(flat) cull: u32,

  @location(6) selectionId: f32,
  @location(7) selectionId2: f32,  
};

fn hsv2rgb(c: vec3<f32>) -> vec3<f32>
{
    let k = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);

    return c.z * mix(k.xxx, clamp(p - k.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), c.y);
}

@vertex
fn main_vertex(@builtin(vertex_index) VertexIndex : u32,
               @builtin(instance_index) InstanceIndex : u32
) -> VertexOutput {
  let roundedCone: BufferRoundedCone = roundedConesBuffer.roundedCones[InstanceIndex];

  let center: vec3<f32> = 0.5 * (roundedCone.from.xyz + roundedCone.to.xyz);
  let radius: f32 = roundedCone.radius;

  let sphereRadius = 0.5 * length(roundedCone.from.xyz - roundedCone.to.xyz);  
  // let boundingRectangle: BoundingRectangle = sphereBoundingRectangle(Sphere(center, sphereRadius), camera.projectionView);

  let br1 = sphereBoundingRectangle(Sphere(roundedCone.from.xyz, radius), camera.projectionView);
  let br2 = sphereBoundingRectangle(Sphere(roundedCone.to.xyz, radius), camera.projectionView);

  let ssv = normalize(br2.center - br1.center);

  // let half_size = max(length(br1.half_size), length(br2.half_size));
  let half_size1 = length(br1.half_size);
  let half_size2 = length(br1.half_size);

  let ortSsv1 = half_size1 * vec2<f32>(-ssv.y, ssv.x);
  let ortSsv2 = half_size2 * vec2<f32>(ssv.y, -ssv.x);

  var from: vec2<f32> = br1.center - half_size1 * ssv;
  var to: vec2<f32> = br2.center + half_size2 * ssv;

  var position: vec2<f32>;
  switch(i32(VertexIndex)) {
    case 0: {
      position = from + ortSsv1;
    }
    case 1: {
      position = from + ortSsv2;
    }
    case 2: {
      position = to + ortSsv1;
    }
    default: { // 3
      position = to + ortSsv2;
    }
  }

  var vertexCenter: vec4<f32> = camera.view * vec4<f32>(center, 1.0);
  vertexCenter.z = vertexCenter.z + sphereRadius;
  vertexCenter = camera.projection * vertexCenter;
  vertexCenter.z = vertexCenter.z / vertexCenter.w;

  let c = clamp(f32(InstanceIndex) / 30000.0 + 0.2, 0.0, 1.0);

  let id = roundedConesBuffer.roundedCones[InstanceIndex].selectionId;
  let id2 = roundedConesBuffer.roundedCones[InstanceIndex].selectionId2;
  // let id = 2.0;
  // let id2 = 2.0;

  return VertexOutput(
    vec4<f32>(position, vertexCenter.z, 1.0), 
    vec3<f32>(roundedCone.from.xyz),
    vec3<f32>(roundedCone.to.xyz),
    radius,
    unpack4x8unorm(roundedCone.colors[0]),
    unpack4x8unorm(roundedCone.colors[1]),
    roundedCone.cull,
    id,
    id2,    
  );
}

struct FragmentOutput {
  ${writeDepth ? '@builtin(frag_depth) fragmentDepth : f32,' : ''}
  @location(0) color : vec4<f32>,
  ${writeDepth ? '@location(1) worldNormal : vec4<f32>,' : ''}
  ${writeDepth ? '@location(2) selectionID: vec4<f32>,' : ''}
};

@fragment
fn main_fragment(vertexOutput: VertexOutput) -> FragmentOutput {
  // Fragment in framebuffer/window coordinates
  var fragmentNormalizedSpace: vec4<f32> = vec4<f32>(vertexOutput.Position.xyz, 1.0); 

  // Fragment in NDC coordinates
  fragmentNormalizedSpace.x = (fragmentNormalizedSpace.x / camera.viewportSize.x) * 2.0 - 1.0;
  fragmentNormalizedSpace.y = (1.0 - (fragmentNormalizedSpace.y / camera.viewportSize.y)) * 2.0 - 1.0;

  // Fragment in view space
  var fragmentViewSpace: vec4<f32> = camera.projectionInverse * fragmentNormalizedSpace;
  fragmentViewSpace.z = -1.0;
  fragmentViewSpace.w = 1.0;

  // Fragment in word space
  let fragmentWorldSpace: vec4<f32> = camera.viewInverse * fragmentViewSpace;

  // Ray
  let ray: Ray = Ray(
    camera.position.xyz,
    normalize((fragmentWorldSpace - camera.position).xyz)
  );

  // Rounded Cone
  let capsuleOutside: Capsule = Capsule(vertexOutput.from, vertexOutput.to, vertexOutput.radius);

  // Intersection
  var t: f32 = rayCapsuleIntersection(ray, capsuleOutside);

  if (t < 0.0 || vertexOutput.radius <= 0.0001) {
    discard;
  }

  var intersection: vec3<f32> = ray.origin.xyz  + t * ray.direction.xyz;

  let ba = capsuleOutside.to - capsuleOutside.from;
  let pa = intersection - capsuleOutside.from;
  let h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  var normal: vec3<f32> = (pa - h*ba) / capsuleOutside.radius;

  // Discard based on culling objects
  var cull = false;

  if (cullObjectsBuffer.len <= u32(0)) {
    cull = false;
  }

  for (var i: u32 = u32(0); i < cullObjectsBuffer.len; i = i + u32(1)) {
    let object = cullObjectsBuffer.objects[i];

    // if (object.ty == u32(0)) {
    //   let center = vec3<f32>(bitcast<f32>(object.content[0]), bitcast<f32>(object.content[1]), bitcast<f32>(object.content[2]));
    //   let radius = bitcast<f32>(object.content[3]);

    //   if (distance(center, intersection) < radius) {
    //     cull = false;
    //     break;
    //   }
    // }

    // if (object.ty == u32(1)) {
    //   let from = vec3<f32>(bitcast<f32>(object.content[0]), bitcast<f32>(object.content[1]), bitcast<f32>(object.content[2]));
    //   let radius = bitcast<f32>(object.content[3]);
    //   let to = vec3<f32>(bitcast<f32>(object.content[4]), bitcast<f32>(object.content[5]), bitcast<f32>(object.content[6]));

    //   let cullObject: RoundedCone = RoundedCone(from, to, radius, vec4<f32>(0.0), vec4<f32>(0.0));

    //   let distance = roundedConeDistance(intersection, cullObject);
    //   if (distance < 0.0) {
    //     cull = true;
    //   }
    // }

    if (object.ty == u32(2)) {
      let plane = vec4<f32>(bitcast<f32>(object.content[0]), bitcast<f32>(object.content[1]), bitcast<f32>(object.content[2]), bitcast<f32>(object.content[3]));

      if (dot(plane, vec4<f32>(intersection, 1.0)) < 0.0) {
        let planeT = -(dot(ray.origin, plane.xyz) + plane.w) / dot(ray.direction, plane.xyz);
        let planeIntersection = ray.origin.xyz  + planeT * ray.direction.xyz;
        let d = capsuleDistance(planeIntersection, capsuleOutside);

        if (planeT > 0.0 && d <= 0.0) {
          t = planeT;

          normal.x = -plane.x;
          normal.y = -plane.y;
          normal.z = -plane.z;

          intersection = ray.origin.xyz  + t * ray.direction.xyz;
        } else {
          cull = true;
        }
      }
    }
  }

  if (cull && vertexOutput.cull == 1) {
    discard;
  }

  var depth: vec4<f32> = camera.projectionView * vec4<f32>(intersection, 1.0);
  depth = depth * (1.0 / depth.w);
  var color: vec4<f32> = vec4<f32>(1.0); // vertexOutput.color;
  var selectionId: f32 = -1.0; 

  let totalLength = length(vertexOutput.to - vertexOutput.from);
  let lengthOnIntersection = length(vertexOutput.from - (intersection - vertexOutput.radius * normal));
  let ratio = lengthOnIntersection / totalLength;

  if (ratio < 0.5) {
    color = vertexOutput.color;
    selectionId = vertexOutput.selectionId;
  } else {
    color = vertexOutput.color2;
    selectionId = vertexOutput.selectionId2;
  }

  //~ DK: getting UVs of the fragment:
  var fragmentScreenSpace = vec2<f32>(0, 0);
  fragmentScreenSpace.x = fragmentNormalizedSpace.x / 2.0 + 0.5;
  fragmentScreenSpace.y = fragmentNormalizedSpace.y / 2.0 + 0.5;

  // Final write
  return FragmentOutput(
    ${writeDepth ? 'depth.z,' : ''}
    color,
    ${writeDepth ? '0.5 * vec4<f32>(normal, 1.0) + vec4<f32>(0.5),' : ''}
    ${writeDepth ? 'vec4<f32>(selectionId, fragmentScreenSpace.x, fragmentScreenSpace.y, 1.0),' : ''}
  );  
}
`};