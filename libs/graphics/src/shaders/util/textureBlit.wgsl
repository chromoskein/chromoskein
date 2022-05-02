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

@group(0) @binding(0) var input : texture_2d<f32>;

@stage(fragment)
fn main_fragment(@builtin(position) Position : vec4<f32>,
        @location(0) textureCoordinates : vec2<f32>)
     -> @location(0) vec4<f32> {
  let dimensions = vec2<f32>(textureDimensions(input));
  let coordinates = textureCoordinates * dimensions;

  let result = textureLoad(
    input,
    vec2<i32>(coordinates),
    0
  ).xyz;

  return vec4<f32>(result, 1.0);
}