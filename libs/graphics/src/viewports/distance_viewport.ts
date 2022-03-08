import { CameraConfigurationType, Ortho2DCamera, OrthoCameraConfiguration } from "../cameras/index";
import { vec2, vec4 } from "gl-matrix";
import { GraphicsLibrary } from "..";

const squareRadius = 0.7071;
const squareDiameter = 2.0 * squareRadius;

export class BinPosition {
    from = 0;
    to = 0;
}

export function worldPositionToBins(position: vec4, lod = 0): BinPosition {
    // Line Slope Form
    // y = m*x + b
    // m = 1
    // b = y - x;
    const b1 = position[1] - position[0];
    // y = 0 => 0 = x + b => x = -b
    const interceptX1 = -b1;

    const squareDiameterLoD = Math.pow(2.0, lod) * squareDiameter;

    const leftX = position[0] - position[1];
    const rightX = position[0] + position[1];

    const from = Math.floor(interceptX1 / squareDiameterLoD);
    const to = Math.floor(rightX / squareDiameterLoD);

    return {
        from: from,
        to: to
    };
}

export function binsToCenter(binPosition: BinPosition, lod = 0): vec2 {
    const squareRadiusLoD = Math.pow(2.0, lod) * squareRadius;
    const squareDiameterLoD = Math.pow(2.0, lod) * squareDiameter;

    const diff = binPosition.to - binPosition.from;

    const start = vec2.fromValues(binPosition.from * squareDiameterLoD + squareRadiusLoD, 0);
    const stepVector = vec2.scale(vec2.create(), vec2.normalize(vec2.create(), vec2.fromValues(1.0, 1.0)), Math.pow(2.0, lod) * diff);

    return vec2.add(vec2.create(), start, stepVector);
}

export function binsToCenterVec4(binPosition: BinPosition, lod = 0): vec4 {
    const bin = binsToCenter(binPosition, lod);

    return vec4.fromValues(bin[0], bin[1], 0.0, 1.0);
}

export function binToInstanceIndex(binPosition: BinPosition, size: number): number {
    const invert = (size - 1) - binPosition.from;
    const gaussSum = ((invert) * (invert + 1)) / 2.0;

    const diff = binPosition.to - binPosition.from;

    return gaussSum + diff;
}

class Globals {
    sizes = new Array(32).fill(0);
    offsets = new Array(32).fill(0);
    maxDistances = new Array(32).fill(0);
    currentLoD = 0;

    toArrayBuffer(): ArrayBuffer {
        const buffer = new ArrayBuffer(512);

        const i32View = new Int32Array(buffer);
        const u32View = new Uint32Array(buffer);
        const f32View = new Float32Array(buffer);

        u32View.set(this.sizes, 0);
        u32View.set(this.offsets, 32);
        f32View.set(this.maxDistances, 64);
        u32View.set([this.currentLoD], 96);

        return buffer;
    }
}

export class DistanceViewport {
    protected graphicsLibrary: GraphicsLibrary;

    protected _canvas: HTMLCanvasElement | null = null;
    protected _context: GPUCanvasContext | null = null;

    private width = 0;
    private height = 0;

    private _camera: Ortho2DCamera;

    private globals: Globals;
    private globalsGPU: GPUBuffer;

    private positions: GPUBuffer | null = null;
    private colors: GPUBuffer | null = null;

    constructor(
        graphicsLibrary: GraphicsLibrary,
        canvas: HTMLCanvasElement | null,
        positions: Array<vec4> | null = null,
        colors: Array<vec4> | null = null,
        colorIndices: Uint16Array | Uint8Array | null = null,
    ) {
        this.graphicsLibrary = graphicsLibrary;
        this._canvas = canvas;

        if (this._canvas != null) {
            this._context = this._canvas.getContext("webgpu");

            const parent = this._canvas.parentElement;
            const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
                const entry = entries.find((entry: ResizeObserverEntry) => entry.target === parent);

                if (entry instanceof ResizeObserverEntry && entry.devicePixelContentBoxSize) {
                    this.resize(
                        entry.devicePixelContentBoxSize[0].inlineSize,
                        entry.devicePixelContentBoxSize[0].blockSize);
                }
            });

