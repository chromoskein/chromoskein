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
@group(1) @binding(1) var contours : texture_2d<f32>;

@stage(compute) @workgroup_size(8, 8) fn 
main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
   if (f32(GlobalInvocationID.x) >= camera.viewportSize.x ||
      f32(GlobalInvocationID.y) >= camera.viewportSize.y) {
    return;

    // error bro;
  }
}