import { LL_STRUCTURE_SIZE_BYTES, LowLevelStructure, HighLevelStructure, ContinuousTube, Spheres, Sphere } from "./primitives/index";
import { LinearImmutableArray } from "./allocators/index"
import { Camera } from "./cameras/index";
import { GraphicsLibrary } from ".";
import { BoundingVolumeHierarchy } from "./bvh";
import { BoundingBox } from "./shared";
import { vec3, vec4 } from "gl-matrix";
import { NODE_SIZE_BYTES, BOUNDING_BOX_SIZE_BYTES } from "./bvh";
import { Spline } from "./primitives/spline";

function enumValues<T extends string>(enumObj: { [key: string]: T }): IterableIterator<T>;
function enumValues<T extends string | number>(enumObj: { [key: string]: T }): IterableIterator<Exclude<T, string>>;
function* enumValues<T>(enumObj: { [key: string]: T }): IterableIterator<T> {
    let isStringEnum = true;
    for (const property in enumObj) {
        if (typeof enumObj[property] === 'number') {
            isStringEnum = false;
            break;
        }
    }
    for (const property in enumObj) {
        if (isStringEnum || typeof enumObj[property] === 'number') {
            yield enumObj[property];
        }
    }
}

const objectTypes = Array.from(enumValues(LowLevelStructure));

export enum RenderObjects {
    Transparent,
    Opaque,
}

export class Scene {
    private graphicsLibrary: GraphicsLibrary;

    private lastStructureID = 0;
    private structures: Array<HighLevelStructure> = [];
    private nameToStructure: Map<string, number> = new Map();

    private objectTypesCount: Array<number> = new Array(128);
    private _objectsSum = 0;

    private _buffer: LinearImmutableArray;
    private bufferBindGroup: GPUBindGroup;

    private defragmentNeeded = false;

    //#region Ray-tracing
    private _useBVH = true;
    private _bvh: BoundingVolumeHierarchy | null = null;
    private _globalBBox: BoundingBox | null = null;

    private _bboxesBuffer: LinearImmutableArray | null = null;
    private _nodesBuffer: LinearImmutableArray | null = null;

    private _bvhBindGroup: GPUBindGroup | null = null;
    //#endregion

    private bvhWorker: Worker | null = null;

