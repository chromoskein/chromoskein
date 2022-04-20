import { vec3, vec4 } from "gl-matrix";
import { LinearImmutableArray } from "../allocators";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE, LL_STRUCTURE_SIZE_BYTES } from "./shared";
import { writeSphereToArrayBuffer } from "./sphere";
import { GraphicsLibrary } from "..";

export class Spheres implements HighLevelStructure {
    private graphicsLibrary: GraphicsLibrary;
    private buffer: LinearImmutableArray | null = null;
    private id: number;

    private _spheresPosition = 0;

    private _centers: Array<vec3>;
    private _radius: number;

    //#region Style
    private _colors: Array<vec4>;
    private _borderColors: Array<vec4>;
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

    constructor(graphicsLibrary: GraphicsLibrary, id: number, partOfBVH = true, points: Array<vec3>, colors: Array<vec4> | null = null) {
        this.graphicsLibrary = graphicsLibrary;

        this.id = id;
        this._centers = points;
        this._partOfBVH = partOfBVH;
        this._dirtyBVH = true;
        this._radius = 0.0;

        if (colors == null) {
            this._colors = new Array(this._centers.length);
            this._colors.fill(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
        } else {
            if (this._centers.length != colors.length) {
                throw "";
            }
            this._colors = colors;
        }
        this._borderColors = this._colors.map(v => vec4.clone(v));
    }

    public getID(): number {
        return this.id;
    }

    //#region HighLevelStructure Interface
    public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number {
        let written = 0;

        this.buffer = buffer;

        if (type == null || type == LowLevelStructure.Sphere) {
            for (let i = 0; i < this._centers.length; i++) {
                writeSphereToArrayBuffer(buffer, offset + i, {
                    center: this._centers[i],
                    radius: this._radius,
                    color: this._colors[i],
                    borderColor: this._borderColors[i],
                    partOfBVH: this._partOfBVH,
                });

                buffer.i32View.set([this.id], (offset + i) * LL_STRUCTURE_SIZE + 30);
            }

            this._spheresPosition = offset;
            this.buffer.setModifiedBytes({ start: offset * LL_STRUCTURE_SIZE_BYTES, end: (offset + this._centers.length) * LL_STRUCTURE_SIZE_BYTES });

            written += this._centers.length;
        }

        return written;
    }

    public removeFromArrayBuffer(): void {
        if (!this.buffer) {
            return;
        }

        for (let i = 0; i < this._centers.length; i++) {
            this.buffer.i32View.set([LowLevelStructure.None], (this._spheresPosition + i) * LL_STRUCTURE_SIZE + 31);
        }

        this.buffer.setModifiedBytes({ start: this._spheresPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._spheresPosition + this._centers.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public countOf(type: LowLevelStructure | null): number {
        if (type == null || type == LowLevelStructure.Sphere) {
            return (this._centers.length);
        }

        return 0;
    }

    public offsetOf(type: LowLevelStructure | null): number | null {
        switch (type) {
            case LowLevelStructure.Sphere: return this._spheresPosition;
            default: return 0;
        }
    }

    public localOffsetOf(type: LowLevelStructure, offset: number): number {
        switch (type) {
            case LowLevelStructure.Sphere: return offset - this._spheresPosition;
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

    private setModified(i: number, dirtyBVH = true) {
        this.buffer?.setModifiedBytes({ start: this._spheresPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._spheresPosition + i) * LL_STRUCTURE_SIZE_BYTES });
        this._dirtyBVH = dirtyBVH;
    }

    //#region Setters & Getters
    public get radius(): number {
        return this._radius;
    }

    public set radius(radius: number) {
        this._radius = radius;

        this.buffer?.setModifiedBytes({ start: this._spheresPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._spheresPosition + this._centers.length) * LL_STRUCTURE_SIZE_BYTES });
        this._dirtyBVH = true;
    }

    public resetColors(color: vec4): void {
        this._colors.fill(vec4.clone(color));

        if (!this.buffer) return;

        for (let i = 0; i < this._colors.length; i++) {
            writeSphereToArrayBuffer(this.buffer, this._spheresPosition + i, { color: color });
        }

        this.buffer.setModifiedBytes({ start: (this._spheresPosition) * LL_STRUCTURE_SIZE_BYTES, end: (this._spheresPosition + this._colors.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public resetBorderColors(color: vec4): void {
        this._borderColors.fill(color);

        if (!this.buffer) return;

        for (let i = 0; i < this._borderColors.length; i++) {
            writeSphereToArrayBuffer(this.buffer, this._spheresPosition + i, { borderColor: this._borderColors[i] });
        }

        this.buffer.setModifiedBytes({ start: (this._spheresPosition) * LL_STRUCTURE_SIZE_BYTES, end: (this._spheresPosition + this._borderColors.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setColor(i: number, color: vec4): void {
        this._colors[i] = vec4.clone(color);

        if (!this.buffer) return;

        writeSphereToArrayBuffer(this.buffer, this._spheresPosition + i, { color });

        this.setModified(i, false);
    }

    public setColors(colors: Array<vec4>): void {
        this._colors = colors.map(v => vec4.clone(v));

        if (!this.buffer) return;

        for (let i = 0; i < this._colors.length; i++) {
            writeSphereToArrayBuffer(this.buffer, this._spheresPosition + i, { color: this._colors[i] });
        }

        this.buffer.setModifiedBytes({ start: (this._spheresPosition) * LL_STRUCTURE_SIZE_BYTES, end: (this._spheresPosition + this._colors.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setBorderColors(colors: Array<vec4>): void {
        this._borderColors = colors.map(v => vec4.clone(v));

        if (!this.buffer) return;

        for (let i = 0; i < this._borderColors.length; i++) {
            writeSphereToArrayBuffer(this.buffer, this._spheresPosition + i, { borderColor: this._borderColors[i] });
        }

        this.buffer.setModifiedBytes({ start: (this._spheresPosition) * LL_STRUCTURE_SIZE_BYTES, end: (this._spheresPosition + this._borderColors.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public getColor(i: number): vec4 | Array<vec4> {
        return this._colors[i];
    }
    //#endregion
}