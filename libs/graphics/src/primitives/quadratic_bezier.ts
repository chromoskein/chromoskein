import { vec3 } from "gl-matrix";
import { GraphicsLibrary } from "..";
import { ArrayViews, LinearImmutableArray } from "../allocators";
import { BoundingBox, BoundingBoxCalculateCenter, BoundingBoxEmpty } from "../shared";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE_BYTES, LL_STRUCTURE_SIZE } from "./shared";

export function quadraticBezierToBoundingBox(array: ArrayViews, offset: number): BoundingBox {
    const result = BoundingBoxEmpty();

    const p0 = vec3.fromValues(
        array.f32View[offset * LL_STRUCTURE_SIZE + 0],
        array.f32View[offset * LL_STRUCTURE_SIZE + 1],
        array.f32View[offset * LL_STRUCTURE_SIZE + 2]
    );
    const p1 = vec3.fromValues(
        array.f32View[offset * LL_STRUCTURE_SIZE + 4],
        array.f32View[offset * LL_STRUCTURE_SIZE + 5],
        array.f32View[offset * LL_STRUCTURE_SIZE + 6]
    );
    const p2 = vec3.fromValues(
        array.f32View[offset * LL_STRUCTURE_SIZE + 8],
        array.f32View[offset * LL_STRUCTURE_SIZE + 9],
        array.f32View[offset * LL_STRUCTURE_SIZE + 10]
    );
    
    const radius = array.f32View[offset * LL_STRUCTURE_SIZE + 3];
    
    let mi = vec3.min(vec3.create(), p0, p2);
    let ma = vec3.max(vec3.create(), p0, p2);

    if (p1[0] < mi[0] 
     || p1[0] > ma[0] 
     || p1[1] < mi[1] 
     || p1[1] > ma[1]
     || p1[2] < mi[2] 
     || p1[2] > ma[2]
    ) {
        const t = vec3.create();
        const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);
        t[0] = clamp((p0[0] - p1[0]) / (p0[0] - 2.0*p1[0] + p2[0]), 0.0, 1.0);
        t[1] = clamp((p0[1] - p1[1]) / (p0[1] - 2.0*p1[1] + p2[1]), 0.0, 1.0);
        t[1] = clamp((p0[2] - p1[2]) / (p0[2] - 2.0*p1[2] + p2[2]), 0.0, 1.0);
        const s = t.map(v => 1.0 - v);
        const q = vec3.create();
        q[0] = s[0]*s[0]*p0[0] + 2.0*s[0]*t[0]*p1[0] + t[0]*t[0]*p2[0];
        q[1] = s[1]*s[1]*p0[1] + 2.0*s[1]*t[1]*p1[1] + t[1]*t[1]*p2[1];
        q[2] = s[2]*s[2]*p0[2] + 2.0*s[2]*t[2]*p1[2] + t[2]*t[2]*p2[2];

        mi = vec3.min(vec3.create(), mi, q);
        ma = vec3.max(vec3.create(), ma, q);
    }

    result.min = vec3.add(vec3.create(), mi, vec3.fromValues(-radius, -radius, -radius));
    result.max = vec3.add(vec3.create(), ma, vec3.fromValues(radius, radius, radius));
    

    BoundingBoxCalculateCenter(result);

    return result;
}

export class QuadraticBezier {
    p0: vec3;
    p1: vec3;
    p2: vec3;

    constructor(p0: vec3, p1: vec3, p2: vec3) {
        this.p0 = vec3.clone(p0);
        this.p1 = vec3.clone(p1);
        this.p2 = vec3.clone(p2);
    }
    /**
     * splitLeft
     */
    public splitLeft(t = 0.5): QuadraticBezier {
        const p0 = vec3.create();
        const p1 = vec3.create();
        const p2 = vec3.create();

        for (let i = 0; i < 3; i++) {
            p0[i] = this.p0[i];
            p1[i] = t * this.p1[i] - (t - 1.0) * this.p0[i];
            p2[i] = t * t * this.p2[i] - 2.0 * t * (t - 1.0) * this.p1[i] + (t - 1.0) * (t - 1.0) * this.p0[i];
        }

        return new QuadraticBezier(p0, p1, p2);
    }

    /**
     * splitRight
     */
    public splitRight(t = 0.5): QuadraticBezier {
        const p0 = vec3.create();
        const p1 = vec3.create();
        const p2 = vec3.create();

        for (let i = 0; i < 3; i++) {
            p0[i] = t * t * this.p2[i] - 2.0 * t * (t - 1.0) * this.p1[i] + (t - 1.0) * (t - 1.0) * this.p0[i];
            p1[i] = t * this.p2[i] - (t - 1.0) * this.p1[i];
            p2[i] = this.p2[i];
        }

        return new QuadraticBezier(p0, p1, p2);
    }

