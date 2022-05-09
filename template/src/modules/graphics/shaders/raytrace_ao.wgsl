// The minimunm distance a ray must travel before we consider an intersection.
// This is to prevent a ray from intersecting a surface it just bounced off of.
let minimumRayHitTime: f32 = 0.001;

// after a hit, it moves the ray this far along the normal away from a surface.
// Helps prevent incorrect intersections when rays bounce off of objects.
let rayNormalNudge: f32 = 0.001;

fn wangHash(seed: u32) -> u32 {
    var newSeed: u32 = u32(seed ^ u32(61)) ^ u32(seed >> u32(16));
    newSeed = newSeed * u32(9);
    newSeed = newSeed ^ (newSeed >> u32(4));
    newSeed = newSeed * u32(668265261);
    newSeed = newSeed ^ (newSeed >> u32(15));

    return newSeed;
}

fn RandomFloat01(hash: u32) -> f32 {
    return f32(hash) / 4294967296.0;
}

fn RandomUnitVector(seed: u32) -> vec3<f32> {
    let seed1 = wangHash(seed);
    let seed2 = wangHash(seed1);

    let random1 = RandomFloat01(seed1);
    let random2 = RandomFloat01(seed2);

    let z: f32 = random1 * 2.0 - 1.0;
    let a: f32 = random2 * 6.28318530718;
    let r: f32 = sqrt(1.0 - z * z);
    let x = r * cos(a);
    let y = r * sin(a);

    return vec3<f32>(x, y, z);
}

struct BoundingBox {
  min: vec3<f32>,
  primitive: i32,
  max: vec3<f32>,
};


struct Node {
    boundingBox: BoundingBox,
    firstChildOrPrimitive: i32,
    primitiveCount: i32,
};

struct BoundingVolumeHierarchyBuffer {
  nodes:  array<Node>,
};


