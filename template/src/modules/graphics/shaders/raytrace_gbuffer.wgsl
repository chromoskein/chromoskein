// The minimunm distance a ray must travel before we consider an intersection.
// This is to prevent a ray from intersecting a surface it just bounced off of.
let minimumRayHitTime: f32 = 0.0001;

// after a hit, it moves the ray this far along the normal away from a surface.
// Helps prevent incorrect intersections when rays bounce off of objects.
let rayNormalNudge: f32 = 0.001;

struct BoundingBox {
  min: vec3<f32>,
  primitive: i32,
  max: vec3<f32>,
};

struct Node {
    boundingBox: BoundingBox,
    firstChildOrPrimitive: i32,
    primitiveCount: i32,
    axis: i32,
};

 struct BoundingVolumeHierarchyBuffer {
  nodes :  array<Node>,
};


 struct PrimitivesBuffer {
    primitives:  array<array<f32, 32>>,
};

 struct BoundingBoxesBuffer {
    boundingBoxes:  array<BoundingBox>,
};


struct Globals {
    ambientOcclusionTaps: i32,
    resetAmbientOcclusion: i32,
};

@group(0) @binding(0) var<uniform> camera: Camera;

@group(1) @binding(0) var<storage, read> primitivesBuffer: PrimitivesBuffer;

@group(2) @binding(0) var<storage, read> bvhBuffer: BoundingVolumeHierarchyBuffer;
@group(2) @binding(1) var<storage, read> boundingBoxesBuffer: BoundingBoxesBuffer;

@group(3) @binding(0) var gBufferColors : texture_storage_2d<rgba8unorm, write>;
@group(3) @binding(1) var gBufferWorldPositions : texture_storage_2d<rgba32float, write>;
@group(3) @binding(2) var gBufferWorldNormals : texture_storage_2d<rgba8unorm, write>;
@group(3) @binding(3) var gBufferAmbientOcclusion : texture_storage_2d<r32float, write>;
@group(3) @binding(4) var<uniform> globals: Globals;

fn rayBoundingBoxInteresction(inverseRay: Ray, boundingBox: BoundingBox) -> bool {
  let t0 = (boundingBox.min - inverseRay.origin) * inverseRay.direction;
  let t1 = (boundingBox.max - inverseRay.origin) * inverseRay.direction;

  let tmin = min(t0, t1);
  let tmax = max(t0, t1);

  return max(tmin.z, max(tmin.x, tmin.y)) <= min(tmax.z, min(tmax.x, tmax.y));
}

struct BoundingBoxIntersection {
  t: f32,
  intersect: bool,
};

fn rayBoundingBoxInteresctionT(inverseRay: Ray, boundingBox: BoundingBox) -> BoundingBoxIntersection {
  let t0 = (boundingBox.min - inverseRay.origin) * inverseRay.direction;
  let t1 = (boundingBox.max - inverseRay.origin) * inverseRay.direction;

  let tmin = min(t0, t1);
  let tmax = max(t0, t1);

  let maxMin = max(tmin.z, max(tmin.x, tmin.y));
  let minMax = min(tmax.z, min(tmax.x, tmax.y));

  return BoundingBoxIntersection(maxMin, maxMin <= minMax);
}