    /**
     * split
     */
    public split(t = 0.5): Array<QuadraticBezier> {
        return [
            this.splitLeft(t), this.splitRight(t)
        ];
    }


    public evaluate(t: number): vec3 {
        const p0 = this.p0;
        const p1 = this.p1;
        const p2 = this.p2;
        const tinv = 1.0 - t;

        const result = vec3.create();
        result[0] = tinv * tinv * p0[0] + 2.0 * tinv * t * p1[0] + t * t * p2[0];
        result[1] = tinv * tinv * p0[1] + 2.0 * tinv * t * p1[1] + t * t * p2[1];
        result[2] = tinv * tinv * p0[2] + 2.0 * tinv * t * p1[2] + t * t * p2[2];
        
        return result;
    }
    
    public evaluateDifferential(t: number): vec3 {
        const p0 = this.p0;
        const p1 = this.p1;
        const p2 = this.p2;
        const tinv = 1.0 - t;

        const result = vec3.create();
        result[0] = 2.0 * tinv * (p1[0] - p0[0]) + 2.0 * t * (p2[0] - p1[0]);
        result[1] = 2.0 * tinv * (p1[1] - p0[1]) + 2.0 * t * (p2[1] - p1[1]);
        result[2] = 2.0 * tinv * (p1[2] - p0[2]) + 2.0 * t * (p2[2] - p1[2]);
    
        return result;
    }
}

export class QuadraticBezierCurve implements HighLevelStructure {
    private graphicsLibrary: GraphicsLibrary;
    private buffer: LinearImmutableArray | null = null;
    private id = -1;

    private _curvesPosition = 0;

    //#region Description
    private _p0: vec3;
    private _p1: vec3;
    private _p2: vec3;
    private _radius: number;

    private subcurves: Array<QuadraticBezier>;
    //#endregion

    //#region Style
    private _color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    //#endregion

    private _partOfBVH: boolean;
    private _dirtyBVH: boolean;
    private _opaque = true;

    public set opaque(opaque: boolean) {
        this._opaque = opaque;
    }

    public get opaque(): boolean {
        return this._opaque;
    }

    constructor(graphicsLibrary: GraphicsLibrary, id: number, partOfBVH = true, p0: vec3, p1: vec3, p2: vec3, radius = 0.05) {
        this.graphicsLibrary = graphicsLibrary;

        this.id = id;
        this._partOfBVH = partOfBVH;
        this._dirtyBVH = true;

        this._p0 = vec3.clone(p0);
        this._p1 = vec3.clone(p1);
        this._p2 = vec3.clone(p2);
        this._radius = radius;

        this.subcurves = new Array(new QuadraticBezier(this._p0, this._p1, this._p2));
        this.subcurves = [this.subcurves[0].splitLeft().split(), this.subcurves[0].splitRight().split()].flat();

        const newArray = [];
        for (const subcurve of this.subcurves) {
            const split = subcurve.split();
            newArray.push(split[0]);
            newArray.push(split[1]);
        }
        this.subcurves = newArray;
    }

    public getID(): number {
        return this.id;
    }

    //#region Quadratic Bezier functions
    /**
     * evaluate
     */
    public evaluate(t: number): vec3 {
        const result: vec3 = vec3.create();
        const tinv: number = 1.0 - t;

        result[0] = tinv * tinv * this._p0[0] + 2.0 * tinv * t * this._p1[0] + t * t * this._p2[0];
        result[1] = tinv * tinv * this._p0[1] + 2.0 * tinv * t * this._p1[1] + t * t * this._p2[1];
        result[2] = tinv * tinv * this._p0[0] + 2.0 * tinv * t * this._p1[0] + t * t * this._p2[0];

        return result;
    }

    /**
     * evaluateDifferential
     */
    public evaluateDifferential(t: number): vec3 {
        const result: vec3 = vec3.create();
        const tinv: number = 1.0 - t;

        result[0] = 2.0 * tinv * (this._p1[0] - this._p0[0]) + 2.0 * t * (this._p2[0] - this._p1[0]);
        result[1] = 2.0 * tinv * (this._p1[1] - this._p0[1]) + 2.0 * t * (this._p2[1] - this._p1[1]);
        result[2] = 2.0 * tinv * (this._p1[2] - this._p0[2]) + 2.0 * t * (this._p2[2] - this._p1[2]);

        return result;
    }

    /**
     * splitLeft
     */
    public splitLeft(t = 0.5): QuadraticBezierCurve {
        const p0 = vec3.create();
        const p1 = vec3.create();
        const p2 = vec3.create();

        for (let i = 0; i < 3; i++) {
            p0[i] = this._p0[i];
            p1[i] = t * this._p1[i] - (t - 1.0) * this._p0[i];
            p2[i] = t * t * this._p2[i] - 2.0 * t * (t - 1.0) * this._p1[i] + (t - 1.0) * (t - 1.0) * this._p0[i];
        }

        return new QuadraticBezierCurve(this.graphicsLibrary, this.id, this.partOfBVH(), p0, p1, p2, this._radius);
    }

