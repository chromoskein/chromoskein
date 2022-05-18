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
// @group(1) @binding(1) var outputTex : texture_storage_2d<rgba32float, write>;
@group(1) @binding(1) var dtTex : texture_2d<f32>;

struct Candidate{
    regionId: i32,
    dtValue: f32,
    uvPosition: vec2<f32>,
}

// @group(2) @binding(0) var<storage, read> input: array<Candidate>;
@group(2) @binding(0) var<storage, write> bestCandidates: array<Candidate>;
// @group(2) @binding(1) var<storage, write> output: array<Candidate>;

@stage(compute) @workgroup_size(8, 8) fn 
main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    if (f32(GlobalInvocationID.x) >= camera.viewportSize.x ||
      f32(GlobalInvocationID.y) >= camera.viewportSize.y) {
          return;
    }

  let coordinates = vec2<i32>(GlobalInvocationID.xy);
  let textureCoordinates = vec2<f32>(coordinates) / camera.viewportSize;

  let id = i32(textureLoad(idTex, coordinates, 0).x);
  let dtVal = textureLoad(dtTex, coordinates, 0);

//   let bestSoFar = bestCandidates[id];
//   if (dtVal.z > bestSoFar.dtValue) {
//     bestCandidates[id].regionId = id;
//     bestCandidates[id].uvPosition = dtVal.xy;
//     bestCandidates[id].dtVal = dtVal.z;
//   }

    //~ test
    // bestCandidates[id].dtValue = dtVal.z;

    bestCandidates[0].regionId = 1;
    bestCandidates[0].uvPosition = vec2<f32>(2.0, 3.0);
    bestCandidates[0].dtValue = 1.0;
  
}