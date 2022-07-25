@group(0) @binding(0) var idTex: texture_2d<f32>;
@group(0) @binding(1) var dtTex: texture_2d<f32>;

@group(1) @binding(0) var<storage, read_write> labelsResultBuffer: array<atomic<i32>>;
//~ |   0    |1|2|   3   |4|5|6|7|8|...
//~ |regionId|x|y|dtValue| | | | | |...

var<workgroup> tileDistances : array<vec3<f32>, 128>; //~ (seedU, seedV, distance, 1.0)
var<workgroup> tileIds : array<vec3<f32>, 128>;

var<workgroup> best : array<atomic<i32>, 256>;

// @compute @workgroup_size(64, 1, 1) fn 
@compute @workgroup_size(8, 8) fn 
main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>, 
     @builtin(local_invocation_id) LocalInvocationID : vec3<u32>,
     @builtin(workgroup_id) WorkgroupID: vec3<u32>,
     @builtin(num_workgroups) NumWorkgroups: vec3<u32>) {

  const blockWith = 8;
  const imageWidth = 512;
  let tid = LocalInvocationID.y * blockWith + LocalInvocationID.x;
  let g_tid = GlobalInvocationID.y * imageWidth + GlobalInvocationID.x;
  //~ getting the (u,v) coordinates of thread
  let tid_u = GlobalInvocationID.x;
  let tid_v = GlobalInvocationID.y;
  
  //~ global buffer loads
  let idVal = textureLoad(idTex, vec2<i32>(GlobalInvocationID.xy), 0);
  let dtVal = textureLoad(dtTex, vec2<i32>(GlobalInvocationID.xy), 0);
  //~ store in shared memory:
  tileDistances[tid] = dtVal.xyz;
  tileIds[tid] = vec3(idVal.xyz); //~ just copy

  workgroupBarrier();

  let regionId = i32(idVal.x);
  if (regionId < 0) {
    return;
    }
  let bestBaseIndex = regionId * 4;
  let currentBest_regionId = atomicLoad(&(labelsResultBuffer[bestBaseIndex])); //~ dont actually need
  let currentBest_u = atomicLoad(&(labelsResultBuffer[bestBaseIndex + 1])); //~ dont actually need
  let currentBest_v = atomicLoad(&(labelsResultBuffer[bestBaseIndex + 2])); //~ dont actually need
  let currentBest_dtVal = atomicLoad(&(labelsResultBuffer[bestBaseIndex + 3]));
 
  let dtValInt = i32(dtVal.z * 1000000);
  
  // if (currentBest_dtVal <= dtVal.z) { //~ this conversions doesn't make sense but for now...
  if (currentBest_dtVal <= dtValInt) { 
    atomicStore(&(labelsResultBuffer[bestBaseIndex]), regionId);
    atomicStore(&(labelsResultBuffer[bestBaseIndex + 1]), i32(tid_u));
    atomicStore(&(labelsResultBuffer[bestBaseIndex + 2]), i32(tid_v));
    // atomicStore(&(labelsResultBuffer[bestBaseIndex + 3]), i32(dtVal.z));
    atomicStore(&(labelsResultBuffer[bestBaseIndex + 3]), dtValInt);
  }

  // if (tid == 0) {
  //   // let writeIndex = WorkgroupID.y * NumWorkgroups.x + WorkgroupID.x;
  //   // dtTexValues[writeIndex] = vec4(tileDistances[0], 1.0);
  //   // idTexValues[writeIndex] = vec4(tileIds[0], 1.0);
  //   // atomicStore(&(best[0]), i32(123));
  //   atomicStore(&(labelsResultBuffer[0]), i32(123));
  // }
 
}