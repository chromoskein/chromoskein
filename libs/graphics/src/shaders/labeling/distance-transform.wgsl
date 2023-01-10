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

struct DTStepParams {
    stepSize: f32,
    widthScale: f32,
    heightScale: f32,
}

@group(0) @binding(0) var<uniform> camera : Camera; 

@group(1) @binding(0) var inputTex : texture_2d<f32>;
@group(1) @binding(1) var outputTex : texture_storage_2d<rgba32float, write>;

@group(2) @binding(0) var<uniform> params: DTStepParams;


fn scaleDistance(a: vec2<f32>, b: vec2<f32>, widthScale: f32, heightScale: f32) -> f32 {
    let dx = (b.x - a.x) * widthScale;
    let dy = (b.y - a.y) * heightScale;
    return sqrt(dx*dx + dy*dy);
}

@compute @workgroup_size(8, 8) fn 
main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
  if (f32(GlobalInvocationID.x) >= 512.0 ||
      f32(GlobalInvocationID.y) >= 512.0) {
    return;
  }
  // if (f32(GlobalInvocationID.x) >= 1024.0 ||
  //     f32(GlobalInvocationID.y) >= 1024.0) {
  //   return;
  // }
  let coordinates = vec2<i32>(GlobalInvocationID.xy);
  let textureCoordinates = vec2<f32>(coordinates) / vec2<f32>(512.0, 512.0);
  // let textureCoordinates = vec2<f32>(coordinates) / vec2<f32>(1024.0, 1024.0);
  let uv = textureCoordinates;

  var centralVal = textureLoad(inputTex, coordinates, 0);

    let k: i32 = i32(params.stepSize);
    let offset: array<vec2<i32>, 8> = array<vec2<i32>, 8>(
        vec2<i32>(k, 0),
        vec2<i32>(-k, 0),
        vec2<i32>(0, k),
        vec2<i32>(0, -k),
        vec2<i32>(k, k),
        vec2<i32>(-k, -k),
        vec2<i32>(k, -k),
        vec2<i32>(-k, k)
    );

    for(var j: i32 = 0; j < 8; j++) {
        let off = offset[j];
        let val = textureLoad(inputTex, coordinates + off, 0); 

        let d1 = centralVal.z;
        let d2 = scaleDistance(uv, val.xy, params.widthScale, params.heightScale);

        if (d1 > d2) {
            centralVal = vec4(val.xy, d2, val.w);
        }
    }

    textureStore(outputTex, coordinates, centralVal);
}