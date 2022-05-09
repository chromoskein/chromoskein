// import { vec3 } from "gl-matrix";
// import { LinearImmutableArray } from "../allocators/";
// import { BoundingBox } from "../bvh/bounding_box";
// import { cylinderToBoundingBox, writeCylinderToArrayBuffer } from "./direct_write";
// import { LowLevelStructure, HighLevelStructure, LL_STRUCTURE_SIZE, LL_STRUCTURE_SIZE_BYTES } from "./shared";

// export class Cylinder implements HighLevelStructure {
//     //#region Description
//     private _from: vec3;
//     private _to: vec3;
//     private _radius: number;   
//     //#endregion

//     //#region Style
//     private _color: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
//     //#endregion

//     private buffer: LinearImmutableArray | null = null;
//     private bufferView: DataView | null = null;

//     private _bufferPosition: number = 0;

//     constructor(graphicsLibrary: GraphicsLibrary, from: vec3, to: vec3, radius: number = 1.0) {
//         this._from = from;
//         this._to = to;
//         this._radius = radius;
//     }

//     public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null, if: number): number {
//         if (type != null && type != LowLevelStructure.Cylinder) {
//             return 0;
//         }

//         this.buffer = buffer;
//         this.bufferView = view;
        
//         writeCylinderToArrayBuffer(view, offset, this._from, this._to, this._radius);
//         this.buffer.setModifiedBytes({ start: offset * LL_STRUCTURE_SIZE_BYTES, end: (offset + 1) * LL_STRUCTURE_SIZE_BYTES });

//         this._bufferPosition = offset;

//         return 1;
//     }

//     public countOf(type: LowLevelStructure | null): number {
//         if (type == null || type == LowLevelStructure.Cylinder) {
//             return 1;
//         }

//         return 0;
//     }

//     public offsetOf(type: LowLevelStructure | null): number | null {
//         if (type == null || type == LowLevelStructure.Cylinder) {
//             return this._bufferPosition;
//         }

//         return null;
//     }

//     public removeFromArrayBuffer(): void {
//         if (!this.buffer || !this.bufferView) {
//             return;
//         }

//         this.bufferView.setInt32(this._bufferPosition * LL_STRUCTURE_SIZE_BYTES + 124, LowLevelStructure.None, true);
//         this.buffer.setModifiedBytes({ start: this._bufferPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._bufferPosition + 1) * LL_STRUCTURE_SIZE_BYTES });
//     }

//     public boundingBox(): BoundingBox {
//         return cylinderToBoundingBox(this.bufferView, this._bufferPosition);
//     }
// }