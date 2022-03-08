import { vec3, vec4 } from "gl-matrix";
import { GraphicsLibrary } from "..";
import { ArrayViews, LinearImmutableArray } from "../allocators/";
import { BoundingBox, BoundingBoxCalculateCenter, BoundingBoxEmpty } from "../shared";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE, LL_STRUCTURE_SIZE_BYTES } from "./shared";

export function writeRoundedConeToArrayBuffer(
    array: LinearImmutableArray,
    offset: number,
    {
        from = null,
        to = null,
        radius = null,
        leftPlane = null,
        rightPlane = null,
        color = null,
        color2 = null,
        borderColor = null,
        borderColor2 = null,
        borderRatio = 0.0,
    }: {
        from?: vec3 | null;
        to?: vec3 | null;
        radius?: number | null;
        leftPlane?: vec4 | null;
        rightPlane?: vec4 | null;
        color?: vec4 | null;
        color2?: vec4 | null;
        borderColor?: vec4 | null;
        borderColor2?: vec4 | null;
        borderRatio?: number | null;
    } = {}
): void {
    const offsetBytes = offset * LL_STRUCTURE_SIZE_BYTES;
    const offsetWords = offset * LL_STRUCTURE_SIZE;

    if (from) {
        array.f32View.set([from[0], from[1], from[2]], offsetWords + 0);
    }

    if (to) {
        array.f32View.set([to[0], to[1], to[2]], offsetWords + 4);
    }

    if (radius) {
        array.f32View.set([radius], offsetWords + 3);
        array.f32View.set([radius], offsetWords + 7);
    }

    if (leftPlane) {
        array.f32View.set([leftPlane[0], leftPlane[1], leftPlane[2], leftPlane[3]], offsetWords + 8);
    }

    if (rightPlane) {
        array.f32View.set([rightPlane[0], rightPlane[1], rightPlane[2], rightPlane[3]], offsetWords + 12);
    }

    if (color) {
        array.u8view.set([color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255], offsetBytes + 64);
    }

    if (color2) {
        array.u8view.set([color2[0] * 255, color2[1] * 255, color2[2] * 255, color2[3] * 255], offsetBytes + 68);
    }

    if (borderColor) {
        array.u8view.set([borderColor[0] * 255, borderColor[1] * 255, borderColor[2] * 255, borderColor[3] * 255], offsetBytes + 72);
    }

    if (borderColor2) {
        array.u8view.set([borderColor2[0] * 255, borderColor2[1] * 255, borderColor2[2] * 255, borderColor2[3] * 255], offsetBytes + 76);
    }

    if (borderRatio) {
        array.f32View.set([borderRatio], offsetWords + 20);
    }

    array.i32View.set([LowLevelStructure.RoundedCone], offsetWords + 31);
}

export function roundedConeToBoundingBox(array: ArrayViews, offset: number): BoundingBox {
    const result = BoundingBoxEmpty();

    const cylinderFrom = vec3.fromValues(
        array.f32View[offset * LL_STRUCTURE_SIZE + 0],
        array.f32View[offset * LL_STRUCTURE_SIZE + 1],
        array.f32View[offset * LL_STRUCTURE_SIZE + 2]
    );
    const cylinderRadius = array.f32View[offset * LL_STRUCTURE_SIZE + 3];
    const cylinderTo = vec3.fromValues(
        array.f32View[offset * LL_STRUCTURE_SIZE + 4],
        array.f32View[offset * LL_STRUCTURE_SIZE + 5],
        array.f32View[offset * LL_STRUCTURE_SIZE + 6]
    );

    const a = vec3.sub(vec3.create(), cylinderTo, cylinderFrom);

    const directionExpand = vec3.normalize(vec3.create(), a);
    vec3.scale(directionExpand, directionExpand, cylinderRadius * 1.1);

    vec3.add(cylinderTo, cylinderTo, directionExpand);
    vec3.negate(directionExpand, directionExpand);
    vec3.add(cylinderFrom, cylinderFrom, directionExpand);

    const d = (1.0 / vec3.dot(a, a));
    const e = vec3.create();
    e[0] = cylinderRadius * Math.sqrt(1.0 - a[0] * a[0] * d);
    e[1] = cylinderRadius * Math.sqrt(1.0 - a[1] * a[1] * d);
    e[2] = cylinderRadius * Math.sqrt(1.0 - a[2] * a[2] * d);

    result.min = vec3.min(vec3.create(), vec3.sub(vec3.create(), cylinderFrom, e), vec3.sub(vec3.create(), cylinderTo, e));
    result.max = vec3.max(vec3.create(), vec3.add(vec3.create(), cylinderFrom, e), vec3.add(vec3.create(), cylinderTo, e));
    BoundingBoxCalculateCenter(result);

    return result;
}

export class RoundedCone implements HighLevelStructure {
    private graphicsLibrary: GraphicsLibrary;
    private buffer: LinearImmutableArray | null = null;
    private id = -1;

    private _bufferPosition = 0;

    //#region Description
    private _from: vec3;
    private _to: vec3;
    private _radius: number;
    private _leftPlane: vec4 = vec4.fromValues(0.0, 0.0, 0.0, 0.0);
    private _rightPlane: vec4 = vec4.fromValues(0.0, 0.0, 0.0, 0.0);
    //#endregion

    //#region Style
    private _color: vec4 = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
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

    constructor(graphicsLibrary: GraphicsLibrary, id: number, partOfBVH: boolean, from: vec3, to: vec3, radius = 1.0, leftPlane: vec4 = vec4.fromValues(0.0, 0.0, 0.0, 0.0), rightPlane: vec4 = vec4.fromValues(0.0, 0.0, 0.0, 0.0)) {
        this.graphicsLibrary = graphicsLibrary;

        this.id = id;
        this._partOfBVH = partOfBVH;
        this._dirtyBVH = true;

        this._from = from;
        this._to = to;
        this._radius = radius;
        this._leftPlane = leftPlane;
        this._rightPlane = rightPlane;
    }

    public getID(): number {
        return this.id;
    }

    public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number {
        if (type != null && type != LowLevelStructure.RoundedCone) {
            return 0;
        }

        this.buffer = buffer;
        this._bufferPosition = offset;

        writeRoundedConeToArrayBuffer(buffer, offset, {
            from: this._from,
            to: this._to,
            radius: this._radius,
            leftPlane: this._leftPlane,
            rightPlane: this._rightPlane,
            color: this._color,
            color2: this._color,
            borderColor: this._color
        });

        buffer.i32View.set([this.id], offset * LL_STRUCTURE_SIZE + 30);

        this.buffer.setModifiedBytes({ start: offset * LL_STRUCTURE_SIZE_BYTES, end: (offset + 1) * LL_STRUCTURE_SIZE_BYTES });

        return 1;
    }

    public removeFromArrayBuffer(): void {
        if (!this.buffer) {
            return;
        }

        this.buffer.i32View.set([LowLevelStructure.None], this._bufferPosition * LL_STRUCTURE_SIZE + 31);
        this.buffer.setModifiedBytes({ start: this._bufferPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._bufferPosition + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public countOf(type: LowLevelStructure | null): number {
        if (type == null || type == LowLevelStructure.RoundedCone) {
            return 1;
        }

        return 0;
    }

    public offsetOf(type: LowLevelStructure | null): number | null {
        if (type == null || type == LowLevelStructure.RoundedCone) {
            return this._bufferPosition;
        }

        return null;
    }

    public localOffsetOf(type: LowLevelStructure, offset: number): number {
        switch (type) {
            case LowLevelStructure.Sphere: return offset - this._bufferPosition;
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
}