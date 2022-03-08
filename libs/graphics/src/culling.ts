import { vec3, vec4 } from "gl-matrix";

export interface CullObject {
    cullsPoint(point: vec3): boolean;
}

export enum CullSpace {
    // Retain what is inside the object
    // Cull what is outside the object
    Inside,
    // Retain what is outside the object
    // Cull what is inside the object
    Outside
}

export class CullSphere implements CullObject {
    private _cullType: CullSpace = CullSpace.Inside;
    private _center: vec3;
    private _radius: number;

    constructor(center: vec3, radius: number, cullType: CullSpace = CullSpace.Inside) {
        this._center = center;
        this._radius = radius;
        this._cullType = cullType;
    }

    public cullsPoint(point: vec3): boolean {
        switch (this._cullType) {
            case CullSpace.Inside: return vec3.distance(this._center, point) > this._radius;
            case CullSpace.Outside: return vec3.distance(this._center, point) < this._radius;
        }
    }

    public set center(center: vec3) {
        this._center = center;
    }

    public get center(): vec3 {
        return this._center;
    }

    public get radius(): number {
        return this._radius;
    }

    public get cullType(): CullSpace {
        return this._cullType;
    }
}

export class CullRoundedCone implements CullObject {
    public cullType: CullSpace = CullSpace.Inside;

    public from: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    public to: vec3 = vec3.fromValues(0.0, 0.0, 0.0);

    public radius = 1.0;

    public cullsPoint(point: vec3): boolean {
        // TODO
        return false;
    }
}

export class CullPlane implements CullObject {
    public point: vec3;
    public normal: vec3;
    public explicit: vec4;

    constructor(normal: vec3 = vec3.fromValues(0.0, 1.0, 0.0), point: vec3 = vec3.fromValues(0.0, 0.0, 0.0)) {
        this.point = point;
        this.normal = normal;
        this.explicit = vec4.fromValues(normal[0], normal[1], normal[2], 0.0);
        this.explicit[3] = -vec3.dot(point, normal);
    }

    public cullsPoint(point: vec3): boolean {
        return vec4.dot(this.explicit, vec4.fromValues(point[0], point[1], point[2], 1.0)) < 0.0;
    }
}