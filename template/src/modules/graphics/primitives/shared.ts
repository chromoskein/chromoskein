import { LinearImmutableArray } from "../allocators";

// Size in bytes of low level structure in low level buffer
export const LL_STRUCTURE_SIZE_BYTES = 128;
// Size in words(f32/i32) of low level structure in low level buffer
export const LL_STRUCTURE_SIZE = (LL_STRUCTURE_SIZE_BYTES / 4);

export enum LowLevelStructure {
    Sphere = 0,
    Cylinder = 1,
    QuadraticBezierCurve = 2,
    AABB = 3,
    RoundedCone = 4,
    PolygonalMesh = 5,
    None = 9999,
}

export function typeOfPrimitive(view: DataView, offset: number): LowLevelStructure {
    const offsetBytes = offset * LL_STRUCTURE_SIZE_BYTES;

    return view.getInt32(offsetBytes + 124, true);
}

export interface HighLevelStructure {
    /**
     * writeToArrayBuffer
     * 
     * @param buffer - buffer to write low level structures
     * @param offset - offset into the buffer where low level structures are written
     * @param type - type of low level structures that this high level structure should write. null to write them all
     * 
     * @returns number of low level structures that were written
     */
    writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number;

    /**
     * Removes the structure from the *buffer* by zeroing out type variable in each low level structure
     */
    removeFromArrayBuffer(): void;

    /**
     * 
     * @param type 
     */
    offsetOf(type: LowLevelStructure | null): number | null;

    /**
     * 
     * @param type 
     */
    countOf(type: LowLevelStructure | null): number;

    /**
     * 
     * @param type 
     * @param offset 
     */
    localOffsetOf(type: LowLevelStructure, offset: number): number;

    getID(): number;

    partOfBVH(): boolean;
    dirtyBVH(): boolean;
    setCleanBVH(): void;
    setDirtyBVH(): void;

    opaque: boolean;
}
