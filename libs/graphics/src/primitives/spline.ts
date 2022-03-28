import { vec3, vec4 } from "gl-matrix";
import { GraphicsLibrary } from "..";
import { LinearImmutableArray } from "../allocators";
import { QuadraticBezier, QuadraticBezierCurve } from "./quadratic_bezier";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE, LL_STRUCTURE_SIZE_BYTES } from "./shared";

/**
 * 
 * 
 */
export class Spline implements HighLevelStructure {
    private splinesColors: Array<vec4>;
    private catmullRomPoints: Array<vec3>;
    private cubicBezierPoints: Array<vec3>;
    private quadraticBeziers: Array<QuadraticBezier>;

    private _points: Array<vec3>;
    private _radius: number;

    private graphicsLibrary: GraphicsLibrary;
    private buffer: LinearImmutableArray | null = null;
    private id = -1;

    private _bufferPosition = 0;

    private _partOfBVH: boolean;
    private _dirtyBVH: boolean;
    private _opaque = true;

    public set opaque(opaque: boolean) {
        this._opaque = opaque;
    }

    public get opaque(): boolean {
        return this._opaque;
    }

    public partOfBVH(): boolean {
        return this._partOfBVH;
    }

    public dirtyBVH(): boolean {
        return this._dirtyBVH;
    }

    public setCleanBVH(): void {
        this._dirtyBVH = false;
    }

    public setDirtyBVH(): void {
        this._dirtyBVH = true;
    }

    public getID(): number {
        return this.id;
    }

