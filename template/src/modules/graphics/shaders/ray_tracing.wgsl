// Half line ray.
struct Ray {
    // Origin of the ray.
    origin: vec3<f32>,

    // Direction of the ray.
    direction: vec3<f32>,
};

fn make_orthonormal_basis(n: vec3<f32>) -> array<vec3<f32>, 2>
{
  var b1: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);
  var b2: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);

  if(n.z < 0.0) {
    let a: f32 = 1.0 / (1.0 - n.z);
    let b: f32 = n.x * n.y * a;

    b1 = vec3<f32>(1.0 - n.x * n.x * a, -b, n.x);
    b2 = vec3<f32>(b, n.y * n.y*a - 1.0, -n.y);
  } else {
    let a: f32= 1.0 / (1.0 + n.z);
    let b: f32 = -n.x * n.y * a;

    b1 = vec3<f32>(1.0 - n.x * n.x * a, b, -n.x);
    b2 = vec3<f32>(b, 1.0 - n.y * n.y * a, -n.y);
  }

  return array<vec3<f32>, 2>(b1, b2);
}

fn inverseView(a: vec2<f32>) -> mat3x3<f32>
{
    let c: vec2<f32> = cos(a);
    let s: vec2<f32> = sin(a);
    return mat3x3<f32>(
      vec3<f32>(c.y, 0.0, -s.y),
      vec3<f32>(s.x*s.y, c.x, s.x*c.y),
      vec3<f32>(c.x*s.y, -s.x, c.x*c.y));
}

//
struct Sphere {
    // Center of the sphere.
    position: vec3<f32>,
    
    // Radius of the sphere.
    radius: f32,
};

//
struct Cylinder {
    // 
    from: vec3<f32>,
    // 
    to: vec3<f32>,
    //
    radius: f32,
};

struct Plane {
  origin: vec3<f32>,
  normal: vec3<f32>,
};

struct Disk {
  origin: vec3<f32>,
  normal: vec3<f32>,
  radius: f32,
};

struct AABB {
  from: vec3<f32>,
  to: vec3<f32>,
};

struct RoundedCone {
      // 
    from: vec3<f32>,
    // 
    to: vec3<f32>,
    //
    radius: f32,
    //
    leftPlane: vec4<f32>,
    //
    rightPlane: vec4<f32>,
};

struct Capsule {
      // 
    from: vec3<f32>,
    // 
    to: vec3<f32>,
    //
    radius: f32,
};

fn rayCylinderInteresection(ray: Ray, cylinder: Cylinder) -> vec4<f32>
{
    let radius: f32 = cylinder.radius;

    let ba: vec3<f32> = cylinder.to - cylinder.from;
    let oc: vec3<f32> = ray.origin - cylinder.from;

    let baba: f32 = dot(ba,ba);
    let bard: f32 = dot(ba, ray.direction);
    let baoc: f32 = dot(ba,oc);
    
    let k2: f32 = baba            - bard*bard;
    let k1: f32 = baba*dot(oc, ray.direction) - baoc*bard;
    let k0: f32 = baba*dot(oc,oc) - baoc*baoc - radius*radius*baba;
    
    var h: f32 = k1*k1 - k2*k0;
    if( h < 0.0 ) {
      return vec4<f32>(-1.0, -1.0, -1.0, -1.0);
    }
    h = sqrt(h);
    var t: f32 = (-k1-h)/k2;

    // body
    let y: f32 = baoc + t*bard;
    if( y > 0.0 && y < baba ) {
      return vec4<f32>( t, (oc+t*ray.direction - ba*y * (1.0 / baba)) * (1.0 / radius) );
    }
    
    // caps
    if (y < 0.0) {
      t = -baoc / bard;
    } else {
      t = (baba - baoc) / bard;
    }
    
    if( abs(k1+k2*t)<h )
    {
        return vec4<f32>( t, ba*sign(y) * (1.0 / baba) );
    }

    return vec4<f32>(-1.0, -1.0, -1.0, -1.0);
}

fn raySphereIntersections(ray: Ray, sphere: Sphere) -> vec2<f32> {
    let oc = ray.origin - sphere.position;
    let b = dot( oc, ray.direction );
    let c = dot( oc, oc ) - sphere.radius * sphere.radius;
    var h = b*b - c;

    // no intersection
    if(h < 0.0) {
      return vec2<f32>(-1.0); 
    }
    h = sqrt( h );

    return vec2<f32>( -b-h, -b+h );
}

