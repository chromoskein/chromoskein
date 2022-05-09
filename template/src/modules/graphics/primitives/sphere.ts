import { vec3, vec4 } from "gl-matrix";
import { GraphicsLibrary } from "..";
import { ArrayViews, LinearImmutableArray } from "../allocators";
import { BoundingBox, BoundingBoxCalculateCenter, BoundingBoxEmpty, BoundingBoxExtendByPoint } from "../shared";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE_BYTES, LL_STRUCTURE_SIZE } from "./shared";

export function writeSphereToArrayBuffer(
    array: LinearImmutableArray,
    offset: number,
    {
        partOfBVH = true,
        center = null,
        radius = null,
        color = null,
        borderColor = null,        
    }: {
        partOfBVH?: boolean;
        center?: vec3 | null;
        radius?: number | null;
        color?: vec4 | null;
        borderColor?: vec4 | null;        
    } = {}
): void {
    const offsetWords = offset * LL_STRUCTURE_SIZE;

    if (center) {
        array.f32View.set([center[0], center[1], center[2]], offsetWords + 0);
    }

    if (radius) {
        array.f32View.set([radius], offsetWords + 3);
    }

    if (color) {
        array.f32View.set(color, offsetWords + 4);
    }

    if (borderColor) {
        array.f32View.set(borderColor, offsetWords + 8);
    }

    array.i32View.set([partOfBVH ? 1 : 0], offsetWords + 29);
    array.i32View.set([LowLevelStructure.Sphere], offsetWords + 31);
}

export function sphereToBoundingBox(array: ArrayViews, offset: number): BoundingBox {
    const result = BoundingBoxEmpty();

    const spherePosition = vec3.fromValues(
        array.f32View[offset * LL_STRUCTURE_SIZE + 0],
        array.f32View[offset * LL_STRUCTURE_SIZE + 1],
        array.f32View[offset * LL_STRUCTURE_SIZE + 2]
    );
    const sphereRadius = array.f32View[offset * LL_STRUCTURE_SIZE + 3];

    BoundingBoxExtendByPoint(result, vec3.add(vec3.create(), spherePosition, vec3.fromValues(sphereRadius, sphereRadius, sphereRadius)));
    BoundingBoxExtendByPoint(result, vec3.add(vec3.create(), spherePosition, vec3.fromValues(-sphereRadius, -sphereRadius, -sphereRadius)));

    BoundingBoxCalculateCenter(result);

    return result;
}

export class Sphere implements HighLevelStructure {
    private graphicsLibrary: GraphicsLibrary;
    private buffer: LinearImmutableArray | null = null;
    private id: number;

    private _spherePosition = 0;

    private _center: vec3;
    private _radius: number;

    //#region Style
    private _color: vec4;
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

    constructor(graphicsLibrary: GraphicsLibrary, id: number, partOfBVH = true, center: vec3, radius = 1.0, color: vec4 | null = null) {
        this.graphicsLibrary = graphicsLibrary;
        this.id = id;
        this._partOfBVH = partOfBVH;
        this._dirtyBVH = true;

        this._center = center;
        this._radius = radius;
        this._color = color ?? vec4.fromValues(1.0, 1.0, 1.0, 1.0)
    }

    public getID(): number {
        return this.id;
    }

    //#region HighLevelStructure Interface
    public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number {
        if (type != null && type != LowLevelStructure.Sphere) {
            return 0;
        }

        this.buffer = buffer;
        this._spherePosition = offset;

        writeSphereToArrayBuffer(buffer, offset, {
            center: this._center,
            radius: this._radius,
            color: this._color,
        });

        buffer.i32View.set([this.id], offset * LL_STRUCTURE_SIZE + 30);

        this.buffer.setModifiedBytes({ start: offset * LL_STRUCTURE_SIZE_BYTES, end: (offset + 1) * LL_STRUCTURE_SIZE_BYTES });

        return 1;
    }

    public removeFromArrayBuffer(): void {
        if (!this.buffer) {
            return;
        }

        this.buffer.i32View.set([LowLevelStructure.None], this._spherePosition * LL_STRUCTURE_SIZE + 31);
        this.buffer.setModifiedBytes({ start: this._spherePosition * LL_STRUCTURE_SIZE_BYTES, end: (this._spherePosition + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public countOf(type: LowLevelStructure | null): number {
        if (type == null || type == LowLevelStructure.Sphere) {
            return 1;
        }

        return 0;
    }

    public offsetOf(type: LowLevelStructure | null): number | null {
        if (type == LowLevelStructure.Sphere) {
            return this._spherePosition;
        }

        return null;
    }

    public localOffsetOf(type: LowLevelStructure, offset: number): number {
        switch (type) {
            case LowLevelStructure.Sphere: return offset - this._spherePosition;
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

    private setModified(dirtyBVH = true) {
        this.buffer?.setModifiedBytes({ start: this._spherePosition * LL_STRUCTURE_SIZE_BYTES, end: (this._spherePosition + 1) * LL_STRUCTURE_SIZE_BYTES });
        this._dirtyBVH = dirtyBVH;
    }

    //#region Setters & Getters
    public getCenter(): vec3 {
        return this._center;
    }

    public setCenter(center: vec3): void {
        this._center = center;

        if (!this.buffer) return;

        writeSphereToArrayBuffer(this.buffer, this._spherePosition, { center });
        this.setModified();
    }

    public getRadius(): number {
        return this._radius;
    }

    public setRadius(radius: number): void {
        this._radius = radius;

        if (!this.buffer) return;

        writeSphereToArrayBuffer(this.buffer, this._spherePosition, { radius });
        this.setModified();
    }

    public getColor(): vec4 {
        return this._color;
    }

    public setColor(color: vec4): void {
        this._color = color;

        if (!this.buffer) return;

        writeSphereToArrayBuffer(this.buffer, this._spherePosition, { color });
        this.setModified(false);
    }
    //#endregion
}