            if (parent) {
                observer.observe(parent, { box: 'device-pixel-content-box' });
            }
        }

        this._camera = new Ortho2DCamera(
            this.graphicsLibrary.device,
            0,
            0
        );

        this.globals = new Globals();
        this.globalsGPU = this.graphicsLibrary.device.createBuffer({
            size: 512,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        if (positions != null) {
            this.setPositions(positions);
        }

        if (colors != null && colorIndices != null) {
            this.setColors(colors, colorIndices);
        }
    }

    resize(width: number, height: number): void {
        if (!this._context || !this._canvas) {
            return;
        }

        const devicePixelRatio = window.devicePixelRatio || 1.0;

        this._canvas.setAttribute("style", "width:" + (width / devicePixelRatio) + "px; height:" + (height / devicePixelRatio) + "px");

        this.width = width;
        this.height = height;

        this._canvas.width = width;
        this._canvas.height = height;

        const size = {
            width: this.width,
            height: this.height,
        };

        if (width <= 0 || height <= 0) {
            return;
        }

        this._context.configure({
            device: this.graphicsLibrary.device,
            format: 'bgra8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            compositingAlphaMode: "opaque",
            size,
        });

        this._camera.width = width;
        this._camera.height = height;

        this.recalculateLoD();
    }

    async render(): Promise<void> {
        const device = this.graphicsLibrary.device;
        const renderPipelines = this.graphicsLibrary.renderPipelines;
        const bindGroupLayouts = this.graphicsLibrary.bindGroupLayouts;

        if (this._canvas == null || this._context == null || this._camera == null || this.width <= 0 || this.height <= 0 || this.globals.sizes[0] <= 0 || this.positions == null || this.colors == null) {
            return;
        }

        const commandEncoder = device.createCommandEncoder();
        const textureView = this._context.getCurrentTexture().createView();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        this._camera.updateGPU(device.queue);

        const globalsBuffer = this.globals.toArrayBuffer();
        device.queue.writeBuffer(
            this.globalsGPU, 0,
            globalsBuffer, 0,
            globalsBuffer.byteLength,
        );

        const primitivesBindGroup =
            device.createBindGroup({
                layout: bindGroupLayouts.distanceMap,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this._camera.bufferGPU,
                            offset: 0,
                        }
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.globalsGPU,
                            offset: 0,
                        }
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: this.positions,
                            offset: 0,
                        }
                    },
                    {
                        binding: 3,
                        resource: {
                            buffer: this.colors,
                            offset: 0,
                        }
                    }
                ]
            });

        passEncoder.setBindGroup(0, primitivesBindGroup);
        passEncoder.setPipeline(renderPipelines.distanceMap);

        for (const line of this.getVisibleLines()) {
            const start = line[0];
            const end = line[1];

            const size = (end.to - start.to) + 1;
            const diff = start.to - start.from;

            passEncoder.draw(6 * size, 1, 6 * diff, start.from);
        }

        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
    }

    ///
    /// Setters & Getters
    ///
    public getHoveredElement(mousePosition: vec2, lod: number | null = null): BinPosition | null {
        if (this._camera == null || this.globals.sizes[0] == 0) {
            return null;
        }

        // 1. Transform canvas screen space to world space
        const screenSpace = vec4.fromValues(mousePosition[0], mousePosition[1], 0.0, 1.0);
        const normalizedSpace = vec4.clone(screenSpace);
        normalizedSpace[0] = (normalizedSpace[0] / this.width) * 2.0 - 1.0;
        normalizedSpace[1] = (1.0 - (normalizedSpace[1] / this.height)) * 2.0 - 1.0;

        const worldSpace = vec4.create();
        vec4.transformMat4(worldSpace, normalizedSpace, this._camera.viewProjectionInverseMatrix);

        if (worldSpace[1] < 0.0 || worldSpace[1] < 0.0) {
            return null;
        }

        // Find line intersection with X axis for left/right values in worldspace
        const leftX = worldSpace[0] - worldSpace[1];
        const rightX = worldSpace[0] + worldSpace[1];

        const size = this.globals.sizes[lod ? lod : 0];
        const squareDiameterWithLoD = squareDiameter * Math.pow(2, lod ? lod : 0);

        const leftIndex = Math.floor(leftX / squareDiameterWithLoD);
        const rightIndex = Math.floor(rightX / squareDiameterWithLoD);

        if (leftIndex < 0 || leftIndex >= size || rightIndex < 0 || rightIndex >= size) {
            return null;
        }

        return {
            from: leftIndex,
            to: rightIndex,
        };
    }

    public getVisibleRectangle(ndcCorners: Array<vec4> | null = null): Array<vec4> {
        if (ndcCorners == null) {
            ndcCorners = [
                vec4.fromValues(-1.0, 1.0, 0.0, 1.0),
                vec4.fromValues(1.0, 1.0, 0.0, 1.0),
                vec4.fromValues(1.0, -1.0, 0.0, 1.0),
                vec4.fromValues(-1.0, -1.0, 0.0, 1.0),
            ];
        }

        const worldSpaceCorners = new Array(4);
        for (let i = 0; i < 4; i++) {
            worldSpaceCorners[i] = vec4.create();
            vec4.transformMat4(worldSpaceCorners[i], ndcCorners[i], this._camera.viewProjectionInverseMatrix);
            vec4.scale(worldSpaceCorners[i], worldSpaceCorners[i], 1.0 / worldSpaceCorners[i][3]);
        }

        return worldSpaceCorners;
    }

    public getVisibleRectangleBins(ndcCorners: Array<vec4> | null = null): Array<BinPosition> {
        const visibleRectangle = this.getVisibleRectangle(ndcCorners);

        const bins: Array<BinPosition> = new Array(4);
        for (let i = 0; i < 4; i++) {
            bins[i] = worldPositionToBins(visibleRectangle[i], this.globals.currentLoD);
        }
        bins[0].from -= 1;
        bins[1].to += 1;
        bins[2].from += 1;
        bins[3].to -= 1;

        return bins;
    }

    public getVisibleLines(ndcCorners: Array<vec4> | null = null): Array<[BinPosition, BinPosition]> {
        const visibleLines: Array<[BinPosition, BinPosition]> = [];

        const currentLoD = this.globals.currentLoD;
        const size = this.globals.sizes[currentLoD];

        const visibleRectangleBins = this.getVisibleRectangleBins(ndcCorners);

        const leftRange = [
            visibleRectangleBins[0].from,
            visibleRectangleBins[2].from
        ];

        leftRange[0] = Math.max(leftRange[0], 0);
        leftRange[1] = Math.min(leftRange[1], size - 1);

        const rightRange = [
            visibleRectangleBins[3].to,
            visibleRectangleBins[1].to
        ];

        rightRange[0] = Math.max(rightRange[0], 0);
        rightRange[1] = Math.min(rightRange[1], size - 1);

        for (let left = leftRange[0]; left <= leftRange[1]; left++) {
            const finalFromRange: { from: number, to: number } = { from: left, to: rightRange[0] };
            const finalToRange: { from: number, to: number } = { from: left, to: rightRange[1] };

            // finalFromRange.to = Math.min(finalFromRange.from, finalFromRange.to);
            if (finalFromRange.from > finalFromRange.to) {
                finalFromRange.to = finalFromRange.from;
            }

            if (finalToRange.to < finalFromRange.to) {
                continue;
            }

            visibleLines.push([finalFromRange, finalToRange]);
        }

        return visibleLines;
    }

    public recalculateLoD(): void {
        let bins = this.globals.sizes[0];
        let lod = 0;
        while (bins > 0) {
            if (!this.globals.sizes[lod]) {
                lod -= 1;
                break;
            }

            const squareDiameterWithLoD = squareDiameter * Math.pow(2, lod);

            const leftPosition = vec4.fromValues(0.0, 0.0, 0.0, 1.0);
            const rightPosition = vec4.fromValues(squareDiameterWithLoD, 0.0, 0.0, 1.0);

            vec4.transformMat4(leftPosition, leftPosition, this._camera.viewProjectionMatrix);
            vec4.transformMat4(rightPosition, rightPosition, this._camera.viewProjectionMatrix);

            leftPosition[0] = (leftPosition[0] / leftPosition[3]) * 0.5 + 0.5;
            rightPosition[0] = (rightPosition[0] / rightPosition[3]) * 0.5 + 0.5;

            const screenSpaceDistance = this.width * Math.abs(rightPosition[0] - leftPosition[0]);

            // We need at least 8 pixels
            if (screenSpaceDistance >= 8) {
                break;
            }

            lod += 1;
            bins /= 2;
        }

        this.globals.currentLoD = lod;
    }

    public setPositions(positions: Array<vec4>): void {
        console.time('distanceMap::setPositions');
        const device = this.graphicsLibrary.device;

        const newPositions = [...positions];

        // LoD 0
        let currentLoD = 0;
        this.globals.sizes[0] = positions.length;
        this.globals.offsets[0] = 0;

        // Calculate maximum distance
        let topMaximumDistance = 0.0;
        for (let i = 0; i < this.globals.sizes[0]; i++) {
            for (let j = i + 1; j < this.globals.sizes[0]; j++) {
                const v1 = positions[i];
                const v2 = positions[j];

                const distance = vec4.squaredDistance(v1, v2);

                if (distance > topMaximumDistance) {
                    topMaximumDistance = distance;
                }
            }
        }

        this.globals.maxDistances[0] = Math.sqrt(topMaximumDistance);

        // LoD 1+
        let currentSize = this.globals.sizes[0];
        let evenStrategy = true;
        while (currentSize > 1) {
            currentLoD += 1;

            let newSize = 0;
            if (currentSize % 2 == 0) {
                newSize = Math.floor(currentSize / 2);
            } else {
                newSize = evenStrategy ? Math.floor(currentSize / 2) : Math.floor(currentSize / 2) + 1;
            }

            const currentOffset = this.globals.offsets[currentLoD - 1];

            const end = (currentSize % 2 == 0) ? newSize : newSize - 1;
            for (let i = 0; i < end; i++) {
                const newPosition = vec4.add(vec4.create(), newPositions[currentOffset + i * 2], newPositions[currentOffset + i * 2 + 1]);
                vec4.scale(newPosition, newPosition, 0.5);

                newPositions.push(newPosition);
            }

            if (currentSize % 2 !== 0) {
                const offset = this.globals.sizes[currentLoD - 1] + this.globals.offsets[currentLoD - 1] - 1;

                if (evenStrategy) {
                    const newPosition = vec4.add(vec4.create(), newPositions[offset - 2], newPositions[offset - 1]);
                    vec4.add(newPosition, newPosition, newPositions[offset]);
                    vec4.scale(newPosition, newPosition, 1.0 / 3.0);

                    newPositions.push(newPosition);
                } else {
                    newPositions.push(newPositions[offset]);
                }

                evenStrategy = !evenStrategy;
            }

            currentSize = newSize;
            this.globals.sizes[currentLoD] = currentSize;
            this.globals.offsets[currentLoD] = this.globals.offsets[currentLoD - 1] + this.globals.sizes[currentLoD - 1];

            let maximumDistance = 0.0;

            // console.time('distanceMap::setPositions::maxDistance');
            const subsetStart = this.globals.offsets[currentLoD];
            const subsetEnd = this.globals.offsets[currentLoD] + this.globals.sizes[currentLoD];
            for (let i = subsetStart; i < subsetEnd; i++) {
                for (let j = i + 1; j < subsetEnd; j++) {
                    const v1 = newPositions[i];
                    const v2 = newPositions[j];

                    const distance = vec4.squaredDistance(v1, v2);

                    if (distance > maximumDistance) {
                        maximumDistance = distance;
                    }
                }
            }
            // console.timeEnd('distanceMap::setPositions::maxDistance');

            this.globals.maxDistances[currentLoD] = Math.sqrt(maximumDistance);
        }

        // Copy to GPU
        const bufferSizeF32 = 4 * newPositions.length;
        const bufferSizeBytes = 4 * bufferSizeF32;

        const positionsCPU = new Float32Array(bufferSizeF32);
        for (let i = 0; i < newPositions.length; i++) {
            positionsCPU.set(newPositions[i], i * 4);
        }

        this.positions = device.createBuffer({
            size: bufferSizeBytes,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(
            this.positions, 0,
            positionsCPU.buffer, 0,
            positionsCPU.buffer.byteLength,
        );

        const colorsCPU = new Float32Array(bufferSizeF32);
        const white = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
        for (let i = 0; i < newPositions.length; i++) {
            colorsCPU.set(white, i * 4);
        }

        this.colors = device.createBuffer({
            size: bufferSizeBytes,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(
            this.colors, 0,
            colorsCPU.buffer, 0,
            colorsCPU.buffer.byteLength,
        );


        console.timeEnd('distanceMap::setPositions');
    }

    public setColors(colors: Array<vec4>, colorIndices: Uint16Array | Uint8Array): void {
        // console.time("distanceViewport::setColors");
        const device = this.graphicsLibrary.device;

        const newLength = colorIndices.length * 2;
        let newColorIndices: Uint16Array | Uint8Array;
        if (colorIndices instanceof Uint16Array) {
            newColorIndices = new Uint16Array(newLength);
        } else {
            newColorIndices = new Uint8Array(newLength);
        }
        newColorIndices.set(colorIndices, 0);

        const bufferSizeF32 = 4 * newLength;
        const bufferSizeBytes = 4 * bufferSizeF32;

        let currentLoD = 0;
        let currentSize = this.globals.sizes[0];
        let evenStrategy = true;
        while (currentSize > 1) {
            currentLoD += 1;

            let newSize = 0;
            if (currentSize % 2 == 0) {
                newSize = Math.floor(currentSize / 2);
            } else {
                newSize = evenStrategy ? Math.floor(currentSize / 2) : Math.floor(currentSize / 2) + 1;
            }
            
            const previousOffset = this.globals.offsets[currentLoD - 1];
            const currentOffset = previousOffset + this.globals.sizes[currentLoD - 1];

            const end = (currentSize % 2 == 0) ? newSize : newSize - 1;
            for (let i = 0; i < end; i++) {
                const newColorIndex = Math.max(newColorIndices[previousOffset + i * 2], newColorIndices[previousOffset + i * 2 + 1]);

                newColorIndices[currentOffset + i] = newColorIndex;
            }

            if (currentSize % 2 !== 0) {
                if (evenStrategy) {
                    const newColorIndex = Math.max(Math.max(newColorIndices[currentOffset - 3], newColorIndices[currentOffset - 2]), newColorIndices[currentOffset - 1]);

                    newColorIndices[currentOffset + end] = newColorIndex;
                } else {
                    newColorIndices[currentOffset + end] = newColorIndices[currentOffset - 1];
                }

                evenStrategy = !evenStrategy;
            }

            currentSize = newSize;
        }

        const colorsCPU = new Float32Array(bufferSizeF32);
        for (let i = 0; i < newLength; i++) {
            colorsCPU.set(colors[newColorIndices[i]], i * 4);
        }

        this.colors = device.createBuffer({
            size: bufferSizeBytes,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(
            this.colors, 0,
            colorsCPU.buffer, 0,
            colorsCPU.buffer.byteLength,
        );
        // console.timeEnd("distanceViewport::setColors");
    }

    public worldSpaceToScreenSpace(worldSpace: vec4): vec2 {
        const result = vec4.create();

        vec4.transformMat4(result, worldSpace, this._camera.viewProjectionMatrix);
        vec4.scale(result, result, 1.0 / result[3]);
        vec4.scale(result, result, 0.5);
        
        result[0] = result[0] + 0.5;
        result[1] = 1.0 - (result[1] + 0.5);
        result[2] = result[2] + 0.5;

        return vec2.fromValues(
            result[0] * (this.width / window.devicePixelRatio), 
            result[1] * (this.height / window.devicePixelRatio)
        );
    }

    public get sizes(): Array<number> {
        return this.globals.sizes;
    }

    public get currentLoD(): number {
        return this.globals.currentLoD;
    }

    public get camera(): Ortho2DCamera {
        return this._camera;
    }

    public set cameraConfiguration(cameraConfiguration: OrthoCameraConfiguration) {
        if (this._camera) {
            this._camera.maxZoom = cameraConfiguration.maxZoom;
            this._camera.zoom = cameraConfiguration.zoom;
            this._camera.translateX = cameraConfiguration.translateX;
            this._camera.translateY = cameraConfiguration.translateY;

            this.recalculateLoD();
        }
    }

    public get cameraConfiguration(): OrthoCameraConfiguration {
        return this._camera?.cameraConfiguration ?? {
            type: CameraConfigurationType.Ortho,

            zoom: 1.0,
            maxZoom: 1.0,
            translateX: 0.0,
            translateY: 0.0
        }
    }

    public get canvas(): HTMLCanvasElement | null {
        return this._canvas;
    }
}