fn raySphereIntersection(ray: Ray, sphere: Sphere) -> f32 {
    let a: f32 = dot(ray.direction, ray.direction);
    let s0_r0: vec3<f32> = ray.origin - sphere.position;
    let b: f32 = 2.0 * dot(ray.direction, s0_r0);
    let c: f32 = dot(s0_r0, s0_r0) - (sphere.radius * sphere.radius);
    if (b*b - 4.0*a*c < 0.0) {
        return -1.0;
    }

    return (-b - sqrt((b*b) - 4.0*a*c))/(2.0*a);
}

fn rayPlaneIntersection(ray: Ray, plane: Plane) -> f32
{ 
    // assuming vectors are all normalized
    var t: f32 = -1.0;
    var denom: f32 = dot(plane.normal, ray.direction); 
    if (denom > 0.0001) { 
        let planeRay: vec3<f32> = plane.origin - ray.origin; 
        t = dot(planeRay, plane.normal) / denom; 

        return t;
    } 
 
    return -1.0; 
} 

fn rayDiskIntersection(ray: Ray, disk: Disk) -> bool
{ 
    var t: f32 = rayPlaneIntersection(ray, Plane(disk.origin, disk.normal)); 
    if (t >= 0.0) { 
        let p: vec3<f32> = ray.origin + ray.direction * t; 
        let v: vec3<f32> = p - disk.origin; 
        let d2: f32 = dot(v, v); 

        if (sqrt(d2) <= disk.radius) {
          return true;
        } 
        // or you can use the following optimisation (and precompute radius^2)
        // return d2 <= radius2; // where radius2 = radius * radius
     } 
 
     return false;
} 

fn rayDiskIntersectionBothSides(ray: Ray, disk: Disk) -> bool
{ 
  var planeDenom: f32 = dot(disk.normal, ray.direction);
    if (abs(planeDenom) < 0.001) { 
        return false;
    } 

    let planeRay: vec3<f32> = disk.origin - ray.origin; 
    var t = dot(planeRay, disk.normal) / planeDenom; 
 
    let p: vec3<f32> = ray.origin + ray.direction * t; 
    let v: vec3<f32> = p - disk.origin; 
    let d2: f32 = dot(v, v); 

    if (sqrt(d2) <= disk.radius) {
      return true;
    } 
 
    return false;
} 

fn rayAABBIntersection(ray: Ray, aabb: AABB) -> f32 {
  let invRayDirection = vec3<f32>(1.0 / ray.direction.x, 1.0 / ray.direction.y, 1.0 / ray.direction.z);

  let t0 = (aabb.from - ray.origin) * invRayDirection;
  let t1 = (aabb.to   - ray.origin) * invRayDirection;

  let tmin = min(t0, t1);
  let tmax = max(t0, t1);

  let axisMax = max(max(tmin.x, tmin.y), tmin.z);
  let axisMin = min(min(tmax.x, tmax.y), tmax.z);

  if (axisMax > axisMin) {
    return -1.0;
  }

  return axisMax;
}

fn rayRoundedConeIntersection(ray: Ray, roundedCone: RoundedCone) -> vec4<f32> {
  let invRayDirection = vec3<f32>(1.0 / ray.direction.x, 1.0 / ray.direction.y, 1.0 / ray.direction.z);

  let ba = roundedCone.to - roundedCone.from;
  let oa = ray.origin - roundedCone.from;
  let ob = ray.origin - roundedCone.to;
  let rr = roundedCone.radius - roundedCone.radius;
  let m0 = dot(ba,ba);
  let m1 = dot(ba,oa);
  let m2 = dot(ba,ray.direction);
  let m3 = dot(ray.direction,oa);
  let m5 = dot(oa,oa);
  let m6 = dot(ob,ray.direction);
  let m7 = dot(ob,ob);

  let d2 = m0 - rr*rr;

	let k2 = d2    - m2*m2;
  let k1 = d2*m3 - m1*m2 + m2*rr*roundedCone.radius;
  let k0 = d2*m5 - m1*m1 + m1*rr*roundedCone.radius*2.0 - m0*roundedCone.radius*roundedCone.radius;
    
	let h = k1*k1 - k0*k2;

	// if(h < 0.0) {
  //   return vec4<f32>(-1.0);
  // }

  var t = (-sqrt(h)-k1)/k2;

  let y = m1 - roundedCone.radius*rr + t*m2;
  if( y>0.0 && y<d2 ) 
  {
      return vec4<f32>(t, normalize( d2*(oa + t*ray.direction)-ba*y) );
  }

  let h1 = m3*m3 - m5 + roundedCone.radius*roundedCone.radius;
  let h2 = m6*m6 - m7 + roundedCone.radius*roundedCone.radius;
  if(max(h1,h2) < 0.0) {
    return vec4<f32>(-1.0);
    }

  var r = vec4<f32>(100000000.0);
    if( h1>0.0 )
    {        
    	t = -m3 - sqrt( h1 );
        r = vec4<f32>( t, (oa+t*ray.direction)/roundedCone.radius );
    }
	if( h2>0.0 )
    {
    	t = -m6 - sqrt( h2 );
        if( t<r.x ) {
        r = vec4<f32>( t, (ob+t*ray.direction)/roundedCone.radius );
        }
    }
    
    return r;
}