    constructor(graphicsLibrary: GraphicsLibrary, useBVH = true) {
        this.graphicsLibrary = graphicsLibrary;
        this._buffer = this.graphicsLibrary.allocator.allocateArray(1);
        this.bufferBindGroup = this.graphicsLibrary.device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.primitives,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this._buffer.gpuBuffer,
                        offset: this._buffer.data.byteOffset,
                        size: this._buffer.data.byteLength,
                    }
                }
            ]
        });

        this._useBVH = useBVH;

        if (this._useBVH) {
            this._bboxesBuffer = this.graphicsLibrary.allocator.allocateArray(1);
            this._nodesBuffer = this.graphicsLibrary.allocator.allocateArray(1);

            this._bvhBindGroup = this.graphicsLibrary.device.createBindGroup({
                layout: this.graphicsLibrary.bindGroupLayouts.boundingVolumeHierarchy,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this._nodesBuffer.gpuBuffer,
                            offset: this._nodesBuffer.data.byteOffset,
                            size: this._nodesBuffer.data.byteLength,
                        }
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this._bboxesBuffer.gpuBuffer,
                            offset: this._bboxesBuffer.data.byteOffset,
                            size: this._bboxesBuffer.data.byteLength,
                        }
                    }
                ]
            });
        }
    }

    public deallocate(): void {
        const allocator = this.graphicsLibrary.allocator;

        allocator.deallocateArray(this._buffer);
        allocator.deallocateArray(this._bboxesBuffer);
        allocator.deallocateArray(this._nodesBuffer);

        this.lastStructureID = 0;
        this.structures = [];
        this.nameToStructure.clear();
        this._objectsSum = 0;

        this._bvh = null;
        this._globalBBox = null;
        this._bboxesBuffer = null;
        this._nodesBuffer = null;
    }

    public buildLowLevelStructure(): void {
        const device = this.graphicsLibrary.device;
        const allocator = this.graphicsLibrary.allocator;
        const bindGroupLayouts = this.graphicsLibrary.bindGroupLayouts;

        // Count the number of each object type
        this.objectTypesCount.fill(0);
        for (const structure of this.structures) {
            if (structure == null) {
                continue;
            }

            let i = 0;
            for (const objectType of objectTypes) {
                this.objectTypesCount[i++] += structure.countOf(objectType);
            }
        }

        // Count how many objects are in total (need allocation)
        this._objectsSum = this.objectTypesCount.reduce((a, b) => a + b, 0);

        // If the current buffer is too small, create a new one
        if (this.objectsSizeBytes >= this._buffer.sizeBytes) {
            allocator.deallocateArray(this._buffer);
            this._buffer = allocator.allocateArray(Math.ceil(this.objectsSizeBytes / allocator.slabSize));

            this.bufferBindGroup = device.createBindGroup({
                layout: bindGroupLayouts.primitives,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this._buffer.gpuBuffer,
                            offset: this._buffer.data.byteOffset,
                            size: this._buffer.data.byteLength,
                        }
                    }
                ]
            });
        }

        // Write every low level structure of each high level structure to the buffer
        let offset = 0;
        for (const objectType of objectTypes) {
            if (this.objectTypesCount[objectType] == 0) {
                continue;
            }

            for (const structure of this.structures) {
                if (structure == null) {
                    continue;
                }

                if (structure.countOf(objectType) == 0) {
                    continue;
                }

                offset += structure.writeToArrayBuffer(this._buffer, offset, objectType);
            }
        }

        // Set the written parts of array as modified so that they are sent to GPU
        this._buffer.setModifiedBytes({ start: 0, end: this.objectsSizeBytes });

        if (this._useBVH) {
            this.buildBVH();
        }
    }

    public buildBVH(): void {
        // console.time('scene::buildBVH');

        if (this.bvhWorker != null) {
            this.bvhWorker.terminate();
        }

        // Check if there is a need to rebuild BVH
        let needsRebuild = false;
        for (const structure of this.structures) {
            if (structure.partOfBVH() && structure.dirtyBVH()) {
                needsRebuild = true;

                structure.setCleanBVH();
            }
        }

        if (!needsRebuild) {
            // console.timeEnd('scene::buildBVH');
            return;
        }

        const allocator = this.graphicsLibrary.allocator;

        // console.time('scene::buildBVH::bboxes');
        const copyOfObjectsBuffer = this._buffer.cpuBuffer().slice(this._buffer.data.byteOffset, this._buffer.data.byteOffset + this._buffer.data.byteLength);
        // console.timeEnd('scene::buildBVH::bboxes');

        this.bvhWorker = new Worker(new URL('./bvh/binned_sah_builder.worker.ts', import.meta.url));
        this.bvhWorker.onmessage = ({ data: { result } }) => {
            // console.time('scene::buildBVH::Finish');
            if (result == null) {
                this._bvh = null;

                allocator.deallocateArray(this._nodesBuffer);
                allocator.deallocateArray(this._bboxesBuffer);

                this._nodesBuffer = null;
                this._bboxesBuffer = null;
                this._bvhBindGroup = null;

                return;
            }

            this._bvh = new BoundingVolumeHierarchy();
            this._bvh.primitives = this._buffer.data;
            this._bvh.bboxes = result.bboxes;
            this._bvh.nodes = result.nodes;
            this._bvh.nodeCount = result.nodeCount;

            const nodesSizeBytes = this._bvh.nodeCount * NODE_SIZE_BYTES;
            const bboxesSizeBytes = this._bvh.bboxes.length * BOUNDING_BOX_SIZE_BYTES;

            if (this._nodesBuffer == null || (this._nodesBuffer != null && this._nodesBuffer.sizeBytes <= nodesSizeBytes)) {
                allocator.deallocateArray(this._nodesBuffer);
                this._nodesBuffer = allocator.allocateArray(Math.ceil(nodesSizeBytes / allocator.slabSize));
            }
            if (this._bboxesBuffer == null || (this._nodesBuffer != null && this._bboxesBuffer.sizeBytes <= bboxesSizeBytes)) {
                allocator.deallocateArray(this._bboxesBuffer);
                this._bboxesBuffer = allocator.allocateArray(Math.ceil(bboxesSizeBytes / allocator.slabSize));
            }

            this._bvh.toGPUArrays(this._nodesBuffer, this._bboxesBuffer);

            this._bvhBindGroup = this.graphicsLibrary.device.createBindGroup({
                layout: this.graphicsLibrary.bindGroupLayouts.boundingVolumeHierarchy,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this._nodesBuffer.gpuBuffer,
                            offset: this._nodesBuffer.data.byteOffset,
                            size: this._nodesBuffer.data.byteLength,
                        }
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this._bboxesBuffer.gpuBuffer,
                            offset: this._bboxesBuffer.data.byteOffset,
                            size: this._bboxesBuffer.data.byteLength,
                        }
                    }
                ]
            });

            // console.timeEnd('scene::buildBVH::Finish');
        };
        this.bvhWorker.postMessage({ objectsBuffer: copyOfObjectsBuffer });
        // console.timeEnd('scene::buildBVH');
    }

    public addSphere(structureName: string, point: vec3, radius: number | null = null, color: vec4 | null = null, partOfBVH = true, update = true): [number, Sphere] {
        this.removeStructureByName(structureName);

        this.lastStructureID += 1;

        const sphere = new Sphere(this.graphicsLibrary, this.lastStructureID, partOfBVH, point, radius ?? 1.0, color);
        const sphereIndex = this.addStructure(structureName, sphere, update);

        return [sphereIndex, sphere];
    }

    public addSpheres(structureName: string, points: Array<vec3>, radius: number | null = null, colors: Array<vec4> | null = null, partOfBVH = true, update = true): [number, Spheres] {
        this.removeStructureByName(structureName);

        this.lastStructureID += 1;

        const spheres = new Spheres(this.graphicsLibrary, this.lastStructureID, partOfBVH, points, colors);
        const spheresIndex = this.addStructure(structureName, spheres, update);

        return [spheresIndex, spheres];
    }

    public addContinuousTube(structureName: string, points: Array<vec3>, radius: number | null = null, colors: Array<vec4> | null = null, partOfBVH = true, update = true): [number, ContinuousTube] {
        this.removeStructureByName(structureName);

        this.lastStructureID += 1;

        const continuousTube = new ContinuousTube(this.graphicsLibrary, this.lastStructureID, partOfBVH, points, radius ?? 1.0, colors);
        const continuousTubeIndex = this.addStructure(structureName, continuousTube, update);

        return [continuousTubeIndex, continuousTube];
    }

    public addSpline(structureName: string, points: Array<vec3>, radius: number | null = null, colors: Array<vec4> | null = null, partOfBVH = true, update = true): [number, Spline] {
        this.removeStructureByName(structureName);

        this.lastStructureID += 1;

        // const continuousTube = new ContinuousTube(this.graphicsLibrary, this.lastStructureID, false, points, radius ?? 1.0, colors);
        const spline = new Spline(this.graphicsLibrary, this.lastStructureID, partOfBVH, points, radius ?? 1.0);
        const splineIndex = this.addStructure(structureName, spline, update);

        return [splineIndex, spline];
    }

    private addStructure(structureName: string, structure: HighLevelStructure, update = true): number {
        const device = this.graphicsLibrary.device;
        const allocator = this.graphicsLibrary.allocator;
        const bindGroupLayouts = this.graphicsLibrary.bindGroupLayouts;

        const structureID = structure.getID();

        this.structures.push(structure);
        this.nameToStructure.set(structureName, structureID);

        if (!update) {
            return structureID;
        }

        const newObjectsSum = this._objectsSum + structure.countOf(null);
        const newObjectsSizeBytes = newObjectsSum * LL_STRUCTURE_SIZE_BYTES;

        if (newObjectsSizeBytes >= this._buffer.sizeBytes) {
            allocator.deallocateArray(this._buffer);
            this._buffer = allocator.allocateArray(Math.ceil(newObjectsSizeBytes / allocator.slabSize));
            this.buildLowLevelStructure();

            this.bufferBindGroup = device.createBindGroup({
                layout: bindGroupLayouts.primitives,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this._buffer.gpuBuffer,
                            offset: this._buffer.data.byteOffset,
                            size: this._buffer.data.byteLength,
                        }
                    }
                ]
            });

            this._objectsSum = structure.countOf(null);
        } else {
            let i = 0;
            for (const objectType of objectTypes) {
                this.objectTypesCount[i++] += structure.countOf(objectType);
                this._objectsSum += structure.writeToArrayBuffer(this._buffer, this._objectsSum, objectType);
            }
        }

        if (this._useBVH) {
            structure.setDirtyBVH();
            this.buildBVH();
        }

        return structureID;
    }

    public removeStructureByID(structureID: number, update = true): void {
        const structureIndex = this.structures.findIndex(s => s.getID() == structureID);

        if (structureIndex < 0) {
            return;
        }

        this.structures[structureIndex].removeFromArrayBuffer();
        this.structures.splice(structureIndex, 1);

        if (update && this._useBVH) {
            this.buildBVH();
        }
    }

    public removeStructureByName(structureName: string, update = true): void {
        const structureID = this.nameToStructure.get(structureName);

        if (structureID == undefined) {
            return;
        }

        const structureIndex = this.structures.findIndex(s => s.getID() == structureID);

        if (structureIndex < 0) {
            return;
        }

        const partOfBVH = this.structures[structureIndex].partOfBVH();

        this.structures[structureIndex].removeFromArrayBuffer();

        this.structures.splice(structureIndex, 1);
        this.nameToStructure.delete(structureName);

        if (partOfBVH && update && this._useBVH) {
            this.buildBVH();
        }
    }

    public uploadModified(queue: GPUQueue): void {
        if (this.defragmentNeeded) {
            this.buildLowLevelStructure();
            this.defragmentNeeded = false;
        }

        this._buffer.uploadModified(queue);
        this._bboxesBuffer?.uploadModified(queue);
        this._nodesBuffer?.uploadModified(queue);
    }

    public renderRasterization(passEncoder: GPURenderPassEncoder, camera: Camera, renderObjects: RenderObjects = RenderObjects.Opaque, depth: GPUTextureView | null = null): void {
        // console.time('scene::renderRasterization recording draw buffers');

        const device = this.graphicsLibrary.device;
        const renderPipelines = this.graphicsLibrary.renderPipelines;

        let gBufferWorldPositions = null;
        if (depth) {
            gBufferWorldPositions = device.createBindGroup({
                layout: this.graphicsLibrary.bindGroupLayouts.gBufferWorldPositionsBindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: depth
                }]
            });
        }

        passEncoder.setBindGroup(1, this.bufferBindGroup);
        for (let typeIndex = 0; typeIndex < 5; typeIndex++) {
            if (renderObjects == RenderObjects.Opaque) {
                switch (typeIndex) {
                    case 0: passEncoder.setPipeline(renderPipelines.spheresWriteDepth); break;
                    case 2: passEncoder.setPipeline(renderPipelines.quadraticBeziersWriteDepth); break;
                    case 4: passEncoder.setPipeline(renderPipelines.roundedConesWriteDepth); break;
                    default: continue;
                }
            } else {
                switch (typeIndex) {
                    case 0: passEncoder.setPipeline(renderPipelines.spheresDiscardDepth); break;
                    case 4: passEncoder.setPipeline(renderPipelines.roundedConesDiscardDepth); break;
                    default: continue;
                }

                if (depth && gBufferWorldPositions) {
                    passEncoder.setBindGroup(3, gBufferWorldPositions);
                }                
            }

            for (const structure of this.structures) {
                if ((structure.opaque && renderObjects == RenderObjects.Transparent) || (!structure.opaque && renderObjects == RenderObjects.Opaque)) {
                    continue;
                }

                if (structure.countOf(typeIndex) > 0) {
                    const count = structure.countOf(typeIndex);
                    const offset = structure.offsetOf(typeIndex);

                    if (count != null && count > 0 && offset != null) {
                        passEncoder.draw(4, count, 0, offset);
                    }
                }
            }
        }

        // console.timeEnd('scene::renderRasterization recording draw buffers');
    }

    public renderRayTracingGBuffer(parameters: {
        width: number,
        height: number,
        cameraBindGroup: GPUBindGroup,
        outputBindGroup: GPUBindGroup,
        passEncoder: GPUComputePassEncoder,
    }): void {
        if (!this._bvhBindGroup) {
            return;
        }

        parameters.passEncoder.setPipeline(this.graphicsLibrary.computePipelines.rayTracingGBuffer);
        parameters.passEncoder.setBindGroup(0, parameters.cameraBindGroup);
        parameters.passEncoder.setBindGroup(1, this.bufferBindGroup);
        parameters.passEncoder.setBindGroup(2, this._bvhBindGroup);
        parameters.passEncoder.setBindGroup(3, parameters.outputBindGroup);

        parameters.passEncoder.dispatchWorkgroups(
            Math.ceil((parameters.width + 15) / 16),
            Math.ceil((parameters.height + 15) / 16),
            1);
    }

    public renderRayTracingAmbientOcclusion(parameters: {
        width: number,
        height: number,
        cameraBindGroup: GPUBindGroup,
        gBufferBindGroup: GPUBindGroup,
        passEncoder: GPUComputePassEncoder,
    }): void {
        if (!this._bvhBindGroup) {
            return;
        }


        parameters.passEncoder.setPipeline(this.graphicsLibrary.computePipelines.rayTracingAmbientOcclusion);
        parameters.passEncoder.setBindGroup(0, parameters.cameraBindGroup);
        parameters.passEncoder.setBindGroup(1, this.bufferBindGroup);
        parameters.passEncoder.setBindGroup(2, this._bvhBindGroup);
        parameters.passEncoder.setBindGroup(3, parameters.gBufferBindGroup);

        parameters.passEncoder.dispatchWorkgroups(
            Math.ceil((parameters.width + 15) / 16),
            Math.ceil((parameters.height + 15) / 16),
            1);
    }

    public renderScreenSpaceAmbientOcclusion(parameters: {
        width: number,
        height: number,
        cameraBindGroup: GPUBindGroup,
        gBufferBindGroup: GPUBindGroup,
        ssaoBindGroup: GPUBindGroup,
        passEncoder: GPUComputePassEncoder,
    }): void {

        parameters.passEncoder.setPipeline(this.graphicsLibrary.computePipelines.screenSpaceAmbientOcclusion);
        parameters.passEncoder.setBindGroup(0, parameters.cameraBindGroup);
        parameters.passEncoder.setBindGroup(1, parameters.gBufferBindGroup);
        parameters.passEncoder.setBindGroup(2, parameters.ssaoBindGroup);

        parameters.passEncoder.dispatchWorkgroups(
            Math.ceil((parameters.width + 7) / 8),
            Math.ceil((parameters.height + 7) / 8),
            1);
    }

    public get objectsSum(): number {
        return this._objectsSum;
    }

    public get objectsSizeBytes(): number {
        return this.objectsSum * LL_STRUCTURE_SIZE_BYTES;
    }

    public set useBVH(useBVH: boolean) {
        this._useBVH = useBVH;
    }

    public get bvh(): BoundingVolumeHierarchy | null {
        return this._bvh;
    }

    public get globalBBox(): BoundingBox | null {
        return this._globalBBox;
    }

    public get buffer(): LinearImmutableArray {
        return this._buffer;
    }

    public getStructureByName(structureName: string): HighLevelStructure | null {
        const structureID = this.nameToStructure.get(structureName);

        if (!structureID) {
            return null;
        }

        const structureIndex = this.structures.findIndex(s => s.getID() == structureID);

        if (structureIndex < 0) {
            return null;
        }

        return this.structures[structureIndex];
    }

    public getStructureByID(structureID: number): HighLevelStructure | null {
        const structureIndex = this.structures.findIndex(s => s.getID() == structureID);

        if (structureIndex < 0) {
            return null;
        }

        return this.structures[structureIndex];
    }
}