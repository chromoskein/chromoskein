import { vec3, vec4 } from "gl-matrix";

export class Hit {
    ray: Ray;
    distance: number;

    lowLevelIndex: number;
    highLevelIndex: number;

    constructor(ray: Ray, distance: number, lowlLevelIndex: number, highLevelIndex: number) {
        this.ray = ray;
        this.distance = distance;
        this.lowLevelIndex = lowlLevelIndex;
        this.highLevelIndex = highLevelIndex;
    }
}

export class Ray {
    origin: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    direction: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    minT = 0.0;
    maxT = Number.MAX_VALUE;

    constructor(origin: vec3, direction: vec3) {
        this.origin = origin;
        this.direction = direction;
    }
}

export type BoundingBox = {
    min: vec3;
    max: vec3;
    center: vec3;
    primitive: number;
}

//#region Constructors
export function BoundingBoxNew(min: vec3, max: vec3, primitive = 0): BoundingBox {
    return {
        min,
        max,
        center: vec3.scale(vec3.create(), vec3.add(vec3.create(), max, min), 0.5),
        primitive,
    }
}

export function BoundingBoxEmpty(): BoundingBox {
    return {
        min: vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE),
        max: vec3.fromValues(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE),
        center: vec3.create(),
        primitive: 0,
    }
}

export function BoundingBoxFull(): BoundingBox {
    return {
        min: vec3.fromValues(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE),
        max: vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE),
        center: vec3.create(),
        primitive: 0,
    }
}

export function BoundingBoxClone(boundingBox: BoundingBox): BoundingBox {
    return {
        min: vec3.clone(boundingBox.min),
        max: vec3.clone(boundingBox.max),
        center: vec3.clone(boundingBox.center),
        primitive: boundingBox.primitive,
    }
    
}
//#endregion

export function BoundingBoxCalculateCenter(boundingBox: BoundingBox): void {
    boundingBox.center = vec3.scale(vec3.create(), vec3.add(vec3.create(), boundingBox.max, boundingBox.min), 0.5);
}

export function BoundingBoxExtendByBox(boundingBox: BoundingBox, extendBy: BoundingBox): BoundingBox {
    boundingBox.min = vec3.min(boundingBox.min, boundingBox.min, extendBy.min);
    boundingBox.max = vec3.max(boundingBox.max, boundingBox.max, extendBy.max);

    BoundingBoxCalculateCenter(boundingBox);

    return boundingBox;
}

export function BoundingBoxExtendByPoint(boundingBox: BoundingBox, extendBy: vec3): BoundingBox {
    boundingBox.min = vec3.min(boundingBox.min, boundingBox.min, extendBy);
    boundingBox.max = vec3.max(boundingBox.max, boundingBox.max, extendBy);

    BoundingBoxCalculateCenter(boundingBox);

    return boundingBox;
}

export function BoundingBoxDiagonal(boundingBox: BoundingBox): vec3 {
    return vec3.subtract(vec3.create(), boundingBox.max, boundingBox.min);
}

export function BoundingBoxHalfArea(boundingBox: BoundingBox): number {
    const d = BoundingBoxDiagonal(boundingBox);

    return (d[0] + d[1]) * d[2] + d[0] * d[1];
}

export function BoundingBoxLargestAxis(boundingBox: BoundingBox): number {
    const d = BoundingBoxDiagonal(boundingBox);

    let axis = 0;

    if (d[0] < d[1]) axis = 1;
    if (d[axis] < d[2]) axis = 2;

    return axis;
}

export function BoundingBoxIntersects(boundingBox: BoundingBox, ray: Ray): boolean {
    let tmin, tmax, tymin, tymax, tzmin, tzmax;

    const invdirx = ray.direction[0];
    const invdiry = ray.direction[1];
    const invdirz = ray.direction[2];

    const origin = ray.origin;

    if ( invdirx >= 0 ) {

        tmin = ( boundingBox.min[0] - origin[0] ) * invdirx;
        tmax = ( boundingBox.max[0] - origin[0] ) * invdirx;

    } else {

        tmin = ( boundingBox.max[0] - origin[0] ) * invdirx;
        tmax = ( boundingBox.min[0] - origin[0] ) * invdirx;

    }

    if ( invdiry >= 0 ) {

        tymin = ( boundingBox.min[1] - origin[1] ) * invdiry;
        tymax = ( boundingBox.max[1] - origin[1] ) * invdiry;

    } else {

        tymin = ( boundingBox.max[1] - origin[1] ) * invdiry;
        tymax = ( boundingBox.min[1] - origin[1] ) * invdiry;

    }

    if ( ( tmin > tymax ) || ( tymin > tmax ) ) return false;

    // These lines also handle the case where tmin or tmax is NaN
    // (result of 0 * Infinity). x !== x returns true if x is NaN

    if ( tymin > tmin || tmin !== tmin ) tmin = tymin;

    if ( tymax < tmax || tmax !== tmax ) tmax = tymax;

    if ( invdirz >= 0 ) {

        tzmin = ( boundingBox.min[2] - origin[2] ) * invdirz;
        tzmax = ( boundingBox.max[2] - origin[2] ) * invdirz;

    } else {

        tzmin = ( boundingBox.max[2] - origin[2] ) * invdirz;
        tzmax = ( boundingBox.min[2] - origin[2] ) * invdirz;

    }

    if ( ( tmin > tzmax ) || ( tzmin > tmax ) ) return false;

    if ( tzmin > tmin || tmin !== tmin ) tmin = tzmin;

    if ( tzmax < tmax || tmax !== tmax ) tmax = tzmax;

    //return point closest to the ray (positive side)

    if ( tmax < 0 ) return false;

    return true;
}