    constructor(
        graphicsLibrary: GraphicsLibrary,
        id: number,
        partOfBVH = true,
        points: Array<vec3>,
        radius = 0.01,
        colors: Array<vec4> | null = null,) {
        this.graphicsLibrary = graphicsLibrary;
        this.id = id;
        this._partOfBVH = partOfBVH;
        this._dirtyBVH = true;

        this._points = points;

        // Pad the spline with invisible start and end point
        const startPoint = vec3.add(vec3.create(), vec3.sub(vec3.create(), points[0], points[1]), points[0]);
        const endPoint = vec3.add(vec3.create(), vec3.sub(vec3.create(), points[points.length - 1], points[points.length - 2]), points[points.length - 1]);

        this.catmullRomPoints = new Array(points.length);
        for (let i = 0; i < points.length; i++) {
            this.catmullRomPoints[i] = vec3.clone(points[i]);
        }
        this.catmullRomPoints.unshift(startPoint);
        this.catmullRomPoints.push(endPoint);

        // N points creates N - 3 catmull rom splines.
        // N - 3 catmull rom splines are approximated by N - 3 cubic beziers
        // N - 3 cubic beziers are approximated by 2 * (N - 3) quadratic beziers
        const cubicBeziersLength = (this.catmullRomPoints.length - 3)
        const quadraticBeziersLength = 2 * cubicBeziersLength;

        if (colors) {
            this.splinesColors = colors;
        } else {
            this.splinesColors = new Array(quadraticBeziersLength);
            this.splinesColors.fill(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
        }

        this.cubicBezierPoints = new Array(this.catmullRomPoints.length);
        this.quadraticBeziers = new Array(quadraticBeziersLength);
        this._radius = Math.min(0.005, radius);

        for (let i = 0; i < this.catmullRomPoints.length - 3; i++) {
            let p0 = this.catmullRomPoints[i + 0];
            let p1 = this.catmullRomPoints[i + 1];
            let p2 = this.catmullRomPoints[i + 2];
            let p3 = this.catmullRomPoints[i + 3];

            const d1 = vec3.length(vec3.sub(vec3.create(), p0, p1));
            const d2 = vec3.length(vec3.sub(vec3.create(), p1, p2));
            const d3 = vec3.length(vec3.sub(vec3.create(), p2, p3));

            const alpha = 0.5;

            const d1_alpha = Math.pow(d1, alpha);
            const d2_alpha = Math.pow(d2, alpha);
            const d3_alpha = Math.pow(d3, alpha);
            const d1_2alpha = Math.pow(d1, 2.0 * alpha);
            const d2_2alpha = Math.pow(d2, 2.0 * alpha);
            const d3_2alpha = Math.pow(d3, 2.0 * alpha);

            this.cubicBezierPoints[i + 0] = vec3.create();
            this.cubicBezierPoints[i + 1] = vec3.create();
            this.cubicBezierPoints[i + 2] = vec3.create();
            this.cubicBezierPoints[i + 3] = vec3.create();

            this.cubicBezierPoints[i + 0] = p1;
            this.cubicBezierPoints[i + 3] = p2;

            this.cubicBezierPoints[i + 1][0] = (d1_2alpha * p2[0] - d2_2alpha * p0[0] + (2.0 * d1_2alpha + 3.0 * d1_alpha * d2_alpha + d2_2alpha) * p1[0]) / (3.0 * d1_alpha * (d1_alpha + d2_alpha));
            this.cubicBezierPoints[i + 1][1] = (d1_2alpha * p2[1] - d2_2alpha * p0[1] + (2.0 * d1_2alpha + 3.0 * d1_alpha * d2_alpha + d2_2alpha) * p1[1]) / (3.0 * d1_alpha * (d1_alpha + d2_alpha));
            this.cubicBezierPoints[i + 1][2] = (d1_2alpha * p2[2] - d2_2alpha * p0[2] + (2.0 * d1_2alpha + 3.0 * d1_alpha * d2_alpha + d2_2alpha) * p1[2]) / (3.0 * d1_alpha * (d1_alpha + d2_alpha));

            this.cubicBezierPoints[i + 2][0] = (d3_2alpha * p1[0] - d2_2alpha * p3[0] + (2.0 * d3_2alpha + 3.0 * d3_alpha * d2_alpha + d2_2alpha) * p2[0]) / (3.0 * d3_alpha * (d3_alpha + d2_alpha));
            this.cubicBezierPoints[i + 2][1] = (d3_2alpha * p1[1] - d2_2alpha * p3[1] + (2.0 * d3_2alpha + 3.0 * d3_alpha * d2_alpha + d2_2alpha) * p2[1]) / (3.0 * d3_alpha * (d3_alpha + d2_alpha));
            this.cubicBezierPoints[i + 2][2] = (d3_2alpha * p1[2] - d2_2alpha * p3[2] + (2.0 * d3_2alpha + 3.0 * d3_alpha * d2_alpha + d2_2alpha) * p2[2]) / (3.0 * d3_alpha * (d3_alpha + d2_alpha));

            p0 = this.cubicBezierPoints[i + 0];
            p1 = this.cubicBezierPoints[i + 1];
            p2 = this.cubicBezierPoints[i + 2];
            p3 = this.cubicBezierPoints[i + 3];

            const Q0 = vec3.clone(p0);
            const Q4 = vec3.clone(p3);
            const Q1 = vec3.create();
            Q1[0] = p0[0] + 1.5 * 0.5 * (p1[0] - p0[0]);
            Q1[1] = p0[1] + 1.5 * 0.5 * (p1[1] - p0[1]);
            Q1[2] = p0[2] + 1.5 * 0.5 * (p1[2] - p0[2]);
            const Q3 = vec3.create();
            Q3[0] = p3[0] - 1.5 * (1.0 - 0.5) * (p3[0] - p2[0]);
            Q3[1] = p3[1] - 1.5 * (1.0 - 0.5) * (p3[1] - p2[1]);
            Q3[2] = p3[2] - 1.5 * (1.0 - 0.5) * (p3[2] - p2[2]);
            const Q2 = vec3.create();
            Q2[0] = (1.0 - 0.5) * Q1[0] + 0.5 * Q3[0];
            Q2[1] = (1.0 - 0.5) * Q1[1] + 0.5 * Q3[1];
            Q2[2] = (1.0 - 0.5) * Q1[2] + 0.5 * Q3[2];

            this.quadraticBeziers[2 * i] = new QuadraticBezier(Q0, Q1, Q2);
            this.quadraticBeziers[2 * i + 1] = new QuadraticBezier(Q2, Q3, Q4);
        }
    }

    public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number {
        if (type != null && type != LowLevelStructure.QuadraticBezierCurve) {
            return 0;
        }

        for (let i = 0; i < this.quadraticBeziers.length; i++) {
            const curve = this.quadraticBeziers[i];
            const color = this.splinesColors[i];
            const offsetWords = (offset + i) * LL_STRUCTURE_SIZE;

            buffer.f32View.set([curve.p0[0], curve.p0[1], curve.p0[2], this._radius], offsetWords + 0);
            buffer.f32View.set([curve.p1[0], curve.p1[1], curve.p1[2], this._radius], offsetWords + 4);
            buffer.f32View.set([curve.p2[0], curve.p2[1], curve.p2[2], this._radius], offsetWords + 8);

            buffer.f32View.set([color[0], color[1], color[2], 1.0], offsetWords + 12);

            buffer.i32View.set([this.id], offsetWords + 30);
            buffer.i32View.set([LowLevelStructure.QuadraticBezierCurve], offsetWords + 31);
        }

        this.buffer = buffer;
        this._bufferPosition = offset;

        this.buffer.setModifiedBytes({ start: offset * LL_STRUCTURE_SIZE_BYTES, end: (offset + this.quadraticBeziers.length) * LL_STRUCTURE_SIZE_BYTES });

        return this.quadraticBeziers.length;
    }

    public countOf(type: LowLevelStructure | null): number {
        if (type == null) {
            return this.quadraticBeziers.length;
        }

        switch (type) {
            case LowLevelStructure.QuadraticBezierCurve: return this.quadraticBeziers.length;
            default: return 0;
        }
    }

    public offsetOf(type: LowLevelStructure | null): number | null {
        if (type == LowLevelStructure.QuadraticBezierCurve) {
            return this._bufferPosition;
        }

        return null;
    }

    public localOffsetOf(type: LowLevelStructure, offset: number): number {
        switch (type) {
            case LowLevelStructure.QuadraticBezierCurve: return offset - this._bufferPosition;
        }

        return -1;
    }

    public removeFromArrayBuffer(): void {
        if (!this.buffer) {
            return;
        }

        for (let i = 0; i < this.quadraticBeziers.length; i++) {
            this.buffer.i32View.set([LowLevelStructure.None], (this._bufferPosition + i) * LL_STRUCTURE_SIZE + 31);
        }
        this.buffer.setModifiedBytes({ start: this._bufferPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._bufferPosition + this.quadraticBeziers.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    //#region Style
    public get radius(): number {
        return this._radius;
    }

    public set radius(radius: number) {
        if (!this.buffer) return;

        this._radius = Math.min(0.01, radius);
        console.log(radius, this._radius);

        for (let i = 0; i < this.quadraticBeziers.length; i++) {
            const curve = this.quadraticBeziers[i];
            const offsetWords = (this._bufferPosition + i) * LL_STRUCTURE_SIZE;

            this.buffer.f32View.set([curve.p0[0], curve.p0[1], curve.p0[2], this._radius], offsetWords + 0);
            this.buffer.f32View.set([curve.p1[0], curve.p1[1], curve.p1[2], this._radius], offsetWords + 4);
            this.buffer.f32View.set([curve.p2[0], curve.p2[1], curve.p2[2], this._radius], offsetWords + 8);
        }

        this.buffer.setModifiedBytes({ start: this._bufferPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._bufferPosition + this.quadraticBeziers.length) * LL_STRUCTURE_SIZE_BYTES });
        this._dirtyBVH = true;
    }

    // public setSplineSegmentColor(segment: number, color: vec3) {
    //     this.splinesColors[segment] = color;
    //     this.quadraticBeziers[segment].color = this.splinesColors[segment];

    //     if (this.buffer != null && this.bufferView != null) {
    //         this.writeToArrayBuffer(this.buffer, this.bufferView, this._bufferPosition, null);
    //     }
    // }

    // public setSplineColor(color: vec3) {
    //     for (let i = 0; i < this.quadraticBeziers.length; i++) {
    //         this.splinesColors[i] = color;
    //         this.quadraticBeziers[i].color = this.splinesColors[i];
    //     }

    //     if (this.buffer != null && this.bufferView != null) {
    //         this.writeToArrayBuffer(this.buffer, this.bufferView, this._bufferPosition, null);
    //     }
    // }
    //#endregion
}