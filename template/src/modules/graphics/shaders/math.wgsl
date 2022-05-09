// Find quadratic roots
fn quadraticRoots(a: f32, b: f32, c: f32) -> vec2<f32> {
  return vec2<f32>(
    ( -b - sqrt( b * b - 4.0 * a * c ) ) / ( 2.0 * a ),
    ( -b + sqrt( b * b - 4.0 * a * c ) ) / ( 2.0 * a )
  );
}

// Find cubic roots using Cardano's method. 
// http://en.wikipedia.org/wiki/Cubic_function#Cardano.27s_method
fn cubicRoots(a: f32, b: f32, c: f32) -> vec2<f32>
{
	let p: f32 = b-a*a/3.0;
    let p3: f32 = p*p*p;
	let q: f32 = a*(2.0*a*a - 9.0*b) / 27.0 + c;
	let d: f32 = q*q+4.0*p3/27.0;
	let offset: f32 = -a / 3.0;
	if(d > 0.0)
	{ 
		let z: f32 = sqrt(d);
		let x: vec2<f32> = vec2<f32>(z - q, -z - q) * 0.5;
		let uv: vec2<f32> = sign(x) * pow(abs(x), vec2<f32>(1.0 / 3.0, 1.0 / 3.0));
		return vec2<f32>(offset + uv.x + uv.y, offset + uv.x + uv.y);
	}
	let v: f32 = acos(-sqrt(-27./p3)*q/2.)/3.;
	let m: f32 = cos(v);
    let n: f32 = sin(v)*1.732050808;

	return vec2<f32>(m + m, -n - m) * sqrt(-p / 3.0) + vec2<f32>(offset, offset);
}

fn clampPolyfill(value: f32, low: f32, high: f32) -> f32 {
	var output: f32 = value;

	if (value < low) {
		output = low;
	}

	if (value > high) {
		output = high;
	}

	return output;
}

fn clamp2Polyfill(value: vec2<f32>, low: f32, high: f32) -> vec2<f32> {
	var output: vec2<f32> = value;
	output.x = clampPolyfill(output.x, low, high);
	output.y = clampPolyfill(output.y, low, high);

	return output;
}