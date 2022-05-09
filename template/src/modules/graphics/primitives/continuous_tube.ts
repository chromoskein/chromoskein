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
    private _radius: number;

    private graphicsLibrary: GraphicsLibrary;
    private buffer: LinearImmutableArray | null = null;
    private id = -1;

    private _roundedConesPosition = 0;

    //#region Style
    private _colors: Array<vec4>;
    private _colors2: Array<vec4>;
    private _borderColors: Array<vec4>;
    private _borderColors2: Array<vec4>;
    private _borderRadius: number;
    private _gradients: Array<Array<GPUColorDict> | null>;
    private _colorTextures: Array<GPUTexture | null>;
    // private _colorBindGroups: Array<GPUBindGroup>;
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

    constructor(
        graphicsLibrary: GraphicsLibrary,
        id: number,
        partOfBVH = true,
        points: Array<vec3>,
        radius = 1.0,
        colors: Array<vec4> | null = null,
        borderColors: Array<vec4> | null = null) {
        this.graphicsLibrary = graphicsLibrary;
        this.id = id;
        this._partOfBVH = partOfBVH;
        this._dirtyBVH = true;

        this._points = points;

        if (colors == null) {
            this._colors = new Array(this._points.length - 1);
            this._colors.fill(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
        } else {
            this._colors = colors;
        }

        this._colors2 = this._colors.map(e => vec4.clone(e));

        if (borderColors == null) {
            this._borderColors = new Array(this._points.length - 1);
            this._borderColors.fill(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
        } else {
            this._borderColors = borderColors;
        }

        this._borderColors2 = this._borderColors.map(e => vec4.clone(e));

        this._gradients = new Array(this._points.length - 1);
        this._colorTextures = new Array(this._points.length - 1);
        // this._colorBindGroups = new Array(this._points.length - 1);
        // this._colorBindGroups.fill(graphicsLibrary.device.createBindGroup({
        //     layout: graphicsLibrary.bindGroupLayouts.primitivesTexture,
        //     entries: [
        //         {
        //             binding: 0,
        //             resource: this.graphicsLibrary.nearestSampler,
        //         },
        //         {
        //             binding: 1,
        //             resource: this.graphicsLibrary.dummy1DTextureView,
        //         }
        //     ]
        // }), 0, this._points.length - 1);

        this._radius = radius;
        this._borderRadius = 0.33;
    }

    public deallocate(): void {
        this._colorTextures.map(t => t?.destroy());
    }

    public getID(): number {
        return this.id;
    }

    //#region HighLevelStructure interface
    public writeToArrayBuffer(buffer: LinearImmutableArray, offset: number, type: LowLevelStructure | null): number {
        let written = 0;

        this.buffer = buffer;

        if (type == null || type == LowLevelStructure.RoundedCone) {

            const planes: Array<vec4 | null> = [];
            for (let i = 0; i < this._points.length - 1; i++) {
                if (i != 0) {
                    const x1 = this._points[i - 1];
                    const x2 = this._points[i];

                    //const v1 = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), x1, x2));
                    const v1 = vec3.sub(vec3.create(), x1, x2);
                    planes.push(vec4.fromValues(
                        v1[0],
                        v1[1],
                        v1[2],
                        0.0
                    ));

                } else {
                    planes.push(null);
                }

                if (i < this._points.length - 2) {
                    const x3 = this._points[i + 1];
                    const x4 = this._points[i + 2];

                    //const v2 = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), x4, x3));
                    const v2 = vec3.sub(vec3.create(), x4, x3);
                    planes.push(vec4.fromValues(
                        v2[0],
                        v2[1],
                        v2[2],
                        0.0
                    ));
                } else {
                    planes.push(null);
                }

                // Actual Planes
                // const v1 = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), x1, x2));
                // const v2 = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), x3, x2));
                // const v3 = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), v1, v2));
                // const v4 = vec3.normalize(vec3.create(), vec3.scale(vec3.create(), vec3.add(vec3.create(), v1, v2), 0.5));

                // let planeNormal1;
                // if (vec3.length(v3) <= 0.000001) {
                //     planeNormal1 = v1;
                // } else {
                //     planeNormal1 = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), v3, v4));
                // }
                // const d1 = -vec3.dot(planeNormal1, x2);
                // planes.push(vec4.fromValues(
                //     planeNormal1[0],
                //     planeNormal1[1],
                //     planeNormal1[2],
                //     d1
                // ));

                // const planeNormal2 = vec3.scale(vec3.create(), planeNormal1, -1.0);
                // const d2 = -vec3.dot(planeNormal2, x2);
                // planes.push(vec4.fromValues(
                //     planeNormal2[0],
                //     planeNormal2[1],
                //     planeNormal2[2],
                //     d2
                // ));

                // planes.push(null);
                // planes.push(null);
            }
            //planes.push(null);

            for (let i = 0; i < this._points.length - 1; i++) {
                // const hasTexture = this._gradients[i] != null;

                writeRoundedConeToArrayBuffer(buffer, offset + i, {
                    from: this._points[i],
                    to: this._points[i + 1],
                    radius: this._radius,
                    leftPlane: planes[i * 2],
                    rightPlane: planes[i * 2 + 1],
                    color: this._colors[i],
                    color2: this._colors[i],
                    borderColor: vec4.fromValues(1.0, 1.0, 1.0, 1.0),
                    borderColor2: vec4.fromValues(1.0, 1.0, 1.0, 1.0),
                    borderRatio: this._borderRadius,
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
            writeRoundedConeToArrayBuffer(this.buffer, this._roundedConesPosition + i, { radius: this._radius });
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length) * LL_STRUCTURE_SIZE_BYTES });
        this._dirtyBVH = true;
    }

    public getColor(i: number): vec4 | Array<vec4> {
        return this._colors[i];
    }

    public get length(): number {
        return this._points.length - 1;
    }

    public resetColorBorder(color: vec4): void {
        if (!this.buffer) return;

        this._colors.fill(color);
        this._colors2.fill(color);

        this._borderColors.fill(color);
        this._borderColors2.fill(color);

        const colorsArrayBuffer = new Uint8Array([
            color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255,
            color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255,
            color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255,
            color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255
        ]);

        const u8view = this.buffer.u8view;

        for (let i = 0; i < this._points.length - 1; i++) {
            u8view.set(colorsArrayBuffer, (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES + 64);
        }
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
        this._colors[i] = color;

        if (!this.buffer) {
            return;
        }

        writeRoundedConeToArrayBuffer(this.buffer, this._roundedConesPosition + i, { color: this._colors[i] });

        this.buffer.setModifiedBytes({ start: (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + i + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setColors(colors: Array<vec4>): void {
        this._colors = colors;

        if (!this.buffer) {
            return;
        }

        const u8view = this.buffer.u8view;
        for (let i = 0; i < this._colors.length - 1; i++) {
            // const offset = (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES;
            // u8view.set([colors[i][0] * 255, colors[i][1] * 255, colors[i][2] * 255, colors[i][3] * 255], offset + 64);
            this.setColor(colors[i], i);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._colors.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public resetColor2(color: vec4): void {
        this._colors2.fill(color);

        this.setColors2(this._colors2);
    }

    public setColor2(color: vec4, i: number): void {
        this._colors2[i] = color;

        if (!this.buffer) {
            return;
        }

        writeRoundedConeToArrayBuffer(this.buffer, this._roundedConesPosition + i, { color2: this._colors2[i] });

        this.buffer.setModifiedBytes({ start: (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + i + 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setColors2(colors2: Array<vec4>): void {
        this._colors2 = colors2;

        if (!this.buffer) {
            return;
        }

        const u8view = this.buffer.u8view;
        for (let i = 0; i < this._colors.length - 1; i++) {
            // const color = this._colors2[i];
            // const offset = (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES;

            // u8view.set([color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255], offset + 68);
            this.setColor2(colors2[i], i);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._colors.length - 1) * LL_STRUCTURE_SIZE_BYTES });
    }

    public resetBorderColors(color: vec4): void {
        if (!this.buffer) return;

        this._borderColors.fill(color);
        this._borderColors2.fill(color);

        const colorsArrayBuffer = new Uint8Array([
            color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255,
            color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255,
        ]);

        const u8view = this.buffer.u8view;

        for (let i = 0; i < this._points.length - 1; i++) {
            u8view.set(colorsArrayBuffer, (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES + 72);
        }
    }

    public setBorderColors(borderColors: Array<vec4>): void {
        this._borderColors = borderColors;

        if (!this.buffer) {
            return;
        }

        const u8view = this.buffer.u8view;
        for (let i = 0; i < this._points.length - 1; i++) {
            const color = this._borderColors[i];
            const offset = (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES;

            u8view.set([color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255], offset + 72);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public setBorderColors2(borderColors2: Array<vec4>): void {
        this._borderColors2 = borderColors2;

        if (!this.buffer) {
            return;
        }

        const u8view = this.buffer.u8view;
        for (let i = 0; i < this._points.length - 1; i++) {
            const color = this._borderColors2[i];
            const offset = (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES;

            u8view.set([color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255], offset + 76);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length) * LL_STRUCTURE_SIZE_BYTES });
    }

    public resetBorderColors2(color: vec4): void {
        this._borderColors2.fill(color);

        this.setBorderColors2(this._borderColors2);
    }

    public setColorsCombined(colors: Array<vec4>): void {
        if (!this.buffer) {
            return;
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

    public setBorderColorsCombined(colors: Array<vec4>): void {
        if (!this.buffer) {
            return;
        }

        const u8view = this.buffer.u8view;
        for (let i = 0; i < this._points.length - 1; i++) {
            const color = colors[2 * i];
            const color2 = colors[2 * i + 1];

            const offsetBytes = (this._roundedConesPosition + i) * LL_STRUCTURE_SIZE_BYTES;

            this._borderColors[i] = color;
            this._borderColors2[i] = color2;

            u8view.set([color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255, color2[0] * 255, color2[1] * 255, color2[2] * 255, color2[3] * 255], offsetBytes + 72);
        }

        this.buffer.setModifiedBytes({ start: this._roundedConesPosition * LL_STRUCTURE_SIZE_BYTES, end: (this._roundedConesPosition + this._points.length + 1) * LL_STRUCTURE_SIZE_BYTES });
    }
}