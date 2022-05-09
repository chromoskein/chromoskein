import { vec3, vec4 } from "gl-matrix";
import { GraphicsLibrary } from "..";
import { LinearImmutableArray } from "../allocators";
import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE_BYTES, LL_STRUCTURE_SIZE } from "./shared";

export class AABB implements HighLevelStructure {
    private graphicsLibrary: GraphicsLibrary;
    private buffer: LinearImmutableArray | null = null;
    private id = -1;

    private _aabbPosition = 0;

    private _from: vec3;
    private _to: vec3;

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

    constructor(graphicsLibrary: GraphicsLibrary, id: number, partOfBVH = true, from: vec3, to: vec3) {
        this.graphicsLibrary = graphicsLibrary;

        this.id = id;
        this._partOfBVH = partOfBVH;
        this._dirtyBVH = true;

        this._from = from;
        this._to = to;
    }

    public getID(): number {
        return this.id;
    }

    //#region HighLevelStructure Interface
    public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number {
        if (type != null && type != LowLevelStructure.AABB) {
            return 0;
        }

        this.buffer = buffer;
        this._aabbPosition = offset;

        const offsetWords = offset * LL_STRUCTURE_SIZE;

        this.buffer.f32View.set([this._from[0], this._from[1], this._from[2]], offsetWords + 0);
        this.buffer.f32View.set([this._to[0], this._to[1], this._to[2]], offsetWords + 4);

        buffer.i32View.set([this.id], offsetWords + 30);
        buffer.i32View.set([LowLevelStructure.AABB], offsetWords + 31);

        this.buffer.setModifiedBytes({ start: this._aabbPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._aabbPosition + 1) * LL_STRUCTURE_SIZE_BYTES });

        return 1;
    }

    public removeFromArrayBuffer(): void {
        if (!this.buffer) {
            return;
        }

        this.buffer.i32View.set([LowLevelStructure.None], this._aabbPosition * LL_STRUCTURE_SIZE + 31);
        this.buffer.setModifiedBytes({ start: this._aabbPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._aabbPosition + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public countOf(type: LowLevelStructure | null): number {
        if (type == null || type == LowLevelStructure.AABB) {
            return 1;
        }

        return 0;
    }

    public offsetOf(type: LowLevelStructure | null): number | null {
        if (type == LowLevelStructure.AABB) {
            return this._aabbPosition;
        }

        return null;
    }

    public localOffsetOf(type: LowLevelStructure, offset: number): number {
        switch (type) {
            case LowLevelStructure.AABB: return offset - this._aabbPosition;
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
}
