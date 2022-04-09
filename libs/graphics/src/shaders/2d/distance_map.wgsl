
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
  // Size of each LoD
  sizes: array<vec4<u32>, 8>,
  // Offset into the array of positions
  offsets: array<vec4<u32>, 8>,
  //
  maxDistances: array<vec4<f32>, 8>,
  // Currently selected LoD
  currentLoD: u32,
};


struct PositionsBuffer {
  positions: array<vec4<f32>>,
};


struct ColorsBuffer {
  colors: array<vec4<f32>>,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> globals: Globals;
@group(0) @binding(2) var<storage, read> positionsBuffer: PositionsBuffer;
@group(0) @binding(3) var<storage, read> colorsBuffer: ColorsBuffer;

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) weight: f32,
  @location(1) uv: vec2<f32>,
  @location(2) leftColor: vec3<f32>,
  @location(3) rightColor: vec3<f32>,
};

@stage(vertex)
fn main_vertex(@builtin(vertex_index) VertexIndex: u32, @builtin(instance_index) InstanceIndex: u32) -> VertexOutput {
  let squareMultiples = pow(2.0, f32(globals.currentLoD));
  let sideLength = squareMultiples * (sqrt(2.0) * 0.5);
  let sideLength2 = squareMultiples * sqrt(2.0);
  let stepVector: vec2<f32> = squareMultiples * normalize(vec2<f32>(1.0, 1.0));
  let expandConstant = 0.001;

  let currentSize = globals.sizes[globals.currentLoD / u32(4)][globals.currentLoD % u32(4)];
  let currentOffset = globals.offsets[globals.currentLoD / u32(4)][globals.currentLoD % u32(4)];

  let vertexIndex: u32 = u32(VertexIndex % u32(6));

  let leftIndex: u32 = u32(InstanceIndex);
  let diffIndex: u32 = u32(VertexIndex / u32(6));
  let rightIndex: u32 = leftIndex + diffIndex;

  var center: vec2<f32> = vec2<f32>(f32(leftIndex) * sideLength2 + sideLength, 0.0);
  center = center + f32(diffIndex) * stepVector;

  let leftPosition = positionsBuffer.positions[currentOffset + leftIndex];  
  let rightPosition = positionsBuffer.positions[currentOffset + rightIndex];  
  let dist = distance(leftPosition, rightPosition) / globals.maxDistances[globals.currentLoD / u32(4)][globals.currentLoD % u32(4)];

  var leftColor = colorsBuffer.colors[currentOffset + leftIndex].rgb;
  var rightColor = colorsBuffer.colors[currentOffset + rightIndex].rgb;

  // if (all(leftColor != rightColor) && all(leftColor == vec3<f32>(1.0))) {
  //   leftColor = rightColor;
  // } else if (all(leftColor != rightColor) && all(rightColor == vec3<f32>(1.0))) {
  //   rightColor = leftColor;
  // }

  var position: vec2<f32>;
  var uv: vec2<f32> = vec2<f32>(1.0, 0.0);
  if (diffIndex == u32(0)) {
    switch(i32(vertexIndex)) {
      // Half-Top Triangle
      case 0: {
        position = center.xy + vec2<f32>(-sideLength - expandConstant, 0.0);           
      }
      case 1: {
        position = center.xy + vec2<f32>(sideLength + expandConstant, 0.0); 
          
      }
      case 2: {
        position = center.xy +  vec2<f32>(0.0, sideLength + expandConstant);           
      }
      // Discard the rest
      default: {
        position = center.xy;
      }
    }
  } else {
    switch(i32(vertexIndex)) {
      // Left Triangle
      case 0: {
        uv = vec2<f32>(1.0, 0.0);
        position = center.xy +  vec2<f32>(0.0, sideLength + expandConstant);  
      }
      case 1: {
        uv = vec2<f32>(1.0, 0.0);
        position = center.xy + vec2<f32>(-sideLength - expandConstant, 0.0);                  
      }
      case 2: {    
        uv = vec2<f32>(0.0, 0.0);        
        position = center.xy + vec2<f32>(0.0, -sideLength - expandConstant);          
      }
      // Right Triangle
      case 3: {
        uv = vec2<f32>(1.0, 0.0);
        position = center.xy +  vec2<f32>(0.0, sideLength + expandConstant);         
      }
      case 4: {
        uv = vec2<f32>(0.0, 0.0);
        position = center.xy + vec2<f32>(sideLength + expandConstant, 0.0);           
      }
      default: { // 5
        uv = vec2<f32>(0.0, 0.0);
        position = center.xy + vec2<f32>(0.0, -sideLength - expandConstant);  
      }
    }
  }

  if (leftIndex == rightIndex) {
    return VertexOutput(
      camera.projectionView * vec4<f32>(position, 0.0, 1.0),
      0.0,
      uv,
      leftColor,
      rightColor
    );
  }

  return VertexOutput(
    camera.projectionView * vec4<f32>(position, 0.0, 1.0),
    dist,
    uv,
    leftColor,
    rightColor
  );
}

struct FragmentOutput {
  @location(0) color: vec4<f32>,
};

@stage(fragment)
fn main_fragment(
    @location(0) weight: f32,
    @location(1) uv: vec2<f32>,
    @location(2) leftColor: vec3<f32>,
    @location(3) rightColor: vec3<f32>,
) -> FragmentOutput {
  var finalColor: vec3<f32>;

  if (uv.x > 0.5) {
    finalColor = leftColor;
  } else {
    finalColor = rightColor;
  }

  finalColor = 0.5 * vec3<f32>(weight) + 0.5 * finalColor;
  return FragmentOutput(
    vec4<f32>(finalColor, 1.0)
  );
}
