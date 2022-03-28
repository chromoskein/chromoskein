@group(0) @binding(0) var gBufferAmbientOcclusionNear: texture_2d<f32>;
@group(0) @binding(1) var gBufferAmbientOcclusionFar: texture_2d<f32>;
@group(0) @binding(2) var gBufferAmbientOcclusionOutput: texture_storage_2d<r32float, write>;

@stage(compute) @workgroup_size(8, 8) fn
main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
  let textureSize: vec2<i32> = textureDimensions(gBufferAmbientOcclusionNear);

  if (i32(GlobalInvocationID.x) >= textureSize.x ||
      i32(GlobalInvocationID.y) >= textureSize.y) {
    return;
  }

  let coordinates = vec2<i32>(GlobalInvocationID.xy);

  let near: f32 = textureLoad(gBufferAmbientOcclusionNear, vec2<i32>(coordinates), 0).x;
  let far: f32 = textureLoad(gBufferAmbientOcclusionFar, vec2<i32>(coordinates), 0).x;

// (((far * 255.0) * (near * 255.0)) / 255.0) / 255.0
  textureStore(gBufferAmbientOcclusionOutput, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(1.0 - ((1.0 - near) * (1.0 - far)), 0.0, 0.0, 0.0));
}