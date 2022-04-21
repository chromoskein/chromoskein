import { Camera, CameraConfigurationType, OrbitCameraConfiguration } from "./shared";
import { mat4, vec2, vec3 } from "gl-matrix";

const TAU = Math.PI * 2.0;
const PI = Math.PI;

export class OrbitCamera extends Camera {
    private _rotX = 0.0;
    private _rotY = 0.0;
    private _distance = 1.0;
    private _lookAtPosition: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    private _upVector: vec3;

    private lastX = 0;
    private lastY = 0;
    private mousePressed = false;

    constructor(device: GPUDevice, width: number, height: number, near = 0.01, fieldOfView = 45.0) {
        super(device, width, height, near, fieldOfView);

        this._lookAtPosition = vec3.fromValues(0.0, 0.0, 0.0);
        this._upVector = vec3.fromValues(0.0, 1.0, 0.0);

        this.updateCPU();
    }

    public set distance(distance: number) {
        this._distance = distance;

        this.updateCPU();
    }

    protected updateCPU(): void {
        const matrix = mat4.create();
        mat4.identity(matrix);

        mat4.rotateY(matrix, matrix, (this._rotX * Math.PI) / 180);
        mat4.rotateX(matrix, matrix, (this._rotY * Math.PI) / 180);

        vec3.transformMat4(this._position, vec3.fromValues(0.0, 0.0, this._distance), matrix);

        // vec3.multiply(this._position, this._position, vec3.fromValues(this._distance, this._distance, this._distance));
        mat4.lookAt(this._viewMatrix, this._position, this._lookAtPosition, this._upVector);

        super.updateCPU(0);
    }

    public get rotX(): number {
        return this._rotX;
    }

    public set rotX(x: number) {
        this._rotX = x % 360;
    }

    public get rotY(): number {
        return this._rotY;
    }

    public set rotY(y: number) {
        if (y > 0.0 && y < 90.0) {
            this._upVector = vec3.fromValues(0.0, 1.0, 0.0);
        }

        if (y < 0.0 && y > -90.0) {
            this._upVector = vec3.fromValues(0.0, 1.0, 0.0);
        }

        if (y > 90.0 && y < 180.0) {
            this._upVector = vec3.fromValues(0.0, -1.0, 0.0);
        }

        if (y < -90.0 && y > -180.0) {
            this._upVector = vec3.fromValues(0.0, -1.0, 0.0);
        }

        if (y > 180.0) {
            y = -180.0;
        }

        if (y < -180.0) {
            y = 180.0;
        }

        this._rotY = y;
    }

    public get cameraConfiguration(): OrbitCameraConfiguration {
        return {
            type: CameraConfigurationType.Orbit,

            rotX: this._rotX,
            rotY: this._rotY,
            distance: this._distance,
            position: {
                x: this._position[0],
                y: this._position[1],
                z: this._position[2]
            },
            lookAtPosition: {
                x: this._lookAtPosition[0],
                y: this._lookAtPosition[1],
                z: this._lookAtPosition[2]
            }
        };
    }

    ///
    /// Events
    ///
    public onMouseDown(event: MouseEvent) {
        super.onMouseDown(event);
        this.lastX = event.offsetX;
        this.lastY = event.offsetY;
        this.mousePressed = true;

        this.updateCPU();
    }

    public onMouseMove(event: MouseEvent) {
        super.onMouseMove(event);

        if (this.mousePressed) {
            const changeX = this.lastX - event.offsetX;
            const changeY = this.lastY - event.offsetY;

            if (vec3.equals(this._upVector, vec3.fromValues(0.0, 1.0, 0.0))) {
                this.rotX += changeX / 5.0;
            } else {
                this.rotX -= changeX / 5.0;
            }

            this.rotY = this.rotY + (changeY / 5.0);

            this.lastX = event.offsetX;
            this.lastY = event.offsetY;

            this._dirty = true;
        }

        this.updateCPU();
    }

    public onMouseUp(event: MouseEvent) {
        super.onMouseUp(event);

        this.mousePressed = false;

        this.updateCPU();
    }

    public onMouseEnter(event: MouseEvent) {
        super.onMouseEnter(event);


    }

    public onMouseLeave(event: MouseEvent) {
        super.onMouseLeave(event);

        this.mousePressed = false;
    }

    public onWheelEvent(event: WheelEvent) {
        super.onWheelEvent(event);

        this._distance += event.deltaY / 1000.0;
        this._dirty = true;

        this.updateCPU();
    }

    public easeOutExp(t: number): number {
        return -Math.pow(2, -10 * t) + 1;
        //return t;
        //return -Mathf.Pow(2, -10 * t) + 1;
        //return c * ( -Math.pow( 2, -10 * t/d ) + 1 ) + b;
    }

}
