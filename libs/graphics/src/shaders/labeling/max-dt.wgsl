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
  forSelection: u32,
};

// @group(0) @binding(0) var<uniform> camera : Camera; 
@group(0) @binding(0) var<uniform> parameters: Parameters; //~ TODO: actually send this uniform from CPU

@group(1) @binding(0) var<storage, read_write> dtTexValues: array<vec4<f32>>;
@group(1) @binding(1) var<storage, read_write> idTexValues: array<vec4<f32>>; //~ this could be just u32, but this buffer is filled by texture copy, so it has all the components

var<workgroup> tileDistances : array<vec3<f32>, 128>;
var<workgroup> tileIds : array<i32, 128>;

var<workgroup> best : array<atomic<i32>, 256>;

@compute @workgroup_size(8, 8) fn 
main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>, 
     @builtin(local_invocation_id) LocalInvocationID : vec3<u32>,
     @builtin(workgroup_id) WorkgroupID: vec3<u32>) {
     if (f32(GlobalInvocationID.x) >= 512.0 ||
         f32(GlobalInvocationID.y) >= 512.0) {
          return;
    }

  let coordinates = vec2<i32>(GlobalInvocationID.xy); //~ range 0..511
  // let tid = LocalInvocationID.xy;
  let tid = LocalInvocationID.x;
  let g_tid = GlobalInvocationID.x;
  
  //~ global buffer loads
  let id = i32(idTexValues[g_tid].x);
  let dtVal = dtTexValues[g_tid];
  //~ store in shared memory:
  tileDistances[tid] = dtVal.xyz;
  tileIds[tid] = id;

  workgroupBarrier();

  if (id < 0) {
      return;
  }

  //~ where should this divergence be? to be most efficient?
  if (u32(id) != parameters.forSelection) {
    return;
  }

  let TODO: i32 = 4;
  for (var stride: i32 = 1; stride < TODO; stride++) {
    if (i32(tid) % (2*stride) == 0) {
      let distA = tileDistances[tid];
      let distB = tileDistances[i32(tid) + stride];
      if (distA.z > distB.z) {
        tileDistances[tid] = distA;
      } else {
        tileDistances[tid] = distB;
      }
      workgroupBarrier();
    }
  }



  if (tid == 0) {
    // dtTexValues[WorkgroupID.x] = vec4(tileDistances[0], 1.0);
    // idTexValues[WorkgroupID.x] = vec4(tileIds[0]);
    atomicStore(&(best[0]), i32(123));
  }
 
}