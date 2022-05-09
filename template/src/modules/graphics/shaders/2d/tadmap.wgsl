
struct Camera {
    projection: mat4x4<f32>,
    projectionInverse: mat4x4<f32>,
    view: mat4x4<f32>,
    viewInverse: mat4x4<f32>,
    projectionView: mat4x4<f32>,
    projectionViewInverse: mat4x4<f32>,
    normalMatrix: mat4x4<f32>,
    position: vec4<f32>,
    viewportSize: vec2<f32>,
};


struct Globals {
  // Number of columns/rows of weights  
  size: i32,
  // Number of mip levels in weights buffer
  mipLevels: i32,
};


struct WeightsBuffer {
  // Length must be at least (size * (size + 1) / 2)
  // Longer length indicates that there are mip levels. Each mip level must 
  // have length floor(previous size / 4)
  weights: array<f32>,
};


struct ColorsBuffer {
  colors: array<vec4<f32>>,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> globals: Globals;
@group(0) @binding(2) var<storage, read> weightsBuffer: WeightsBuffer;
@group(0) @binding(3) var<storage, read> colorsBuffer: ColorsBuffer;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) weight : f32,
  @location(2) color : vec3<f32>,
};

@stage(vertex)
fn main_vertex(@builtin(vertex_index) VertexIndex : u32,
               @builtin(instance_index) InstanceIndex : u32
) -> VertexOutput {
  let c: f32 = f32(InstanceIndex);
  let n: f32 = (-1.0 + sqrt(1.0 + 4.0*2.0*c)) / 2.0;

  let i: f32 = floor(n);
  let j: f32 = c - i*(i + 1.0) / 2.0;

  if (j > i) {
    return VertexOutput(
      vec4<f32>(0.0, 0.0, 0.0, 0.0),
      vec2<f32>(0.0, 0.0),
      0.0,
      vec3<f32>(0.0, 0.0, 0.0),
    );
  }

  let stepVector: vec2<f32> = normalize(vec2<f32>(1.0, 1.0));

  var center: vec2<f32> = vec2<f32>(f32(globals.size - 1) * (2.0 * 0.7071) + 0.7071 - i * (2.0 * 0.7071), 0.0);
  center = center + j * stepVector;

  let leftX: f32 = center.x - center.y;  
  let rightX: f32 = center.x + center.y;
  var leftIndex: i32 = i32(floor(leftX / 1.4142));
  var rightIndex: i32 = i32(floor(rightX / 1.4142));

  let totalSum: i32 = ((globals.size - 1) * (globals.size)) / 2;
  var index: i32 = globals.size - leftIndex - 1;
  index = ((index) * (index+1)) / 2;
  index = totalSum - index;

  // Compute color index
  let totalColorsSum = ((globals.size + 1) * (globals.size)) / 2;
  let leftInverse = globals.size - leftIndex;
  var colorIndex = totalColorsSum - (((leftInverse + 1) * leftInverse) / 2);
  colorIndex = colorIndex + rightIndex;
  //

  var position: vec2<f32>;
  var uv: vec2<f32> = vec2<f32>(0.0, 0.0);
  if (j == 0.0) {
    switch(i32(VertexIndex) % 4) {
      case 0: {
        uv = vec2<f32>(1.0, 0.0);
        position = center.xy + vec2<f32>(-0.7071, 0.0);            
      }
      case 1: {
        uv = vec2<f32>(0.0, 1.0);
        position = center.xy + vec2<f32>(0.0, 0.7071);         
      }
      case 2: {
        uv = vec2<f32>(0.0, 0.0);
        position = center.xy + vec2<f32>(0.7071, 0.0);
      }
      default: { // 3
        uv = vec2<f32>(0.0, 1.0);
        position = center.xy + vec2<f32>(0.7071, 0.0);
      }
    }
  } else {
    switch(i32(VertexIndex) % 4) {
      case 0: {
        uv = vec2<f32>(1.0, 1.0);
        position = center.xy + vec2<f32>(-0.0, -0.7071);
      }
      case 1: {
        uv = vec2<f32>(1.0, 0.0);
        position = center.xy + vec2<f32>(0.7071, -0.0);              
      }
      case 2: {
        uv = vec2<f32>(0.0, 1.0);
        position = center.xy + vec2<f32>(-0.7071, 0.0); 
          
      }
      default: { // 3
        uv = vec2<f32>(0.0, 0.0);
        position = center.xy +  vec2<f32>(0.0, 0.7071);           
      }
    }
  }

  if (leftIndex == rightIndex) {
    return VertexOutput(
      camera.projectionView * vec4<f32>(position, 0.0, 1.0),
      uv,
      1.0,
      colorsBuffer.colors[colorIndex].xyz
    );
  }

  return VertexOutput(
    camera.projectionView * vec4<f32>(position, 0.0, 1.0),
    uv,
    weightsBuffer.weights[index + (rightIndex - leftIndex) - 1],
    colorsBuffer.colors[colorIndex].xyz
  );
}

fn rand(co: vec2<f32>) -> f32 {
    return fract(sin(dot(co, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

struct FragmentOutput {
  @location(0) color : vec4<f32>,
};

@stage(fragment)
fn main_fragment(
                 @location(0) uv: vec2<f32>,
                 @location(1) weight : f32,
                 @location(2) color : vec3<f32>,
                 ) -> FragmentOutput {
  let center: vec2<f32> = vec2<f32>(0.0, 0.0);
  let distX: f32 = abs(uv.x - 0.5);
  let distY: f32 = abs(uv.y - 0.5);
  let manhattanDistance: f32 = distX + distY;

  // if (distX > 0.49|| distY > 0.49) {
  //   return FragmentOutput(
  //     1.0,
  //     vec4<f32>(1.0, 1.0, 1.0, 1.0)
  //   );
  // }

  let t: f32 = weight;
  // var finalColor: vec3<f32> = (1.0 - t) * vec3<f32>(1.0, 0.0, 0.0) + (t) * vec3<f32>(1.0, 1.0, 1.0);
  let finalColor = 0.5 * vec3<f32>(t) + 0.5 * color;

  return FragmentOutput(
    vec4<f32>(finalColor, 1.0)
  );
}
