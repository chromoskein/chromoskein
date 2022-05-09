@group(0) @binding(0) var colorTexture : texture_2d<f32>;
@group(0) @binding(1) var normalTexture : texture_2d<f32>;
@group(0) @binding(2) var depthTexture : texture_depth_2d;

@group(0) @binding(3) var outputTex : texture_storage_2d<r32float, write>;

@stage(compute) @workgroup_size(8, 8, 1)
fn main(
  @builtin(global_invocation_id) GlobalInvocationID: vec3<u32>,
  @builtin(workgroup_id) WorkGroupID: vec3<u32>,
  @builtin(local_invocation_id) LocalInvocationID: vec3<u32>
) {
    var offset: array<vec2<i32>,  25>;
    offset[0]  = vec2<i32>(-2, -2);
    offset[1]  = vec2<i32>(-1, -2);
    offset[2]  = vec2<i32>(0, -2);
    offset[3]  = vec2<i32>(1, -2);
    offset[4]  = vec2<i32>(2, -2);    
    offset[5]  = vec2<i32>(-2, -1);
    offset[6]  = vec2<i32>(-1, -1);
    offset[7]  = vec2<i32>(0, -1);
    offset[8]  = vec2<i32>(1, -1);
    offset[9]  = vec2<i32>(2, -1);    
    offset[10] = vec2<i32>(-2, 0);
    offset[11] = vec2<i32>(-1, 0);
    offset[12] = vec2<i32>(0, 0);
    offset[13] = vec2<i32>(1, 0);
    offset[14] = vec2<i32>(2, 0);    
    offset[15] = vec2<i32>(-2, 1);
    offset[16] = vec2<i32>(-1, 1);
    offset[17] = vec2<i32>(0, 1);
    offset[18] = vec2<i32>(1, 1);
    offset[19] = vec2<i32>(2, 1);    
    offset[20] = vec2<i32>(-2, 2);
    offset[21] = vec2<i32>(-1, 2);
    offset[22] = vec2<i32>(0, 2);
    offset[23] = vec2<i32>(1, 2);
    offset[24] = vec2<i32>(2, 2);    
    
    var kernel: array<f32,  25>;
    kernel[0] = 1.0/256.0;
    kernel[1] = 1.0/64.0;
    kernel[2] = 3.0/128.0;
    kernel[3] = 1.0/64.0;
    kernel[4] = 1.0/256.0;    
    kernel[5] = 1.0/64.0;
    kernel[6] = 1.0/16.0;
    kernel[7] = 3.0/32.0;
    kernel[8] = 1.0/16.0;
    kernel[9] = 1.0/64.0;    
    kernel[10] = 3.0/128.0;
    kernel[11] = 3.0/32.0;
    kernel[12] = 9.0/64.0;
    kernel[13] = 3.0/32.0;
    kernel[14] = 3.0/128.0;    
    kernel[15] = 1.0/64.0;
    kernel[16] = 1.0/16.0;
    kernel[17] = 3.0/32.0;
    kernel[18] = 1.0/16.0;
    kernel[19] = 1.0/64.0;
    
    kernel[20] = 1.0/256.0;
    kernel[21] = 1.0/64.0;
    kernel[22] = 3.0/128.0;
    kernel[23] = 1.0/64.0;
    kernel[24] = 1.0/256.0;

  let resolution : vec2<i32> = textureDimensions(colorTexture, 0);
  let tx = vec2<i32>(GlobalInvocationID.xy);

  if (tx.x >= resolution.x ||
      tx.y >= resolution.y) {
    return;
  } 

  var sum = 0.0;  

  let cval = textureLoad(colorTexture, tx, 0).r;
  let nval = textureLoad(normalTexture, tx, 0).xyz;
  let pval = textureLoad(depthTexture, tx, 0);

  if (pval == 0.0) {
    textureStore(outputTex, tx, vec4<f32>(cval, 0.0, 0.0, 0.0));
    return;
  }

  let c_phi = 1.0;
  let p_phi = 1.0;
  var cum_w = 0.0;
  for (var i = 0; i < 25; i = i + 1) {
    let uv = tx + offset[i];

    let ptmp = textureLoad(depthTexture, uv, 0);
    let ntmp = textureLoad(normalTexture, uv, 0).xyz;   
    let ctmp = textureLoad(colorTexture, uv, 0).r;

    if (ptmp == 0.0) {
      continue;
    }

    let t = cval - ctmp;                                // color/ao
    let c_w = clamp(1.0 - t*t / c_phi, 0.0, 1.0); // color/ao

    let pt = abs(pval - ptmp);                          // depth
    let p_w = clamp(1.0 - pt*pt, 0.0, 1.0);          // depth

    let n_w = dot(nval, ntmp);                          // normal

    // let weight = c_w * p_w * n_w * kernel[i];
    let weight = c_w * n_w * kernel[i];

    sum = sum + ctmp * weight;
    cum_w = cum_w + weight;
  }

  textureStore(outputTex, tx, vec4<f32>(sum / cum_w, 0.0, 0.0, 0.0));
}