fn rayRoundedConeIntersectionWireframe(ray: Ray, roundedCone: RoundedCone) -> vec2<f32> {
  let invRayDirection = vec3<f32>(1.0 / ray.direction.x, 1.0 / ray.direction.y, 1.0 / ray.direction.z);

  let ba = roundedCone.to - roundedCone.from;
  let oa = ray.origin - roundedCone.from;
  let ob = ray.origin - roundedCone.to;
  let rr = roundedCone.radius - roundedCone.radius;
  let m0 = dot(ba,ba);
  let m1 = dot(ba,oa);
  let m2 = dot(ba,ray.direction);
  let m3 = dot(ray.direction,oa);
  let m5 = dot(oa,oa);
  let m6 = dot(ob,ray.direction);
  let m7 = dot(ob,ob);

  var planeA = vec4<f32>(normalize(ba), 0.0);
  planeA.w = -dot(roundedCone.from, planeA.xyz);
  var planeB = vec4<f32>(-normalize(ba), 0.0);
  planeB.w = -dot(roundedCone.to, planeB.xyz);

  let d2 = m0 - rr*rr;

	let k2 = d2    - m2*m2;
  let k1 = d2*m3 - m1*m2 + m2*rr*roundedCone.radius;
  let k0 = d2*m5 - m1*m1 + m1*rr*roundedCone.radius*2.0 - m0*roundedCone.radius*roundedCone.radius;
    
	let h = k1*k1 - k0*k2;

  //if (h < 0.0) {
  //  return vec4<f32>(-1.0);
  //}

  let t1 = (-sqrt(h)-k1)/k2;
  let t2 = ( sqrt(h)-k1)/k2;
  
  let y1 = m1 - roundedCone.radius*rr + t1*m2;
  let y2 = m1 - roundedCone.radius*rr + t2*m2;
  
  var solutions: vec4<f32> = vec4<f32>(-1.0);
  
  if( y1 > 0.0 && y1 < d2 ) 
  {
      solutions.x = t1;
  }
  
  if( y2 > 0.0 && y2 < d2 ) 
  {
      solutions.y = t2;
  }    
  
  // Case 1: Hit only cylinder, no caps
  if (solutions.x > 0.0 && solutions.y > 0.0) {
      return solutions.xy;
  }    
  // Case 2: Hit two caps, no cylinder
  else if (solutions.x < 0.0 && solutions.y < 0.0) {       
      solutions = vec4<f32>(-1.0);
      
      let h1 = m3*m3 - m5 + roundedCone.radius*roundedCone.radius;
      let h2 = m6*m6 - m7 + roundedCone.radius*roundedCone.radius;
      
      if (h1 > 0.0) {
        solutions.x = -m3 - sqrt( h1 );    
        solutions.y = -m3 + sqrt( h1 ); 
        
        if (dot(planeA, vec4<f32>(ray.origin + solutions.x * ray.direction, 1.0)) > 0.0) { solutions.x = -1.0; }
        if (dot(planeA, vec4<f32>(ray.origin + solutions.y * ray.direction, 1.0)) > 0.0) { solutions.y = -1.0; }

        if (solutions.x > 0.0 && solutions.y > 0.0) { return solutions.xy; }
      }
      
      if (h2 > 0.0) {
        solutions.z = -m6 - sqrt( h2 );
        solutions.w = -m6 + sqrt( h2 );
        
        if (dot(planeB, vec4<f32>(ray.origin + solutions.z * ray.direction, 1.0)) > 0.0) { solutions.z = -1.0; }
        if (dot(planeB, vec4<f32>(ray.origin + solutions.w * ray.direction, 1.0)) > 0.0) { solutions.w = -1.0; }

        if (solutions.z > 0.0 && solutions.w > 0.0) { return solutions.zw; }
      }

      return vec2<f32>(max(solutions.x, solutions.y), max(solutions.z, solutions.w));
  } 
  // Case 3: Hit cylinder && sphere
  else {
      let cylinderT = max(solutions.x, solutions.y);
      solutions = vec4<f32>(-1.0);
      var sphereT = -1.0;

      let h1 = m3*m3 - m5 + roundedCone.radius*roundedCone.radius;
      let h2 = m6*m6 - m7 + roundedCone.radius*roundedCone.radius;
      
      if (h1 > 0.0) {
        solutions.y = -m3 - sqrt( h1 ); 
        solutions.z = -m3 + sqrt( h1 ); 
        
        if (dot(planeA, vec4<f32>(ray.origin + solutions.y * ray.direction, 1.0)) > 0.0) { solutions.y = -1.0; }
        if (dot(planeA, vec4<f32>(ray.origin + solutions.z * ray.direction, 1.0)) > 0.0) { solutions.z = -1.0; }

        if (solutions.x > 0.0 && solutions.y > 0.0) { sphereT = min(solutions.x, solutions.y); }        
        if (solutions.x < 0.0 || solutions.y < 0.0) { sphereT = max(solutions.x, solutions.y); }
      }
      
      if (h2 > 0.0) {
        solutions.y = -m6 - sqrt( h2 );
        solutions.z = -m6 + sqrt( h2 );
        
        if (dot(planeB, vec4<f32>(ray.origin + solutions.y * ray.direction, 1.0)) > 0.0) { solutions.y = -1.0; }
        if (dot(planeB, vec4<f32>(ray.origin + solutions.z * ray.direction, 1.0)) > 0.0) { solutions.z = -1.0; }

        if (solutions.z > 0.0 && solutions.z > 0.0) { sphereT = min(solutions.z, solutions.w); }        
        if (solutions.y < 0.0 || solutions.w < 0.0) { sphereT = max(solutions.z, solutions.w); }
      }

      return vec2<f32>(cylinderT, sphereT);
  }
}