    /**
     * splitRight
     */
    public splitRight(t = 0.5): QuadraticBezierCurve {
        const p0 = vec3.create();
        const p1 = vec3.create();
        const p2 = vec3.create();

        for (let i = 0; i < 3; i++) {
            p0[i] = t * t * this._p2[i] - 2.0 * t * (t - 1.0) * this._p1[i] + (t - 1.0) * (t - 1.0) * this._p0[i];
            p1[i] = t * this._p2[i] - (t - 1.0) * this._p1[i];
            p2[i] = this._p2[i];
        }

        return new QuadraticBezierCurve(this.graphicsLibrary, this.id, this.partOfBVH(), p0, p1, p2, this._radius);
    }

    /**
     * split
     */
    public split(t = 0.5): Array<QuadraticBezierCurve> {
        return [
            this.splitLeft(t), this.splitRight(t)
        ];
    }
    //#endregion

    //#region HighLevelStructure Interface
    public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number {
        if (type != null && type != LowLevelStructure.QuadraticBezierCurve) {
            return 0;
        }

        this.buffer = buffer;
        this._curvesPosition = offset;

        for (let i = 0; i < this.subcurves.length; i++) {
            const subcurve = this.subcurves[i];
            const subcurveOffset = (offset + i) * LL_STRUCTURE_SIZE;

            buffer.f32View.set([subcurve.p0[0], subcurve.p0[1], subcurve.p0[2], this._radius], subcurveOffset + 0);
            buffer.f32View.set([subcurve.p1[0], subcurve.p1[1], subcurve.p1[2], this._radius], subcurveOffset + 4);
            buffer.f32View.set([subcurve.p2[0], subcurve.p2[1], subcurve.p2[2], this._radius], subcurveOffset + 8);
            buffer.f32View.set([this._color[0], this._color[1], this._color[2], 1.0], subcurveOffset + 12);
            buffer.i32View.set([this.id], subcurveOffset + 30);
            buffer.i32View.set([LowLevelStructure.QuadraticBezierCurve], subcurveOffset + 31);
        }

        this.buffer.setModifiedBytes({ start: this._curvesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._curvesPosition + this.subcurves.length) * LL_STRUCTURE_SIZE_BYTES });

        return this.subcurves.length;
    }

    public removeFromArrayBuffer(): void {
        if (!this.buffer) {
            return;
        }

        for (let i = 0; i < this.subcurves.length; i++) {
            this.buffer.i32View.set([LowLevelStructure.None], (this._curvesPosition + i) * LL_STRUCTURE_SIZE + 31);
        }

        this.buffer.setModifiedBytes({ start: this._curvesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._curvesPosition + this.subcurves.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public countOf(type: LowLevelStructure | null): number {
        if (type == null || type == LowLevelStructure.QuadraticBezierCurve) {
            return this.subcurves.length;
        }

        return 0;
    }

    public offsetOf(type: LowLevelStructure | null): number | null {
        if (type == LowLevelStructure.QuadraticBezierCurve) {
            return this._curvesPosition;
        }

        return null;
    }

    public localOffsetOf(type: LowLevelStructure, offset: number): number {
        switch (type) {
            case LowLevelStructure.QuadraticBezierCurve: return offset - this._curvesPosition;
        }

        return -1;
    }

    //#region BVH
    partOfBVH(): boolean {
        return this._partOfBVH;
    }

    dirtyBVH(): boolean {
        return this._dirtyBVH;
    }

    setCleanBVH(): void {
        this._dirtyBVH = false;
    }

    setDirtyBVH(): void {
        this._dirtyBVH = true;
    }
    //#endregion
    //#endregion

    public set radius(radius: number) {
        this._radius = radius;

        if (!this.buffer) return;

        for (let i = 0; i < this.subcurves.length; i++) {
            const subcurveOffset = (this._curvesPosition + i) * LL_STRUCTURE_SIZE;

            this.buffer.f32View.set([this._radius], subcurveOffset + 3);
            this.buffer.f32View.set([this._radius], subcurveOffset + 7);
            this.buffer.f32View.set([this._radius], subcurveOffset + 11);
        }

        this.buffer.setModifiedBytes({
            start: this._curvesPosition * LL_STRUCTURE_SIZE_BYTES,
            end: (this._curvesPosition + this.subcurves.length) * LL_STRUCTURE_SIZE_BYTES
        }
        );
    }

    public set color(color: vec3) {
        this._color = color;
    }
}