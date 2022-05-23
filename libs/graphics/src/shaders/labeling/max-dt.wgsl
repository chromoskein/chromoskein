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
     if (f32(GlobalInvocationID.x) >= 512.0 ||
      f32(GlobalInvocationID.y) >= 512.0) {
          return;
    }
//    if (f32(GlobalInvocationID.x) >= 1024.0 ||
//       f32(GlobalInvocationID.y) >= 1024.0) {
//           return;
//     }

  let coordinates = vec2<i32>(GlobalInvocationID.xy); //~ range 0..511
  let textureCoordinates = vec2<f32>(coordinates) / vec2<f32>(512.0, 512.0);
//   let textureCoordinates = vec2<f32>(coordinates) / vec2<f32>(1024.0, 1024.0);
  let fullscreenSize = textureDimensions(idTex);
  let fullscreenCoordinates = vec2<i32>(textureCoordinates * vec2<f32>(fullscreenSize));

  let id = i32(textureLoad(idTex, fullscreenCoordinates, 0).x);
  let dtVal = textureLoad(dtTex, coordinates, 0);

  if (id < 0) {
      return;
  }

  //~ debug
  bestCandidates[123].regionId = 123.0;
  bestCandidates[123].dtValue = 0.0;
  bestCandidates[123].uvPosition = vec2<f32>(f32(fullscreenSize.x), f32(fullscreenSize.y));

    if (dtVal.z > 1.0) {
  bestCandidates[42].regionId = 42.0;
  bestCandidates[42].dtValue = 123.0;
  bestCandidates[42].uvPosition = vec2<f32>(0.5, 0.5);

    }

  let bestSoFar = bestCandidates[id];
//   let valDiff = bestSoFar.dtValue - dtVal.z;
//   if ((valDiff < 0.0) && (abs(valDiff) > 0.0) && (abs(valDiff) > 0.01)) {
  if (dtVal.z > bestSoFar.dtValue) {
    // bestCandidates[id].regionId = f32(id);
    // bestCandidates[id].uvPosition = dtVal.xy;
    // bestCandidates[id].dtValue = dtVal.z;
    // bestCandidates[id] = Candidate(
    //     f32(id), 
    //     dtVal.z,
    //     textureCoordinates);
    //     // dtVal.xy);

    let newBest = Candidate(f32(id), dtVal.z, textureCoordinates);
    // atomicStore(&(bestCandidates[id]), newBest);

  }

    //~ test
    // bestCandidates[id].dtValue = dtVal.z;

    // bestCandidates[0].regionId = 1;
    // bestCandidates[0].regionId = 1.0;
    // bestCandidates[0].uvPosition = vec2<f32>(23.1, 3.0);
    // bestCandidates[0].dtValue = 1.0;
  
}