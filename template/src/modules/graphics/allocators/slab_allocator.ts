const kiloByte = 1024;
const megaByte = 1024 * kiloByte;

export class ByteRange {
    public start = 0;
    public end = 0;
}

export interface ArrayViews {
    data: DataView;
    f32View: Float32Array;
    i32View: Int32Array;
    u32View: Uint32Array;    
}

export class LinearImmutableArray {
    private _allocator: SlabAllocator;
    private id: number;

    private _blockIdx: number;

    //#region Views
    private _data: DataView;
    private _u8view: Uint8Array;
    private _f32View: Float32Array;
    private _i32View: Int32Array;
    private _u32View: Uint32Array;    
    //#endregion

    private _globalOffsetSlabs: number;
    private _localOffsetSlabs: number;

    private _sizeSlabs: number;

    constructor(
        allocator: SlabAllocator,
        id: number,
        blockIdx: number,
        data: DataView,
        globalOffsetSlabs: number,
        localOffsetSlabs: number,
        sizeSlabs: number
    ) {
        this._allocator = allocator;
        this.id = id;

        this._blockIdx = blockIdx;
        
        this._data = data;        
        this._u8view = new Uint8Array(data.buffer, data.byteOffset);
        this._f32View = new Float32Array(data.buffer, data.byteOffset);
        this._i32View = new Int32Array(data.buffer, data.byteOffset);
        this._u32View = new Uint32Array(data.buffer, data.byteOffset);

        this._globalOffsetSlabs = globalOffsetSlabs;
        this._localOffsetSlabs = localOffsetSlabs;

        this._sizeSlabs = sizeSlabs;
    }

    public setModifiedBytes(ranges: ByteRange): void {
        const startSlab = Math.floor(ranges.start / this._allocator.slabSize);
        const endSlab = Math.ceil(ranges.end / this._allocator.slabSize);

        this.setModifiedSlabs(Array.from({ length: endSlab - startSlab + 1 }, (_, i) => i + startSlab));
    }

    public setModifiedSlabs(indices: Array<number>): void {
        const globalIndices = indices.map(idx => idx + this._localOffsetSlabs);
        this._allocator.setModified(globalIndices);
    }

    public removeSlabs(count: number): void {
        this._sizeSlabs -= count;
    }

    public uploadModified(queue: GPUQueue): void {        
        for (let i = this.globalOffsetSlabs, j = 0; i < this.globalOffsetSlabs + this.sizeSlabs; i++, j++) {
            if (this._allocator.modifiedSlabs[i]) {
                this._allocator.modifiedSlabs[i] = false;
                const offset = this.data.byteOffset + j * this._allocator.slabSize;
                
                queue.writeBuffer(this.gpuBuffer, offset, this.data.buffer, offset, this._allocator.slabSize);
            }
        }
    }

    public get allocator(): SlabAllocator {
        return this._allocator;
    }

    public get blockIdx(): number {
        return this._blockIdx;
    }

    public get globalOffsetSlabs(): number {
        return this._globalOffsetSlabs;
    }

    public get localOffsetSlabs(): number {
        return this._localOffsetSlabs;
    }

    public get sizeBytes(): number {
        return this._sizeSlabs * this._allocator.slabSize;
    }

    public get sizeSlabs(): number {
        return this._sizeSlabs;
    }

    public get data(): DataView {
        return this._data;
    }

    public cpuBuffer(): ArrayBuffer {
        return this._allocator.getCpuBlock(this._blockIdx);
    }

    public get gpuBuffer(): GPUBuffer {
        return this._allocator.getGpuBlock(this._blockIdx);
    }

    //#region ArrayViews Interface
    public get u8view(): Uint8Array {
        return this._u8view;
    }

    public get f32View(): Float32Array {
        return this._f32View;
    }

    public get i32View(): Int32Array {
        return this._i32View;
    }

    public get u32View(): Uint32Array {
        return this._u32View;
    }
    //#endregion
}

/**
 * 
 */
export class SlabAllocator {
    //#region Variables
    private _device: GPUDevice;

    //#region Information about memory layout
    private _blockSize: number;
    private _slabSize: number;
    private _slabsPerBlock: number;
    //#endregion

    //#region Memory blocks
    private _cpuBlocks: Array<ArrayBuffer> = [];
    private _gpuBlocks: Array<GPUBuffer> = [];
    //#endregion

    //#region Information about slabs
    private _allocatedSlabs: Array<boolean> = [];
    private _modifiedSlabs: Array<boolean> = [];
    //#endregion

    //#region Slab ownership info
    private owners = 0;
    private ownerSlabs: Array<number> = [];
    //#endregion
    //#endregion

