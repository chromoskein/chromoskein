import { vec3 } from "gl-matrix";
import { GraphicsLibrary } from "..";
import { LinearImmutableArray } from "../allocators";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE_BYTES, LL_STRUCTURE_SIZE } from "./shared";

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