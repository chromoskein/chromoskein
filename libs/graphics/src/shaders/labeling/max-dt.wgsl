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

@group(1) @binding(0) var idTex : texture_2d<f32>;
@group(1) @binding(1) var dtTex : texture_2d<f32>;

struct Candidate{
    regionId: f32,
    dtValue: f32,
    uvPosition: vec2<f32>,
}

@group(2) @binding(0) var<storage, read_write> bestCandidates: array<Candidate>;

@stage(compute) @workgroup_size(8, 8) fn 
main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    //~ this guard is bullshit IMHO
    // if (f32(GlobalInvocationID.x) >= camera.viewportSize.x ||
    //   f32(GlobalInvocationID.y) >= camera.viewportSize.y) {
    //       return;
    // }
    if (f32(GlobalInvocationID.x) >= 512.0 ||
      f32(GlobalInvocationID.y) >= 512.0) {
          return;
    }

  let coordinates = vec2<i32>(GlobalInvocationID.xy);
//   let textureCoordinates = vec2<f32>(coordinates) / camera.viewportSize;
  let textureCoordinates = vec2<f32>(coordinates) / vec2<f32>(512.0, 512.0);
  let fullscreenSize = textureDimensions(idTex);
//   let fullscreenCoordinates = vec2<i32>(0, 0);
  let fullscreenCoordinates = vec2<i32>(textureCoordinates * vec2<f32>(fullscreenSize));

//   let id = i32(textureLoad(idTex, coordinates, 0).x);
  let id = i32(textureLoad(idTex, fullscreenCoordinates, 0).x);
  let dtVal = textureLoad(dtTex, coordinates, 0);

  if (id < 0) {
      return;
  }

  let bestSoFar = bestCandidates[id];
  if (dtVal.z > bestSoFar.dtValue) {
    bestCandidates[id].regionId = f32(id);
    bestCandidates[id].uvPosition = dtVal.xy;
    bestCandidates[id].dtValue = dtVal.z;
  }

    //~ test
    // bestCandidates[id].dtValue = dtVal.z;

    // bestCandidates[0].regionId = 1;
    // bestCandidates[0].regionId = 1.0;
    // bestCandidates[0].uvPosition = vec2<f32>(23.1, 3.0);
    // bestCandidates[0].dtValue = 1.0;
  
}