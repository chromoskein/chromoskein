import { mat4, vec3, vec4 } from "gl-matrix";
import { CameraConfigurationType, OrthoCameraConfiguration } from "./shared";

export class Ortho2DCamera {
    private _width: number;
    private _height: number;

    private buffer: Float32Array;
    bufferGPU: GPUBuffer;

    private _projectionMatrix: mat4;
    private _viewMatrix: mat4;
    private _position: vec3;
    private _viewProjectionMatrix: mat4;
    private _viewProjectionInverseMatrix: mat4;

    private _zoom = 1.0;
    private _maxZoom = 1.0;

    private lastX = 0;
    private lastY = 0;
    private mousePressed = false;

    private _translateX = 0.0;
    private _translateY = 0.0;

    protected _event_started_elsewhere = false;
    protected _ignoreEvents = false;

    constructor(device: GPUDevice, width: number, height: number) {
        this._width = width;
        this._height = height;

        this._projectionMatrix = mat4.create();
        this._viewMatrix = mat4.create();
        this._position = vec3.fromValues(0.0, 0.0, 0.0);
        this._viewProjectionMatrix = mat4.create();
        this._viewProjectionInverseMatrix = mat4.create();

        this.buffer = new Float32Array(128);
        this.bufferGPU = device.createBuffer({
            size: this.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this._zoom = 1.0;
        this._maxZoom = 1.0;

        this.updateCPU();
    }

    ///
    /// Setters & Getters
    ///
    public set width(width: number) {
        this._width = width;

        this.updateCPU();
    }

    public get width(): number {
        return this._width;
    }

    public set height(height: number) {
        this._height = height;

        this.updateCPU();
    }

    public get height(): number {
        return this._height;
    }

    public get zoom(): number {
        return this._zoom;
    }

    public set zoom(zoom: number) {
        if (zoom <= 0.0) {
            zoom = 0.01;
        }

        if (zoom >= this.maxZoom) {
            zoom = this.maxZoom;
        }

        this._zoom = zoom;

        this.updateCPU();
    }

    public set maxZoom(zoom: number) {
        this._maxZoom = zoom;

        this.updateCPU();
    }

    public get translateX(): number {
        return this._translateX;
    }

    public set translateX(translateX: number) {
        this._translateX = translateX;

        this.updateCPU();
    }

    public get translateY(): number {
        return this._translateY;
    }

    public set translateY(translateY: number) {
        this._translateY = translateY;

        this.updateCPU();
    }


    set ignoreEvents(value: boolean) {
        this._ignoreEvents = value
    }


    public get cameraConfiguration(): OrthoCameraConfiguration {
        return {
            type: CameraConfigurationType.Ortho,

            zoom: this._zoom,
            maxZoom: this._maxZoom,
            translateX: this.translateX,
            translateY: this.translateY,
        };
    }

    public get projectionMatrix(): mat4 {
        return this._projectionMatrix;
    }

    public get viewMatrix(): mat4 {
        return this._viewMatrix;
    }

    public get viewProjectionMatrix(): mat4 {
        return this._viewProjectionMatrix;
    }

    public get viewProjectionInverseMatrix(): mat4 {
        return this._viewProjectionInverseMatrix;
    }
    get ignoreEvents() {
        return this._event_started_elsewhere || this._ignoreEvents;
    }

    // public get viewbox(): "" {
    //     const svgMinX = -this.translateX - this.zoom * 0.5;
    //     const svgMinY = -this.translateY - this.zoom * 0.5;
    //     const svgViewboxWidth = 0.5 * this.zoom;
    //     const svgViewboxHeight = 0.5 * this.zoom;

    //     return svgMinX + " " + svgMinY + " " + svgViewboxWidth + " " + svgViewboxHeight;
    // }

    ///
    /// 
    ///

    /**
     * updateCPU
     */
    protected updateCPU() {
        const zoom = this._zoom;

        // mat4.ortho(this._projectionMatrix, -this._scale, this._scale, -this._scale, this._scale, -1.0, 1.0);
        if (this._width > this._height) {
            const ratio = this._width / this._height;
            mat4.ortho(this._projectionMatrix,
                ratio * -1.0 * zoom,
                ratio * 1.0 * zoom,
                -1.0 * zoom,
                1.0 * zoom, -1.0, 1.0);
        } else {
            const ratio = this._height / this._width;
            mat4.ortho(this._projectionMatrix,
                -1.0 * zoom,
                1.0 * zoom,
                ratio * -1.0 * zoom,
                ratio * 1.0 * zoom, -1.0, 1.0);
        }


        mat4.fromTranslation(this._viewMatrix, vec3.fromValues(this._translateX, this._translateY, 0.0));

        // Precompute reverse of projection        
        const projectionMatrixInverse = mat4.create();
        mat4.invert(projectionMatrixInverse, this._projectionMatrix);

        // Precompute reverse of view
        const viewMatrixInverse = mat4.create();
        mat4.invert(viewMatrixInverse, this._viewMatrix);

        // Precompute projection * view and reverse(projection * view)
        this._viewProjectionMatrix = mat4.create() as Float32Array;
        mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

        this._viewProjectionInverseMatrix = mat4.create();
        mat4.invert(this._viewProjectionInverseMatrix, this._viewProjectionMatrix);

        const position = vec4.fromValues(this._position[0], this._position[1], this._position[2], 1.0);

        this.buffer.set(this._projectionMatrix, 0);
        this.buffer.set(projectionMatrixInverse, 16);
        this.buffer.set(this._viewMatrix, 32);
        this.buffer.set(viewMatrixInverse, 48);
        this.buffer.set(this._viewProjectionMatrix, 64);
        this.buffer.set(this._viewProjectionInverseMatrix, 80);
        this.buffer.set(position, 96);
        this.buffer.set([0.0], 99);
        this.buffer.set([this._width, this._height], 100);
    }

    /**
     * updateGPU
     */
    public updateGPU(queue: GPUQueue) {
        queue.writeBuffer(
            this.bufferGPU,
            0,
            this.buffer.buffer,
            this.buffer.byteOffset,
            this.buffer.byteLength,
        );
    }

    ///
    /// Events
    ///
    public onMouseDown(event: MouseEvent) {
        if (this.ignoreEvents) return;

        this.lastX = event.offsetX;
        this.lastY = event.offsetY;
        this.mousePressed = true;

        this.updateCPU();
    }

    public onMouseMove(event: MouseEvent) {
        if (this.ignoreEvents) return;

        if (this.mousePressed) {
            const zoomRatio = this.zoom / this.maxZoom;

            const changeX = this.lastX - event.offsetX;
            const changeY = this.lastY - event.offsetY;

            this._translateX -= (changeX * 0.35355);
            this._translateY += (changeY * 0.35355);

            this.lastX = event.offsetX;
            this.lastY = event.offsetY;
        }

        this.updateCPU();
    }

    public onMouseUp(event: MouseEvent) {
        if (event.buttons == 0) {
            this._event_started_elsewhere = false;
        }

        this.mousePressed = false;

        this.updateCPU();
    }

    public onWheelEvent(event: WheelEvent) {
        if (this.ignoreEvents) return;

        this.zoom += (event.deltaY / 100.0) * (this._maxZoom / 50.0);

        this.updateCPU();
    }

    public onMouseEnter(event: MouseEvent) {
        if (event.buttons != 0) {
            this._event_started_elsewhere = true;
        }

    }

    public onMouseLeave(event: MouseEvent) {
        this.mousePressed = false;
    }
}
