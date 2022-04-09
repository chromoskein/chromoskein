
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

// Bounding rectangle in NDC/Screen-space coordinates.
struct BoundingRectangle {
    //
    center: vec2<f32>,
    
    // Half of the width and height that the bounding rectangle covers.
    // You can use this to quickly calculate all 4 points of the rectangle while 
    // this structure remains small in size.
    half_size: vec2<f32>,
};

let D: mat4x4<f32> = mat4x4<f32>(
    vec4<f32>(1.0, 0.0, 0.0, 0.0),
    vec4<f32>(0.0, 1.0, 0.0, 0.0),
    vec4<f32>(0.0, 0.0, 1.0, 0.0),
    vec4<f32>(0.0, 0.0, 0.0, -1.0)
);

// Chrome
fn transpose2(m: mat4x4<f32>) -> mat4x4<f32> {
  return mat4x4<f32>(
    vec4<f32>(m[0].x, m[1].x, m[2].x, m[3].x),
    vec4<f32>(m[0].y, m[1].y, m[2].y, m[3].y),
    vec4<f32>(m[0].z, m[1].z, m[2].z, m[3].z),
    vec4<f32>(m[0].w, m[1].w, m[2].w, m[3].w)
  );
}

fn sphereBoundingRectangle(sphere: Sphere, projectionView: mat4x4<f32>) -> BoundingRectangle {
  let T: mat4x4<f32> = mat4x4<f32>(
        vec4<f32>(sphere.radius, 0.0, 0.0, 0.0),
        vec4<f32>(0.0, sphere.radius, 0.0, 0.0),
        vec4<f32>(0.0, 0.0, sphere.radius, 0.0),
        vec4<f32>(sphere.position.x, sphere.position.y, sphere.position.z, 1.0)
  );

  let R: mat4x4<f32> = transpose2(projectionView * T);

  let roots_horizontal: vec2<f32> = quadraticRoots(dot(R[3], D * R[3]), -2.0 * dot(R[0], D * R[3]), dot(R[0], D * R[0]));
  let half_width: f32 = abs(roots_horizontal.x - roots_horizontal.y) * 0.5;

  let roots_vertical: vec2<f32> = quadraticRoots(dot(R[3], D * R[3]), -2.0 * dot(R[1], D * R[3]), dot(R[1], D * R[1]));
  let half_height: f32 = abs(roots_vertical.x - roots_vertical.y) * 0.5;

  var center: vec4<f32> = vec4<f32>(dot(R[0], D * R[3]), dot(R[1], D * R[3]), 0.0, dot(R[3], D * R[3]));
  center.x = center.x / center.w;
  center.y = center.y / center.w;

  return BoundingRectangle(center.xy, vec2<f32>(half_width, half_height));
}

//
struct CullObject {
  ty: u32,

  content: array<u32, 31>,
};


struct CullObjectsBuffer {
    @size(128) len: u32,
    objects:  array<CullObject>,
};