@stage(compute) @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
  if (f32(GlobalInvocationID.x) >= camera.viewportSize.x || f32(GlobalInvocationID.y) >= camera.viewportSize.y) {
    return;
  }

  // Fragment in framebuffer/window coordinates
  var fragmentNormalizedSpace: vec4<f32> = vec4<f32>(vec2<f32>(GlobalInvocationID.xy), 0.0, 1.0); 

  // Fragment in NDC coordinates
  fragmentNormalizedSpace.x = (fragmentNormalizedSpace.x / camera.viewportSize.x) * 2.0 - 1.0;
  fragmentNormalizedSpace.y = (1.0 - (fragmentNormalizedSpace.y / camera.viewportSize.y)) * 2.0 - 1.0;

  // Fragment in view space
  var fragmentViewSpace: vec4<f32> = camera.projectionInverse * fragmentNormalizedSpace;
  fragmentViewSpace.z = -1.0;
  fragmentViewSpace.w = 1.0;

  // Fragment in world space
  let fragmentWorldSpace: vec4<f32> = camera.viewInverse * fragmentViewSpace;

  // Ray
  let ray: Ray = Ray(
    camera.position.xyz,
    normalize((fragmentWorldSpace - camera.position).xyz)
  );

  // Create inverse ray
  let inverseRay = Ray(ray.origin, vec3<f32>(
    1.0 / ray.direction.x,
    1.0 / ray.direction.y,
    1.0 / ray.direction.z,
  ));

  var nodesToIntersect = array<i32, 64>(
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  );
  nodesToIntersect[0] = 0;
  var nodesToIntersectLength: i32 = 1;

  var result = vec4<f32>(0.0, 0.0, 0.0, 0.0);

  var hitT = -1.0;
  var intersection: vec3<f32> = vec3<f32>(0.0);
  var normal: vec3<f32> = vec3<f32>(0.0);
  var color: vec3<f32> = vec3<f32>(0.0);
  loop {
      if (nodesToIntersectLength <= 0) {
        break;
      }

      let nodeIndex = nodesToIntersect[nodesToIntersectLength - 1];
      let node = bvhBuffer.nodes[nodeIndex];
      nodesToIntersectLength = nodesToIntersectLength - 1;

      // Check if ray intersects bounding box of a node
      let boundingBoxIntersection = rayBoundingBoxInteresctionT(inverseRay, node.boundingBox);
      if (boundingBoxIntersection.intersect) {
        if (hitT > 0.0 && boundingBoxIntersection.t > hitT) {
          continue;
        }
        // If node is a leaf
          if (node.primitiveCount > 0) {
              for (var i = 0; i < node.primitiveCount; i = i + 1) {
                  let primitiveIndex = boundingBoxesBuffer.boundingBoxes[node.firstChildOrPrimitive + i].primitive;
                  let primitiveArray = primitivesBuffer.primitives[primitiveIndex];
                  let primitiveType: i32 = bitcast<i32>(primitiveArray[31]);

                  if (primitiveType == 0) {
                    let sphere: Sphere = Sphere(vec3<f32>(primitiveArray[0], primitiveArray[1], primitiveArray[2]), primitiveArray[3]);
                    let t: f32 = raySphereIntersection(ray, sphere);

                    if ((t > 0.0 && t < hitT) || (t > 0.0 && hitT < 0.0)) {
                      hitT = t;

                      intersection = camera.position.xyz + hitT * ray.direction.xyz;
                      normal = normalize(intersection - sphere.position);
                      color = vec3<f32>(primitiveArray[4], primitiveArray[5], primitiveArray[6]);
                    }
                  }
                  
                  if (primitiveType == 1) {
                    let cylinder: Cylinder = Cylinder(
                      vec3<f32>(primitiveArray[0], primitiveArray[1], primitiveArray[2]), 
                      vec3<f32>(primitiveArray[4], primitiveArray[5], primitiveArray[6]), 
                      primitiveArray[3]
                    );

                    let cylinderIntersection: vec4<f32> = rayCylinderInteresection(ray, cylinder);
                    let t = cylinderIntersection.x;

                    if ((t > 0.0 && t < hitT) || (t > 0.0 && hitT < 0.0)) {
                      hitT = t;

                      intersection = camera.position.xyz + hitT * ray.direction.xyz;
                      normal = normalize(cylinderIntersection.yzw);
                      color = vec3<f32>(primitiveArray[8], primitiveArray[9], primitiveArray[10]);
                    }
                  }

                  if (primitiveType == 4) {
                    let roundedCone: RoundedCone = RoundedCone(
                      vec3<f32>(primitiveArray[0], primitiveArray[1], primitiveArray[2]), 
                      vec3<f32>(primitiveArray[4], primitiveArray[5], primitiveArray[6]), 
                      primitiveArray[3],
                      vec4<f32>(primitiveArray[8], primitiveArray[9], primitiveArray[10], primitiveArray[11]), 
                      vec4<f32>(primitiveArray[12], primitiveArray[13], primitiveArray[14], primitiveArray[15]), 
                    );

                    let roundedConeIntersection: vec4<f32> = rayRoundedConeIntersection(ray, roundedCone);
                    let t = roundedConeIntersection.x;

                    let null = vec4<f32>(0.0);
                    let tmpIntersection = vec4<f32>(camera.position.xyz + t * ray.direction.xyz, 1.0);

                    // if (any(roundedCone.leftPlane != null) && (dot(roundedCone.leftPlane, tmpIntersection) > 0.0)) {
                    //   continue;
                    // }

                    // if (any(roundedCone.rightPlane != null) && dot(roundedCone.rightPlane, tmpIntersection) > 0.0) {
                    //   continue;
                    // }

                    if ((t > 0.0 && t < hitT) || (t > 0.0 && hitT < 0.0)) {
                      hitT = t;

                      intersection = tmpIntersection.xyz;
                      normal = normalize(roundedConeIntersection.yzw);
                      color = vec3<f32>(primitiveArray[16], primitiveArray[17], primitiveArray[18]);
                      // color = vec3<f32>(normal * 0.5 + 0.5);
                    }
                  }
              }
          } else {
              nodesToIntersect[nodesToIntersectLength] = node.firstChildOrPrimitive;
              nodesToIntersect[nodesToIntersectLength + 1] = node.firstChildOrPrimitive + 1;

              nodesToIntersectLength = nodesToIntersectLength + 2;
          }
      }
  }

  if (hitT > 0.0) {
    textureStore(gBufferColors, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(color, 1.0));
    textureStore(gBufferWorldPositions, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(intersection, 1.0));
    textureStore(gBufferWorldNormals, vec2<i32>(GlobalInvocationID.xy), 0.5 * vec4<f32>(normal, 1.0) + vec4<f32>(0.5));

    if (globals.resetAmbientOcclusion == 1) {
      textureStore(gBufferAmbientOcclusion, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(0.0));
    }    
  } else {
    textureStore(gBufferColors, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(0.0, 0.0, 0.0, 0.0));
    textureStore(gBufferWorldPositions, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(0.0, 0.0, 0.0, 0.0));
    textureStore(gBufferWorldNormals, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(0.0, 0.0, 0.0, 0.0));
    
    if (globals.resetAmbientOcclusion == 1) {
      textureStore(gBufferAmbientOcclusion, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(0.0));
    }  
  }  
}
