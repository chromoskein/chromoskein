 struct Camera {
  projection : mat4x4<f32>,
  projectionInverse : mat4x4<f32>,
  view : mat4x4<f32>,
  viewInverse : mat4x4<f32>,
  projectionView : mat4x4<f32>,
  projectionViewInverse : mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  position : vec4<f32>,
  viewportSize : vec2<f32>,
};

 struct Globals {
  noiseSamples : array<vec4<f32>, 64>,
  kernelSize : i32,
  radius : f32,
  bias : f32,
};

// Camera
@group(0) @binding(0) var<uniform> camera : Camera;

// G-Buffer
@group(1) @binding(0) var gBufferDepth : texture_depth_2d;
@group(1) @binding(1) var gBufferWorldNormals : texture_2d<f32>;
@group(1) @binding(2) var gBufferAmbientOcclusion : texture_storage_2d<r32float, write>;

// SSAO globals
@group(2) @binding(0) var<uniform> globals : Globals;
@group(2) @binding(1) var noiseSampler : sampler;
@group(2) @binding(2) var noiseTexture : texture_2d<f32>;

fn ndcToViewSpace(ndc: vec4<f32>) -> vec4<f32> {
  var viewSpace = camera.projectionInverse * ndc;
  viewSpace = viewSpace * (1.0 / viewSpace.w);

  return viewSpace;
}

@stage(compute) @workgroup_size(8, 8) fn
main(@builtin(global_invocation_id) GlobalInvocationID
     : vec3<u32>) {
  if (f32(GlobalInvocationID.x) >= camera.viewportSize.x ||
      f32(GlobalInvocationID.y) >= camera.viewportSize.y) {
    return;
  }

  let coordinates = vec2<i32>(GlobalInvocationID.xy);
  let textureCoordinates = vec2<f32>(coordinates) / camera.viewportSize;
  var ndcCoordinates = vec2<f32>(0.0, 0.0);
  ndcCoordinates.x = textureCoordinates.x * 2.0 - 1.0;
  ndcCoordinates.y = (1.0 - textureCoordinates.y) * 2.0 - 1.0;

  let depth = textureLoad(gBufferDepth, vec2<i32>(coordinates), 0);
  let worldNormalUnit = textureLoad(gBufferWorldNormals, vec2<i32>(coordinates), 0).xyz;
  let worldNormal = 2.0 * worldNormalUnit - vec3<f32>(1.0);

  let viewSpacePosition = ndcToViewSpace(vec4<f32>(ndcCoordinates, depth, 1.0));
  let viewSpaceNormal = normalize((camera.normalMatrix * vec4<f32>(worldNormal, 1.0)).xyz);

  let randomVec = normalize(textureLoad(noiseTexture, vec2<i32>(coordinates) % vec2<i32>(64, 64), 0).xyz);
  // let randomVec = vec3(0.0, 1.0, 0.0);

  let tangent = normalize(randomVec - viewSpaceNormal * dot(randomVec, viewSpaceNormal));
  let bitangent = cross(viewSpaceNormal, tangent);
  let TBN = mat3x3<f32>(tangent, bitangent, viewSpaceNormal);

  var occlusion = 0.0;
  let numberOfSamples = 4;
  for (var i = 0; i < numberOfSamples; i = i + 1) {
    // get sample position
    var samplePos = TBN * globals.noiseSamples[i].xyz; // from tangent to view-space
    samplePos = viewSpacePosition.xyz + samplePos * globals.radius;

    // project sample position (to sample texture) (to get position on
    // screen/texture)
    var sampleClipSpacePosition = vec4<f32>(samplePos, 1.0);
    sampleClipSpacePosition = camera.projection * sampleClipSpacePosition; // from view to clip-space
    sampleClipSpacePosition = sampleClipSpacePosition / sampleClipSpacePosition.w;          // perspective divide
    var offset = clamp(sampleClipSpacePosition * 0.5 + 0.5, vec4<f32>(0.0), vec4<f32>(1.0)); 
    offset = vec4<f32>(offset.x, 1.0 - offset.y, 0.0, 0.0);

    // get sample depth
    // let sampleWorldPosition = textureLoad(gBufferWorldPositions, vec2<i32>(offset.xy * camera.viewportSize), 0);
    let sampleDepth = textureLoad(gBufferDepth, vec2<i32>(offset.xy * camera.viewportSize), 0);

    // if (sampleWorldPosition.w == 0.0) {
    //   continue;
    // }

    // let sampleView = camera.view * vec4<f32>(sampleWorldPosition.xyz, 1.0);
    // let sampleDepth = sampleView.z;

    if (sampleDepth >= sampleClipSpacePosition.z) {
      occlusion = occlusion + 1.0;
    }
  }
  occlusion = occlusion / f32(numberOfSamples);

if (all(worldNormalUnit == vec3<f32>(0.0))){
  textureStore(gBufferAmbientOcclusion, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(0.0, 0.0, 0.0, 0.0));
} else {
  textureStore(gBufferAmbientOcclusion, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(occlusion, 0.0, 0.0, 0.0));
}

  // textureStore(gBufferAmbientOcclusion, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(occlusion, 0.0, 0.0, 0.0));

}