fn roundedConeDistance(p: vec3<f32>, roundedCone: RoundedCone) -> f32 {
    let b = roundedCone.to;
    let a = roundedCone.from;
    let r1 = roundedCone.radius;
    let r2 = roundedCone.radius;

    // sampling independent computations (only depend on shape)
    let ba = b - a;
    let l2 = dot(ba,ba);
    let rr = r1 - r2;
    let a2 = l2 - rr*rr;
    let il2 = 1.0/l2;
    
    // sampling dependant computations
    let pa = p - a;
    let y = dot(pa,ba);
    let z = y - l2;
    let x2 = dot( pa*l2 - ba*y, pa*l2 - ba*y );
    let y2 = y*y*l2;
    let z2 = z*z*l2;

    // single square root!
    let k = sign(rr)*rr*rr*x2;
    if( sign(z)*a2*z2 > k ) { return sqrt(x2 + z2)        *il2 - r2; }
    if( sign(y)*a2*y2 < k ) { return sqrt(x2 + y2)        *il2 - r1; }

    return (sqrt(x2*a2*il2) + y*rr)*il2 - r1; 
}

fn capsuleDistance(p: vec3<f32>, capsule: Capsule) -> f32
{
  let pa = p - capsule.from.xyz;
  let ba = capsule.to.xyz - capsule.from.xyz;

  let h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );

  return length( pa - ba*h ) - capsule.radius;
}

fn rayCapsuleIntersection(ray: Ray, capsule: Capsule) -> f32 {
  let ro = ray.origin;
  let rd = ray.direction;
  let r = capsule.radius;
  let pa = capsule.from;
  let pb = capsule.to;

  let  ba = pb - pa;
  let  oa = ro - pa;

  let baba = dot(ba,ba);
  let bard = dot(ba,rd);
  let baoa = dot(ba,oa);
  let rdoa = dot(rd,oa);
  let oaoa = dot(oa,oa);

  var a = baba      - bard*bard;
  var b = baba*rdoa - baoa*bard;
  var c = baba*oaoa - baoa*baoa - r*r*baba;
  var h = b*b - a*c;
  if( h>=0.0 )
  {
      let t = (-b-sqrt(h))/a;
      let y = baoa + t*bard;
      // body
      if( y>0.0 && y<baba ) { 
        return t;
      }
      // caps
      var oc = oa;
      if (y > 0.0) {
        oc = ro - pb;
      }
      b = dot(rd,oc);
      c = dot(oc,oc) - r*r;
      h = b*b - c;
      if( h>0.0 ) {
        return -b - sqrt(h);
      }
  }
  return -1.0;
}