struct PrimitivesBuffer {
    primitives: array<array<f32, 32>>,
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

@group(3) @binding(0) var gBufferDepth : texture_depth_2d;
@group(3) @binding(1) var gBufferWorldNormals : texture_2d<f32>;
@group(3) @binding(2) var gBufferAmbientOcclusion : texture_storage_2d<r32float, write>;
@group(3) @binding(3) var<uniform> globals: Globals;

fn rayBoundingBoxInteresction(inverseRay: Ray, boundingBox: BoundingBox) -> bool {
  let t0 = (boundingBox.min - inverseRay.origin) * inverseRay.direction;
  let t1 = (boundingBox.max - inverseRay.origin) * inverseRay.direction;

  let tmin = min(t0, t1);
  let tmax = max(t0, t1);

  return max(tmin.z, max(tmin.x, tmin.y)) <= min(tmax.z, min(tmax.x, tmax.y));
}

fn aoHit(ray: Ray) -> bool {
  // Create inverse ray
  let inverseRay = Ray(ray.origin, vec3<f32>(
    1.0 / ray.direction.x,
    1.0 / ray.direction.y,
    1.0 / ray.direction.z,
  ));
  
  var nodesToIntersect = array<i32, 32>(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  nodesToIntersect[0] = 0;
  var nodesToIntersectLength: i32 = 1;

  var hit = false;
  loop {
    if (nodesToIntersectLength <= 0 || hit == true) {
      break;
    }

    let nodeIndex = nodesToIntersect[nodesToIntersectLength - 1];
    let node = bvhBuffer.nodes[nodeIndex];
    nodesToIntersectLength = nodesToIntersectLength - 1;

    // Check if ray intersects bounding box of a node
    if (rayBoundingBoxInteresction(inverseRay, node.boundingBox)) {
      // If node is a leaf
        if (node.primitiveCount > 0) {
            for (var i = 0; i < node.primitiveCount; i = i + 1) {
                let primitiveIndex = boundingBoxesBuffer.boundingBoxes[node.firstChildOrPrimitive + i].primitive;
                let primitiveArray = primitivesBuffer.primitives[primitiveIndex];
                let primitiveType: i32 = bitcast<i32>(primitiveArray[31]);

                if (primitiveType == 0) {
                  let sphere: Sphere = Sphere(vec3<f32>(primitiveArray[0], primitiveArray[1], primitiveArray[2]), primitiveArray[3]);
                  let t: f32 = raySphereIntersection(ray, sphere);

                  if (t > minimumRayHitTime) {
                    hit = true;
                    break;
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

                  if (t > minimumRayHitTime) {
                    hit = true;
                    break;
                  }
                }

                if (primitiveType == 4) {
                    let roundedCone: RoundedCone = RoundedCone(
                      vec3<f32>(primitiveArray[0], primitiveArray[1], primitiveArray[2]), 
                      vec3<f32>(primitiveArray[4], primitiveArray[5], primitiveArray[6]), 
                      primitiveArray[3],
                      vec4<f32>(0.0), 
                      vec4<f32>(0.0), 
                    );

                    let intersection: vec4<f32> = rayRoundedConeIntersection(ray, roundedCone);
                    let t = intersection.x;

                    let null = vec4<f32>(0.0);
                    let tmpIntersection = vec4<f32>(camera.position.xyz + t * ray.direction.xyz, 1.0);

                    // if (any(roundedCone.leftPlane != null) && (dot(roundedCone.leftPlane, tmpIntersection) > 0.0)) {
                    //   continue;
                    // }

                    // if (any(roundedCone.rightPlane != null) && dot(roundedCone.rightPlane, tmpIntersection) > 0.0) {
                    //   continue;
                    // }
                    
                    if (t > minimumRayHitTime) {
                      hit = true;
                      break;
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

  return hit;
}

fn ndcToViewSpace(ndc: vec4<f32>) -> vec4<f32> {
  var viewSpace = camera.projectionInverse * ndc;
  viewSpace = viewSpace * (1.0 / viewSpace.w);

  return viewSpace;
}

@stage(compute) @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
  if (f32(GlobalInvocationID.x) >= camera.viewportSize.x || f32(GlobalInvocationID.y) >= camera.viewportSize.y) {
    return;
  }

  let coordinates = vec2<i32>(GlobalInvocationID.xy);
  let textureCoordinates = vec2<f32>(coordinates) / camera.viewportSize;
  var ndcCoordinates = vec2<f32>(0.0, 0.0);
  ndcCoordinates.x = textureCoordinates.x * 2.0 - 1.0;
  ndcCoordinates.y = (1.0 - textureCoordinates.y) * 2.0 - 1.0;

  let depth = textureLoad(gBufferDepth, vec2<i32>(coordinates), 0);
  let viewSpacePosition = ndcToViewSpace(vec4<f32>(ndcCoordinates, depth, 1.0));
  let worldPosition = (camera.viewInverse * viewSpacePosition).xyz;

  // let worldPosition = textureLoad(gBufferWorldPositions, vec2<i32>(coordinates), 0).xyz;
  let worldNormal = textureLoad(gBufferWorldNormals, vec2<i32>(coordinates), 0).xyz;
  var ambientOcclusion = 0.0;

  if (all(worldNormal == vec3<f32>(0.0, 0.0, 0.0))) {
    return;
  }
   
  // Calculate AO
  var accum: f32 = 0.0;
  let rays = 8;
  for(var i: i32 = 0; i < rays; i = i + 1) {    
    let randomSeed = u32(u32(GlobalInvocationID.x) * u32(1973) + u32(GlobalInvocationID.y) * u32(9277) + u32(i) * u32(26699)) | u32(1);

    let aoRayDirection = normalize(worldNormal + RandomUnitVector(randomSeed)); 
    let hit = aoHit(Ray(worldPosition + worldNormal * rayNormalNudge, aoRayDirection));

    if (hit) {
      accum = accum + 1.0;
    }
  }

  ambientOcclusion = accum / f32(rays);

  textureStore(gBufferAmbientOcclusion, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(ambientOcclusion));
}
