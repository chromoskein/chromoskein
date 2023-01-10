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

@group(0) @binding(0) var<uniform> camera : Camera; 

@group(1) @binding(0) var gBufferID : texture_2d<f32>;
@group(1) @binding(1) var contours : texture_storage_2d<rgba32float, write>;

fn compareIDs(X: i32, R: i32, L: i32, T: i32, B: i32) -> bool {
  return ((X == R) && (X == L) && (X == T) && (X == B));
}

@compute @workgroup_size(8, 8) fn 
main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
  if (f32(GlobalInvocationID.x) >= camera.viewportSize.x ||
      f32(GlobalInvocationID.y) >= camera.viewportSize.y) {
    return;
  }

  let coordinates = vec2<i32>(GlobalInvocationID.xy);
  let textureCoordinates = vec2<f32>(coordinates) / camera.viewportSize;

  let step = 1;
  let X = i32(textureLoad(gBufferID, vec2<i32>(coordinates) + vec2<i32>(0, 0), 0).x);
  let R = i32(textureLoad(gBufferID, vec2<i32>(coordinates) + vec2<i32>(step, 0), 0).x);
  let L = i32(textureLoad(gBufferID, vec2<i32>(coordinates) + vec2<i32>(-step, 0), 0).x);
  let T = i32(textureLoad(gBufferID, vec2<i32>(coordinates) + vec2<i32>(0, step), 0).x);
  let B = i32(textureLoad(gBufferID, vec2<i32>(coordinates) + vec2<i32>(0, -step), 0).x);

  var seedValue = vec3<f32>(0.0, 0.0, 100.0); //~ when pixel is NOT on the edge
  if (!compareIDs(X, R, L, T, B)) {
    seedValue = vec3<f32>(textureCoordinates, 0.0); //~ when pixel is on the edge
  }
 
  textureStore(contours, vec2<i32>(GlobalInvocationID.xy), vec4<f32>(seedValue, 1.0));
}