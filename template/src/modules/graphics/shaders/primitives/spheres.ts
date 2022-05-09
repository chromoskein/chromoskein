export const spheres = (writeDepth: boolean) => { return /* wgsl */`
//
struct BufferSphere {
    // Center of the sphere.
    position: vec3<f32>,
    
    // Radius of the sphere.
    radius: f32,

    color: vec4<f32>,
    borderColor: vec4<f32>,

    padding: array<f32, 19>,

    ty: i32,
};


struct SpheresBuffer {
    spheres:  array<BufferSphere>,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read> spheresBuffer: SpheresBuffer;
@group(2) @binding(0) var<storage, read> cullObjectsBuffer: CullObjectsBuffer;

${writeDepth ? '' : '@group(3) @binding(0) var gBufferDepth : texture_depth_2d;'} 

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) sphere : vec4<f32>,
  @location(1) color : vec4<f32>,
  @location(2) borderColor : vec4<f32>,
};

@stage(vertex)
fn main_vertex(@builtin(vertex_index) VertexIndex : u32,
               @builtin(instance_index) InstanceIndex : u32
) -> VertexOutput {
  let bufferSphere: BufferSphere = spheresBuffer.spheres[InstanceIndex];

  // if (bufferSphere.ty != 0) {
  //   return VertexOutput(
  //     vec4<f32>(0.0, 0.0, 0.0, 0.0), 
  //     vec4<f32>(0.0, 0.0, 0.0, 0.0),
  //     vec4<f32>(0.0, 0.0, 0.0, 0.0)
  //   );
  // }

  let sphere: Sphere = Sphere(bufferSphere.position, bufferSphere.radius);
  let boundingRectangle: BoundingRectangle = sphereBoundingRectangle(sphere, camera.projectionView);

  var position: vec2<f32>;
  switch(i32(VertexIndex)) {
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

  var center: vec4<f32> = camera.view * vec4<f32>(sphere.position, 1.0);
  center.z = center.z + sphere.radius;
  center = camera.projection * center;
  center.z = center.z / center.w;

  return VertexOutput(
    vec4<f32>(position, center.z, 1.0), 
    vec4<f32>(sphere.position.xyz, sphere.radius),
    bufferSphere.color,
    bufferSphere.borderColor,
  );
}

struct FragmentOutput {
  ${writeDepth ? '@builtin(frag_depth) fragmentDepth : f32,' : ''}
  @location(0) color : vec4<f32>,
  ${writeDepth ? '@location(1) worldNormal : vec4<f32>,' : ''}
};

@stage(fragment)
fn main_fragment(@builtin(position) Position : vec4<f32>, 
                 @location(0) s : vec4<f32>,
                 @location(1) color : vec4<f32>,
                 @location(2) borderColor : vec4<f32>,
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
  let fragmentWorldSpace: vec4<f32>  = camera.viewInverse * fragmentViewSpace;

  // Ray
  let ray: Ray = Ray(
    camera.position.xyz,
    normalize((fragmentWorldSpace - camera.position).xyz)
  );

  let sphere: Sphere = Sphere(s.xyz, s.w);

  // Ray-Sphere intersection
  let t: vec2<f32> = raySphereIntersections(ray, sphere);

  let intersection1: vec3<f32> = camera.position.xyz + t.x * ray.direction.xyz;
  let normal: vec3<f32> = normalize(intersection1 - sphere.position);
  var depth: vec4<f32> = camera.projectionView * vec4<f32>(intersection1, 1.0);
  depth = depth * (1.0 / depth.w);

  if (t.x < 0.0) {
    discard;
  }

  var outputColor = color;

  let angle = dot(normal, normalize(camera.position.xyz - intersection1.xyz));

  if (angle < 0.50) {
    outputColor = borderColor;
  }

  ${writeDepth ? `` : `
  let intersection2: vec3<f32> = camera.position.xyz + t.y * ray.direction.xyz;
  var intersection2ViewSpace = camera.projectionView * vec4<f32>(intersection2, 1.0);
  intersection2ViewSpace.z = intersection2ViewSpace.z / intersection2ViewSpace.w;
  
  let ndcDepth = textureLoad(gBufferDepth, vec2<i32>(Position.xy), 0);
  // var worldPositionViewSpace = camera.projectionView * vec4<f32>(textureLoad(gBufferWorldPositions, vec2<i32>(Position.xy), 0).xyz, 1.0);
  // worldPositionViewSpace.z = worldPositionViewSpace.z / worldPositionViewSpace.w;

  if (intersection2ViewSpace.z > ndcDepth) {
    outputColor = vec4<f32>(color.xyz, 0.6);  

    let normal2 = normalize(intersection2 - sphere.position);
    if (abs(dot(normal2, vec3<f32>(0.0, 1.0, 0.0))) < 0.01) 
    {
      outputColor = vec4<f32>(0.7, 0.7, 0.7, 1.0);
    }
    if (abs(dot(normal2, vec3<f32>(1.0, 0.0, 0.0))) < 0.01) 
    {
      outputColor = vec4<f32>(0.7, 0.7, 0.7, 1.0);
    }      
  } else {
    outputColor = vec4<f32>(color.xyz, 0.4);
  }

  if (abs(dot(normal, vec3<f32>(0.0, 1.0, 0.0))) < 0.01) 
  {
    outputColor = vec4<f32>(0.7, 0.7, 0.7, 1.0);
  }
  if (abs(dot(normal, vec3<f32>(1.0, 0.0, 0.0))) < 0.01) 
  {
    outputColor = vec4<f32>(0.7, 0.7, 0.7, 1.0);
  }
  `}
  
  // Final write
  return FragmentOutput(
    ${writeDepth ? 'depth.z,' : ''}
    outputColor,
    ${writeDepth ? '0.5 * vec4<f32>(normal, 1.0) + vec4<f32>(0.5),' : ''}
  );  
}
`};