    constructor(
        device: GPUDevice,
        blockSize: number = 128 * megaByte,
        slabSize: number = 1 * megaByte,
    ) {
        this._device = device;

        this._blockSize = blockSize;
        this._slabSize = slabSize;
        this._slabsPerBlock = this._blockSize / this._slabSize;

        this.createNewBlock();
    }

    /**
     * 
     */
    private createNewBlock() {
        this._cpuBlocks.push(new ArrayBuffer(this._blockSize));
        this._gpuBlocks.push(this._device.createBuffer({
            size: this._blockSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        }));
        this._allocatedSlabs.push(...new Array(this._slabsPerBlock).fill(false));
        this.ownerSlabs.push(...new Array(this._slabsPerBlock).fill(0));
        this._modifiedSlabs.push(...new Array(this._slabsPerBlock).fill(true));
    }

    public allocateArray(slabsCount: number): LinearImmutableArray {
        this.owners = this.owners + 1;

        let globalOffsetSlabs = 0;
        let localOffsetSlabs = 0;

        let blockIdx = 0;
        let found = 0;
        for (; blockIdx < this._cpuBlocks.length; blockIdx++) {
            localOffsetSlabs = 0;
            found = 0;
            for (let slabIdx = 0; slabIdx < this._slabsPerBlock; slabIdx++) {
                if (this._allocatedSlabs[globalOffsetSlabs + slabIdx] == false) {
                    found += 1;
                    if (found == slabsCount) {
                        break;
                    }
                } else {
                    localOffsetSlabs = slabIdx + 1;
                    found = 0;
                }
            }

            if (found == slabsCount) {
                break;
            }

            globalOffsetSlabs += this._slabsPerBlock;
        }

        if (found == slabsCount) {
            globalOffsetSlabs += localOffsetSlabs;
        } else {
            this.createNewBlock();
            blockIdx = this._modifiedSlabs.length - 1;
            localOffsetSlabs = 0;
            globalOffsetSlabs = blockIdx * this._slabsPerBlock;
        }

        const dataView = new DataView(this._cpuBlocks[blockIdx], localOffsetSlabs * this._slabSize, slabsCount * this._slabSize);

        for (let i = 0; i < slabsCount; i++) {
            this._allocatedSlabs[globalOffsetSlabs + i] = true;
            this._modifiedSlabs[globalOffsetSlabs + i] = true;
        }

        return new LinearImmutableArray(
            this,
            this.owners,
            blockIdx,
            dataView,
            globalOffsetSlabs,
            localOffsetSlabs,
            slabsCount,
        );
    }

    public reallocateArray(array: LinearImmutableArray, slabsCount: number): LinearImmutableArray {
        const changeSlabs = slabsCount - array.sizeSlabs;

        if (changeSlabs == 0) {
            return array;
        }

        if (changeSlabs < 0) {
            for (let i = array.localOffsetSlabs + array.sizeSlabs + changeSlabs; i < array.localOffsetSlabs + array.sizeSlabs; i++) {
                this._allocatedSlabs[array.globalOffsetSlabs + i] = false;
            }

            array.removeSlabs(changeSlabs);
            return array;
        }

        // Copy from old to new array
        const newArray = this.allocateArray(slabsCount);
        const oldArrayView = new Uint8Array(this._cpuBlocks[array.blockIdx], array.localOffsetSlabs * this.slabSize, array.sizeSlabs * this.slabSize);
        const newArrayView = new Uint8Array(this._cpuBlocks[newArray.blockIdx], newArray.localOffsetSlabs * this.slabSize, array.sizeSlabs * this.slabSize);
        newArrayView.set(oldArrayView);

        // Flag old slabs as deallocated
        for (let i = 0; i < array.sizeSlabs; i++) {
            this._allocatedSlabs[array.globalOffsetSlabs + i] = false;
        }

        return newArray;
    }

    public deallocateArray(array: LinearImmutableArray | null): void {
        if (!array) {
            return;
        }

        for (let i = 0; i < array.sizeSlabs; i++) {
            this._allocatedSlabs[array.globalOffsetSlabs + i] = false;
        }
    }

    public setModified(indices: Array<number>): void {
        indices.forEach((index) => this._modifiedSlabs[index] = true);
    }

    //#region Fragmentation
    /**
     * TODO
     */
    public defragment() {
        // TODO
    }
    //#endregion

    //#region Accessors
    public get device(): GPUDevice {
        return this._device;
    }

    public get blockSize(): number {
        return this._blockSize;
    }

    public get slabSize(): number {
        return this._slabSize;
    }

    public get slabsPerBlock(): number {
        return this._slabsPerBlock
    }

    public get modifiedSlabs(): Array<boolean> {
        return this._modifiedSlabs;
    }

    public getCpuBlock(idx: number): ArrayBuffer {
        return this._cpuBlocks[idx];
    }

    public getGpuBlock(idx: number): GPUBuffer {
        return this._gpuBlocks[idx];
    }
    //#endregion
}
