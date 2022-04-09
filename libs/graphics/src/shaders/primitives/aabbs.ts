export const aabbs = (writeDepth: boolean) => { return /*wgsl */`
//
struct BufferAABB {
    // 
    from: vec4<f32>,
    // 
    to: vec4<f32>,

    padding: array<f32, 23>,

    ty: i32,
};


struct AabbsBuffer {
    aabbs:  array<BufferAABB>,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read> aabbsBuffer: AabbsBuffer;
@group(2) @binding(0) var<storage, read> cullObjectsBuffer: CullObjectsBuffer;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) from : vec3<f32>,
  @location(1) to : vec3<f32>,
};

@stage(vertex)
fn main_vertex(@builtin(vertex_index) VertexIndex : u32,
               @builtin(instance_index) InstanceIndex : u32
) -> VertexOutput {
  let aabb: BufferAABB = aabbsBuffer.aabbs[InstanceIndex];

  if (aabb.ty != 3) {
    return VertexOutput(
      vec4<f32>(0.0, 0.0, 0.0, 0.0), 
      vec3<f32>(0.0, 0.0, 0.0),
      vec3<f32>(0.0, 0.0, 0.0),
    );
  }

  let sphereCenter: vec3<f32> = 0.5 * (aabb.from.xyz + aabb.to.xyz);
  let radius: f32 = length(0.5 * (aabb.from.xyz - aabb.to.xyz));
  
  let boundingSphere: Sphere = Sphere(sphereCenter, radius);
  let boundingRectangle: BoundingRectangle = sphereBoundingRectangle(boundingSphere, camera.projectionView);

  var position: vec2<f32>;
  switch(i32(VertexIndex)) {
    case 0: {
      position = boundingRectangle.center + vec2<f32>(-boundingRectangle.half_size.x, boundingRectangle.half_size.y);
    }
    case 1: {
      position = boundingRectangle.center + vec2<f32>(boundingRectangle.half_size.x, boundingRectangle.half_size.y);
    }
    case 2: {
      position = boundingRectangle.center + vec2<f32>(-boundingRectangle.half_size.x, -boundingRectangle.half_size.y);
    }
    default: { // 3
      position = boundingRectangle.center + vec2<f32>(boundingRectangle.half_size.x, -boundingRectangle.half_size.y);
    }
  }

  var center: vec4<f32> = camera.view * vec4<f32>(sphereCenter, 1.0);
  center.z = center.z + boundingSphere.radius;
  center = camera.projection * center;
  center.z = center.z / center.w;

  return VertexOutput(
    vec4<f32>(position, center.z, 1.0), 
    vec3<f32>(aabb.from.xyz),
    vec3<f32>(aabb.to.xyz),
  );
}

struct FragmentOutput {
  ${writeDepth ? '@builtin(frag_depth) fragmentDepth : f32,' : ''}
  @location(0) color : vec4<f32>,  
  ${writeDepth ? '@location(1) worldNormal : vec4<f32>,' : ''}  
};

@stage(fragment)
fn main_fragment(@builtin(position) Position : vec4<f32>, 
                 @location(0) aabbFrom : vec3<f32>,
                 @location(1) aabbTo : vec3<f32>
                 ) -> FragmentOutput {
  // Fragment in framebuffer/window coordinates
  var fragmentNormalizedSpace: vec4<f32> = vec4<f32>(Position.xyz, 1.0); 

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

  // Cylinder
  let aabb: AABB = AABB(aabbFrom, aabbTo);

  // Ray-Cylinder intersection
  let t: f32 = rayAABBIntersection(ray, aabb);
  let intersection: vec3<f32> = ray.origin.xyz  + t * ray.direction.xyz;
//   let normal: vec3<f32> = normalize(t.yzw);
  var depth: vec4<f32> = camera.projectionView * vec4<f32>(intersection, 1.0);
  depth = depth * (1.0 / depth.w);

  if (t < 0.0) {
    discard;
  }

  // Final write
  return FragmentOutput(
    ${writeDepth ? 'depth.z,' : ''}
    vec4<f32>(1.0, 1.0, 1.0, 1.0),    
    ${writeDepth ? 'vec4<f32>(0.0, 0.0, 0.0, 1.0),' : ''}    
  );  
}
`};
