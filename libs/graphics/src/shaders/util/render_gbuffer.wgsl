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

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) textureCoordinates : vec2<f32>,
};

@stage(vertex)
fn main_vertex(@builtin(vertex_index) VertexIndex : u32)
        -> VertexOutput {
    return VertexOutput(
        vec4<f32>(
            f32(VertexIndex / u32(2)) * 4.0 - 1.0,
            f32(VertexIndex % u32(2)) * 4.0 - 1.0,
            0.0, 1.0
        ),
        vec2<f32>(
            f32(VertexIndex / u32(2)) * 2.0,
            1.0 - f32(VertexIndex % u32(2)) * 2.0,
        )
    );
}


struct Globals {
    ambientOcclusionTaps: i32,
    resetAmbientOcclusion: i32,
};

@group(0) @binding(0) var gBufferColorsOpaque : texture_2d<f32>;
@group(0) @binding(1) var gBufferColorsTransparent : texture_2d<f32>;
@group(0) @binding(2) var gBufferDepth : texture_depth_2d;
@group(0) @binding(3) var gBufferWorldNormals : texture_2d<f32>;
@group(0) @binding(4) var gBufferAmbientOcclusion : texture_2d<f32>;
@group(0) @binding(5) var<uniform> globals: Globals;
@group(0) @binding(6) var<uniform> camera : Camera;

@stage(fragment)
fn main_fragment(@builtin(position) Position : vec4<f32>,
        @location(0) textureCoordinates : vec2<f32>)
     -> @location(0) vec4<f32> {
  let dimensions = vec2<f32>(textureDimensions(gBufferColorsOpaque));
  let coordinates = textureCoordinates * dimensions;

  let colorOpaque = textureLoad(gBufferColorsOpaque, vec2<i32>(coordinates), 0).xyz;
  let colorTransparent = textureLoad(gBufferColorsTransparent, vec2<i32>(coordinates), 0).rgba;
  let worldNormalUnit = textureLoad(gBufferWorldNormals, vec2<i32>(coordinates), 0).xyz;

  let ao = 1.0 - textureLoad(gBufferAmbientOcclusion, vec2<i32>(coordinates), 0).x;
//   let ao = textureLoad(gBufferAmbientOcclusion, vec2<i32>(coordinates), 0).x;

  // if (all(worldNormalUnit == vec3<f32>(0.0))) {
  //   return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  // } else {
  //   return vec4<f32>(1.0);
  // }

  return vec4<f32>((ao * colorOpaque) * (1.0 - colorTransparent.a) + colorTransparent.rgb * colorTransparent.a, 1.0);
  // let gamma = 1.0 / 2.2;
  // return vec4<f32>(pow(ao * colorOpaque.rgb, vec3<f32>(gamma)), 1.0);
  // return vec4<f32>(ao, ao, ao, 1.0);
  // return vec4<f32>(ao * colorOpaque.rgb, 1.0);  
}
