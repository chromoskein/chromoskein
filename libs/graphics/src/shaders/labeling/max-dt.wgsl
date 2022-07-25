//  struct Camera {
//   projection : mat4x4<f32>,
//   projectionInverse : mat4x4<f32>,
//   view : mat4x4<f32>,
//   viewInverse : mat4x4<f32>,
//   projectionView : mat4x4<f32>,
//   projectionViewInverse : mat4x4<f32>,
//   normalMatrix: mat4x4<f32>,
//   position : vec4<f32>,
//   viewportSize : vec2<f32>,
// };

struct Parameters {
  forSelection: f32,
  iteration: f32, //~ iteration id, to catch the first one primarily
};

// @group(0) @binding(0) var<uniform> camera : Camera; 
@group(0) @binding(0) var<uniform> parameters: Parameters; //~ TODO: actually send this uniform from CPU

@group(1) @binding(0) var<storage, read_write> dtTexValues: array<vec4<f32>>;
@group(1) @binding(1) var<storage, read_write> idTexValues: array<vec4<f32>>; //~ this could be just u32, but this buffer is filled by texture copy, so it has all the components

var<workgroup> tileDistances : array<vec3<f32>, 128>; //~ (seedU, seedV, distance, 1.0)
// var<workgroup> tileIds : array<i32, 128>;
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
  let idVal = idTexValues[g_tid];
  let dtVal = dtTexValues[g_tid];
  //~ store in shared memory:
  tileDistances[tid] = dtVal.xyz;
  if (u32(parameters.iteration) == 1) {
    tileIds[tid] = vec3(idVal.x, f32(tid_u), f32(tid_v)); //~ first iteration: save UV
  } else {
    tileIds[tid] = vec3(idVal.xyz); //~ just copy
  }

  workgroupBarrier();

  let wantedId = i32(parameters.forSelection);
  let TODO: i32 = blockWith * blockWith;
  for (var stride: i32 = 1; stride < TODO; stride++) {
    if (i32(tid) % (2*stride) == 0) {
      let distA = tileDistances[tid];
      let distB = tileDistances[i32(tid) + stride];
      let idA = tileIds[tid]; //~ can be: what I want or not (different or -1)
      let idB = tileIds[i32(tid) + stride];
      
      if (i32(idA.x) != wantedId) && (i32(idB.x) == wantedId) {
        //~ pick B
        tileDistances[tid] = distB;
        tileIds[tid] = idB;
      }
      if (i32(idA.x) == wantedId) && (i32(idB.x) != wantedId) {
        //~ pick A
        tileDistances[tid] = distA;
        tileIds[tid] = idA;
      }
      if (i32(idA.x) == wantedId) && (i32(idB.x) == wantedId) {
        if (distB.z > distA.z) {
          tileDistances[tid] = distB;
          tileIds[tid] = idB;
      }
      }

      workgroupBarrier();
    }
  }



  if (tid == 0) {
    let writeIndex = WorkgroupID.y * NumWorkgroups.x + WorkgroupID.x;
    dtTexValues[writeIndex] = vec4(tileDistances[0], 1.0);
    idTexValues[writeIndex] = vec4(tileIds[0], 1.0);
    // atomicStore(&(best[0]), i32(123));
  }
 
}