import { vec3, vec4 } from "gl-matrix";
import { LinearImmutableArray } from "../allocators";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE, LL_STRUCTURE_SIZE_BYTES } from "./shared";
import { GraphicsLibrary } from "..";
import { writeRoundedConeToArrayBuffer } from "./rounded_cone";

export enum GradientPrecision {
    P10 = 10,
    P100 = 100,
}

export class ContinuousTube implements HighLevelStructure {
    private _points: Array<vec3>;
    private _pointsCullable: Array<boolean>;
    private _connectivityBitset: Array<0 | 1>;
    private _radius: number;

    private graphicsLibrary: GraphicsLibrary;
    private buffer: LinearImmutableArray | null = null;
    private id = -1;

    private _roundedConesPosition = 0;

    //#region Style
    private _colors: Array<vec4>;
    private _colors2: Array<vec4>;
    //#endregion

    private _ids: Array<number>;

    private _partOfBVH: boolean;
    private _dirtyBVH: boolean;

    private _opaque = true;

    public set opaque(opaque: boolean) {
        this._opaque = opaque;
    }

    public get opaque(): boolean {
        return this._opaque;
    }

    constructor(
        graphicsLibrary: GraphicsLibrary,
        id: number,
        partOfBVH = true,
        points: Array<vec3>,
        radius = 1.0,
        colors: Array<vec4> | null = null,
        connectivityBitset: Array<0 | 1> | null) {
        this.graphicsLibrary = graphicsLibrary;
        this.id = id;
        this._partOfBVH = partOfBVH;
        this._dirtyBVH = true;

        this._points = points;
        this._connectivityBitset = connectivityBitset || new Array(this._points.length).fill(1);
        this._pointsCullable = new Array().fill(true);

        if (colors == null) {
            this._colors = new Array(this._points.length - 1);
            this._colors.fill(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
        } else {
            this._colors = colors;
        }

        this._colors2 = this._colors.map(e => vec4.clone(e));

        this._radius = radius;

        //~ Selection IDs for rendering into G-Buffer attachment
        this._ids = new Array(this._points.length); //~ why the other ones are points.length - 1?????
        this._ids.fill(-1);
    }

    public deallocate(): void {
    }

    public getID(): number {
        return this.id;
    }

    //#region HighLevelStructure interface
    public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number {
        let written = 0;

        this.buffer = buffer;

        if (type == null || type == LowLevelStructure.RoundedCone) {
            for (let i = 0; i < this._points.length - 1; i++) {
                writeRoundedConeToArrayBuffer(buffer, offset + i, {
                    from: this._points[i],
                    to: this._points[i + 1],
                    radius: this._connectivityBitset[i] == 0 ? 0.0 : this._radius,
                    color: this._colors[i],
                    color2: this._colors2[i],
                    selectionId: 1,
                    selectionId2: 1,
                    cull: this._pointsCullable[i],
                });

                buffer.i32View.set([this._partOfBVH ? 1 : 0], (offset + i) * LL_STRUCTURE_SIZE + 29);
                buffer.i32View.set([this.id], (offset + i) * LL_STRUCTURE_SIZE + 30);
            }

            this._roundedConesPosition = offset;
            this.buffer.setModifiedBytes({ start: offset * LL_STRUCTURE_SIZE_BYTES, end: (offset + this._points.length) * LL_STRUCTURE_SIZE_BYTES });

            written += this._points.length - 1;
        }

        return written;
    }

    public removeFromArrayBuffer(): void {
        if (!this.buffer) {
            return;
        }

        for (let i = 0; i < this._points.length - 1; i++) {
            this.buffer.i32View.set([LowLevelStructure.None], (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE + 31);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public countOf(type: LowLevelStructure | null): number {
        if (type == null || type == LowLevelStructure.RoundedCone) {
            return (this._points.length - 1);
        }

        return 0;
    }

    public offsetOf(type: LowLevelStructure | null): number | null {
        switch (type) {
            case LowLevelStructure.RoundedCone: return this._roundedConesPosition;
            default: return 0;
        }
    }

    public localOffsetOf(type: LowLevelStructure, offset: number): number {
        switch (type) {
            case LowLevelStructure.RoundedCone: return offset - this._roundedConesPosition;
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

    public get points(): Array<vec3> {
        return this._points;
    }

    public get radius(): number {
        return this._radius;
    }

    public set radius(radius: number) {
        this._radius = radius;

        if (!this.buffer) {
            return;
        }

        for (let i = 0; i < this._points.length - 1; i++) {
            writeRoundedConeToArrayBuffer(this.buffer, this._roundedConesPosition + i, { radius: this._connectivityBitset[i] == 0 ? 0.0 : this._radius, });
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length) * LL_STRUCTURE_SIZE_BYTES });
        this._dirtyBVH = true;
    }

    public get length(): number {
        return this._points.length - 1;
    }

    public setCullablePoints(cullable: Array<boolean>) {
        this._pointsCullable = [...cullable];

        if (!this.buffer) return;

        for(let i = 0; i < this._points.length; i++) writeRoundedConeToArrayBuffer(this.buffer, this._roundedConesPosition + i, { cull: this._pointsCullable[i] });

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public getColor(i: number): vec4 | Array<vec4> {
        return this._colors[i];
    }


    public resetColor(color: vec4): void {
        this._colors.fill(color);

        if (!this.buffer) {
            return;
        }

        this.setColors(this._colors);
    }

    public resetColors(color: vec4): void {
        if (!this.buffer) return;

        this._colors.fill(color);
        this._colors2.fill(color);

        const colorsArrayBuffer = new Uint8Array([
            color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255,
            color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255,
        ]);

        const u8view = this.buffer.u8view;

        for (let i = 0; i < this._points.length - 1; i++) {
            u8view.set(colorsArrayBuffer, (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES + 64);
        }
    }

    public setColor(color: vec4, i: number): void {
        this._colors[i] = vec4.clone(color);

        if (!this.buffer) {
            return;
        }

        writeRoundedConeToArrayBuffer(this.buffer, this._roundedConesPosition + i, { color: this._colors[i] });

        this.buffer.setModifiedBytes({ start: (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + i + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setColors(colors: Array<vec4>): void {
        this._colors = colors.map(c => vec4.clone(c));

        if (!this.buffer) {
            return;
        }

        for (let i = 0; i < this._colors.length - 1; i++) {
            this.setColor(colors[i], i);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._colors.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public resetColor2(color: vec4): void {
        this._colors2.fill(color);

        this.setColors2(this._colors2);
    }

    public setColor2(color: vec4, i: number): void {
        this._colors2[i] = vec4.clone(color);

        if (!this.buffer) {
            return;
        }

        writeRoundedConeToArrayBuffer(this.buffer, this._roundedConesPosition + i, { color2: this._colors2[i] });

        this.buffer.setModifiedBytes({ start: (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + i + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setColors2(colors2: Array<vec4>): void {
        this._colors2 = colors2.map(c => vec4.clone(c));

        if (!this.buffer) {
            return;
        }

        for (let i = 0; i < this._colors.length - 1; i++) {
            this.setColor2(colors2[i], i);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._colors.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setColorsCombined(colors: Array<vec4>): void {
        if (!this.buffer) {
            return;
        }

        if (colors.length != 2 * (this._points.length - 1)) {            
            console.log(`Number of colors must be '2 * (points - 1)'. Number of colors provided is ${colors.length}, expected ${(this._points.length - 1) * 2}`);
            return;
            // throw new Error(`Number of colors must be '2 * (points - 1)'. Number of colors provided is ${colors.length}, expected ${(this._points.length - 1) * 2}`);
        }

        const u8view = this.buffer.u8view;
        for (let i = 0; i < this._points.length - 1; i++) {
            const color = colors[2 * i];
            const color2 = colors[2 * i + 1];

            const offsetBytes = (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES;

            this._colors[i] = color;
            this._colors2[i] = color2;

            u8view.set([color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255,
                        color2[0] * 255, color2[1] * 255, color2[2] * 255, color2[3] * 255], offsetBytes + 64);
            // u8view.set([color2[0] * 255, color2[1] * 255, color2[2] * 255, color2[3] * 255], offsetBytes + 68);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setSelectionIds(binIds: number[]): void {
        if (!this.buffer) {
            return;
        }

        //~ add ids to beginning and end, because...dumb dumbs
        const newBinIds = binIds.slice();
        const firstElId = binIds[0];
        const lastElId = binIds[binIds.length - 1];
        newBinIds.unshift(firstElId);
        newBinIds.push(lastElId);

        const f32View = this.buffer.f32View;
        for (let i = 0; i < this._points.length - 1; i++) {
            // const id = binIds[i];
            // const id2 = binIds[i + 1];
            const id = newBinIds[i];
            const id2 = newBinIds[i + 1];

            const offset = this._roundedConesPosition + i;
            const offsetWords = offset * LL_STRUCTURE_SIZE;

            // f32View.set([id], offsetWords + 24);
            f32View.set([id], offsetWords + 21);
            // f32View.set([id2], offsetWords + 28);
            f32View.set([id2], offsetWords + 22);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length + 1) * LL_STRUCTURE_SIZE_BYTES });

    }
}