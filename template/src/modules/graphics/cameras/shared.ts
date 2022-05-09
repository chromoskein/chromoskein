import { mat4, vec3, vec4 } from "gl-matrix";

export function toRadian(n: number) {
    return n * (Math.PI / 180);
}

export function perspectiveZO(out: mat4, fovy: number, aspect: number, near: number) {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 0;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = near;
    out[15] = 0;

    return out;
}

export enum CameraConfigurationType {
    Ortho,
    Orbit,
    Smooth,
}

export type CameraConfiguration = OrbitCameraConfiguration | OrthoCameraConfiguration | SmoothCameraConfiguration;

export type OrbitCameraConfiguration = {
    type: CameraConfigurationType.Orbit,

    rotX: number,
    rotY: number,
    distance: number,

    position: { x: number, y: number, z: number },
    lookAtPosition: { x: number, y: number, z: number },
}

export type OrthoCameraConfiguration = {
    type: CameraConfigurationType.Ortho,

    zoom: number,
    maxZoom: number,
    translateX: number,
    translateY: number,
}

export type SmoothCameraConfiguration = {
    type: CameraConfigurationType.Smooth,

    position: { x: number, y: number, z: number },
    lookAtPosition: { x: number, y: number, z: number },
    rotationQuat: { x: number, y: number, z: number, w: number }
}

export enum ProjectionType {
    Perpsective,
    Orthographic,
}

export class Camera {
    protected _width: number;
    protected _height: number;

    protected buffer: Float32Array;
    bufferGPU: GPUBuffer;

    protected _projectionMatrix: mat4 = mat4.create();
    protected _projectionMatrixInverse: mat4 = mat4.create();
    protected _viewMatrix: mat4 = mat4.create();
    protected _viewMatrixInverse: mat4 = mat4.create();
    protected _position: vec3 = vec3.fromValues(0.0, 0.0, -2.0);

    protected _projectionType: ProjectionType;
    protected _fieldOfView: number;
    protected _near: number;

    protected _dirty = true;
    protected _event_started_elsewhere = false;
    protected _ignoreEvents = false;




    constructor(device: GPUDevice, width: number, height: number, near = 0.01, fieldOfView = 45.0) {
        this._width = width;
        this._height = height;
        this._near = near;

        this.buffer = new Float32Array(128);
        this.bufferGPU = device.createBuffer({
            size: this.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this._fieldOfView = fieldOfView;
        this._projectionType = ProjectionType.Perpsective;
    }

    ///
    /// Setters & Getters
    ///

    public get width(): number {
        return this._width;
    }

    public get height(): number {
        return this._height;
    }

    public get position(): vec3 {
        return this._position;
    }

    public get projectionMatrix(): mat4 {
        return this._projectionMatrix;
    }

    public get projectionMatrixInverse(): mat4 {
        return this._projectionMatrixInverse;
    }

    public get viewMatrix(): mat4 {
        return this._viewMatrix;
    }

    public get viewMatrixInverse(): mat4 {
        return this._viewMatrixInverse;
    }

    public get dirty(): boolean {
        return this._dirty;
    }

    // public get cameraConfiguration(): OrbitCameraConfiguration {
    public get cameraConfiguration(): CameraConfiguration {
        return {
            type: CameraConfigurationType.Orbit,

            rotX: 0.0,
            rotY: 0.0,
            distance: 0.0,

            position: { x: this._position[0], y: this._position[1], z: this._position[2] },
            lookAtPosition: { x: 0.0, y: 0.0, z: 0.0 },            
        }
    }


    get ignoreEvents() {
        return this._event_started_elsewhere || this._ignoreEvents;
    }

    public set width(width: number) {
        this._width = width;

        this.updateCPU(0);
    }

    public set height(height: number) {
        this._height = height;

        this.updateCPU(0);
    }

    public set near(near: number) {
        this._near = near;

        this.updateCPU(0);
    }


    set ignoreEvents(value: boolean) {
        this._ignoreEvents = value
    }


    /**
     * updateCPU
     */
    protected updateCPU(dt: number): void {
        switch (this._projectionType) {
            case ProjectionType.Perpsective: {
                const ratio = this._width / this._height;
                perspectiveZO(this._projectionMatrix, toRadian(this._fieldOfView), ratio, this._near);
                break;
            }
        }

        // Precompute reverse of projection        
        mat4.invert(this._projectionMatrixInverse, this._projectionMatrix);

        // Precompute reverse of view
        mat4.invert(this._viewMatrixInverse, this._viewMatrix);

        // Precompute projection * view and reverse(projection * view)
        const viewProjectionMatrix = mat4.create() as Float32Array;
        mat4.multiply(viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);

        const viewProjectionMatrixInverse = mat4.create();
        mat4.invert(viewProjectionMatrixInverse, viewProjectionMatrix);

        // Precompute normal matrix
        const normalMatrix = mat4.create();
        mat4.transpose(normalMatrix, this._viewMatrixInverse);

        const position = vec4.fromValues(this._position[0], this._position[1], this._position[2], 1.0);

        this.buffer.set(this._projectionMatrix, 0);
        this.buffer.set(this._projectionMatrixInverse, 16);
        this.buffer.set(this._viewMatrix, 32);
        this.buffer.set(this._viewMatrixInverse, 48);
        this.buffer.set(viewProjectionMatrix, 64);
        this.buffer.set(viewProjectionMatrixInverse, 80);
        this.buffer.set(normalMatrix, 96);
        this.buffer.set(position, 112);
        this.buffer.set([0.0], 115);
        this.buffer.set([this._width, this._height], 116);
    }

    public updateGPU(queue: GPUQueue): void {
        queue.writeBuffer(
            this.bufferGPU,
            0,
            this.buffer.buffer,
            this.buffer.byteOffset,
            this.buffer.byteLength,
        );

        this._dirty = false;
    }

    public onMouseDown(event: MouseEvent) {

    }

    public onMouseMove(event: MouseEvent) {

    }

    public onMouseUp(event: MouseEvent) {
        if (event.buttons == 0) {
            this._event_started_elsewhere = false;
        }
    }

    public onMouseEnter(event: MouseEvent) {
        if (event.buttons != 0) {
            this._event_started_elsewhere = true;
        }

    }

    public onMouseLeave(event: MouseEvent) {
        this._event_started_elsewhere = false;
    }

    public onWheelEvent(event: WheelEvent) {

    }

    public onKeyDown(event: KeyboardEvent) {

    }
}
