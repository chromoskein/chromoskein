import { Camera, CameraConfigurationType, SmoothCameraConfiguration } from "./shared";
import { mat4, quat, vec2, vec3, vec4 } from "gl-matrix";

const TAU = Math.PI * 2.0;
const PI = Math.PI;

function deg_to_rad(degrees: number): number {
    return degrees * (PI / 180.0);
}

function easeOutExp(t: number): number {
    return -Math.pow(2, -10 * t) + 1;
}

//~ LOL, these definitions are useless actually...
type OrbitingParams = {
    currentLerpTime: number;
    lastFrameAngleX: number;
    lastFrameAngleY: number;
    endAngleY: number;
    endAngleX: number;
    pivot: vec3;
}

type ZoomingParams = {
    currentLerpTime: number;
    endAmount: number;
    lastFrameZoomAmount: number;
}

type PanningParams = {
    currentLerpTime: number;
    startPosition: vec3;
    endPosition: vec3;
    lastFramePosition: vec3;
}

export class SmoothCamera extends Camera {
    private currentMousePos = { x: 0, y: 0 };
    private lastMousePos = { x: 0, y: 0 };
    private dragging = false;
    private _rotation = quat.create();

    isMoving = false;

    //~ general
    animTime = 1000.0;
    zoomToCursor = false;
    orbitingSpeed = 0.5;
    zoomingSpeed = 0.0015;
    panningSpeed = 0.005;

    //~ orbiting params
    orbiting: OrbitingParams = {
        currentLerpTime: 0,
        lastFrameAngleX: 0,
        lastFrameAngleY: 0,
        endAngleY: 0,
        endAngleX: 0,
        pivot: vec3.fromValues(0, 0, 0)
    }

    //~ zooming params
    zooming: ZoomingParams = {
        currentLerpTime: 0.0,
        endAmount: 0.0,
        lastFrameZoomAmount: 0.0,
    }

    //~ panning params
    panning: PanningParams = {
        currentLerpTime: 0.0,
        startPosition: vec3.fromValues(0, 0, 0),
        endPosition: vec3.fromValues(0, 0, 0),
        lastFramePosition: vec3.fromValues(0, 0, 0),
    }

    constructor(device: GPUDevice, width: number, height: number, near = 0.001, fieldOfView = 45.0) {
        super(device, width, height, near, fieldOfView);


        this.updateCPU(0);
    }

    //#region Update functions
    public updateCPU(dt: number): void {

        this.updateZooming(dt);
        this.updateOrbiting(dt);
        this.updatePanning(dt);

        const mvm = this.computeModelViewMatrix(this.position, this.orbiting.pivot);
        mat4.copy(this._viewMatrix, mvm);

        super.updateCPU(dt);
    }

    protected updateZooming(dt: number): void {
        this.zooming.currentLerpTime += dt;
        if (this.zooming.currentLerpTime > this.animTime) this.zooming.currentLerpTime = this.animTime;
        const perc = this.zooming.currentLerpTime / this.animTime;

        const currentZoom = this.lerpNumber(0.0, this.zooming.endAmount, easeOutExp(perc));
        const change = currentZoom - this.zooming.lastFrameZoomAmount;
        this.zooming.lastFrameZoomAmount = currentZoom;

        if (!this.zoomToCursor) {
            //~ zoom in => move the camera by the current frame change
            const changeVec = vec3.create();
            vec3.scale(changeVec, this.forward(), change);
            vec3.sub(this.position, this.position, changeVec);
        }

        //~ zoom-to-cursor: shifting the camera slightly so that the cursor stays in the same position
        if (this.zoomToCursor && (change != 0.0)) {
            this.adjustZoomToCursor(change);
        }

        this.isMoving = (perc < 1.0);

    }

    protected adjustZoomToCursor(change: number): void {
        const mousePos = this.currentMousePos;
        let dummyDepth = 1.0;
        let dummyDepthScreenSpace = this.depthViewToScreenSpace(dummyDepth);
        let screenPos = vec3.fromValues(mousePos.x, this.height - mousePos.y, dummyDepthScreenSpace);
        const mouseWorldPosBefore = vec3.create();
        this.screenToWorldPoint(mouseWorldPosBefore, screenPos);

        //~ zoom in => move the camera by the current frame change
        const changeVec = vec3.create();
        vec3.scale(changeVec, this.forward(), change);
        vec3.sub(this.position, this.position, changeVec);

        //~ make the change also in dummy depth
        dummyDepth += change;
        dummyDepthScreenSpace = this.depthViewToScreenSpace(dummyDepth);
        screenPos = vec3.fromValues(mousePos.x, this.height - mousePos.y, dummyDepthScreenSpace);
        const mouseWorldPosAfter = vec3.create();
        this.screenToWorldPoint(mouseWorldPosAfter, screenPos);

        //~ get change in position => offset
        const offset = vec3.create();
        vec3.sub(offset, mouseWorldPosAfter, mouseWorldPosBefore);

        //~ move camera by offset 
        vec3.sub(this.position, this.position, offset);
        vec3.sub(this.orbiting.pivot, this.orbiting.pivot, offset);

    }

    protected updateOrbiting(dt: number): void {
        this.orbiting.currentLerpTime += dt;
        if (this.orbiting.currentLerpTime > this.animTime) this.orbiting.currentLerpTime = this.animTime;
        const perc = this.orbiting.currentLerpTime / this.animTime;

        const currentAngleX = this.lerpNumber(0.0, this.orbiting.endAngleX, easeOutExp(perc));
        const currentAngleY = this.lerpNumber(0.0, this.orbiting.endAngleY, easeOutExp(perc));

        const rotIncrementX = currentAngleX - this.orbiting.lastFrameAngleX;
        const rotIncrementY = currentAngleY - this.orbiting.lastFrameAngleY;
        this.orbiting.lastFrameAngleX = currentAngleX;
        this.orbiting.lastFrameAngleY = currentAngleY;

        const horizRot = quat.create();
        // quat.setAxisAngle(horizRot, this.up(), deg_to_rad(-rotIncrementY));
        quat.setAxisAngle(horizRot, vec3.fromValues(0, 1, 0), deg_to_rad(-rotIncrementY));
        const vertRot = quat.create();
        quat.setAxisAngle(vertRot, this.right(), deg_to_rad(rotIncrementX));
        // quat.setAxisAngle(vertRot, vec3.fromValues(1, 0, 0), deg_to_rad(rotIncrementX));
        const newRot = quat.create();
        quat.mul(newRot, horizRot, vertRot);
        const v = vec3.create();
        vec3.sub(v, this.position, this.orbiting.pivot);
        const newPos = vec3.create();
        const shift = vec3.create();
        vec3.transformQuat(shift, v, newRot);
        vec3.add(newPos, this.orbiting.pivot, shift);

        vec3.copy(this.position, newPos);
        quat.mul(this.rotation, newRot, this.rotation);

        this.isMoving = this.isMoving || (perc < 1.0);

    }

    protected updatePanning(dt: number): void {
        this.panning.currentLerpTime += dt;
        if (this.panning.currentLerpTime > this.animTime) this.panning.currentLerpTime = this.animTime;
        const perc = this.panning.currentLerpTime / this.animTime;

        const currentFramePosition = vec3.create();
        vec3.lerp(currentFramePosition, this.panning.startPosition, this.panning.endPosition, easeOutExp(perc));
        const frameOffset = vec3.create();
        vec3.sub(frameOffset, currentFramePosition, this.panning.lastFramePosition);
        vec3.copy(this.panning.lastFramePosition, currentFramePosition);
        vec3.add(this.position, this.position, frameOffset);

        //~ Seems like I should also add this, otherwise orbiting will be weird...
        vec3.add(this.orbiting.pivot, this.orbiting.pivot, frameOffset);

        this.isMoving = this.isMoving || (perc < 1.0);

    }
    //#endregion

    //#region Interface 
    public get cameraConfiguration(): SmoothCameraConfiguration {
        return {
            type: CameraConfigurationType.Smooth,

            position: { x: this.position[0], y: this.position[1], z: this.position[2] },
            lookAtPosition: { x: this.orbiting.pivot[0], y: this.orbiting.pivot[1], z: this.orbiting.pivot[2] },
            rotationQuat: { x: this.rotation[0], y: this.rotation[1], z: this.rotation[2], w: this.rotation[3] }
        };
    }

    public get position(): vec3 {
        return this._position;
    }

    public set position(pos: vec3) {
        this._position = pos;
    }

    public set rotation(rot: quat) {
        this._rotation = rot;
    }

    public get rotation(): quat {
        return this._rotation;
    }

    public get orbitingPivot(): vec3 {
        return this.orbiting.pivot;
    }

    public set orbitingPivot(pivot: vec3) {
        this.orbiting.pivot = pivot;
    }
    //#endregion

    protected computeModelViewMatrix(camPosition: vec3, lookAtPosition: vec3): mat4 {
        const mvm = mat4.create();
        mat4.identity(mvm);
        mat4.lookAt(mvm, camPosition, lookAtPosition, vec3.fromValues(0, 1, 0));
        return mvm;
    }

    protected getModelViewMatrix(): mat4 {
        let mvm = mat4.create();
        mvm = this.computeModelViewMatrix(this.position, this.orbiting.pivot);
        return mvm;
    }

    public up(): vec3 {
        const yPosAxis = vec3.fromValues(0, 1, 0);
        const upVector = vec3.create();
        vec3.transformQuat(upVector, yPosAxis, this.rotation);
        return upVector;
    }

    public right(): vec3 {
        const xPosAxis = vec3.fromValues(1, 0, 0);
        const rightVector = vec3.create();
        vec3.transformQuat(rightVector, xPosAxis, this.rotation);
        return rightVector;
    }

    public forward(): vec3 {
        const zPosAxis = vec3.fromValues(0, 0, 1);
        const forwardVector = vec3.create();
        vec3.transformQuat(forwardVector, zPosAxis, this.rotation);
        return forwardVector;
    }

    //#region Events
    public onMouseDown(event: MouseEvent): void {
        super.onMouseDown(event);
        if (this.ignoreEvents) return;

        this.lastMousePos = { x: event.screenX, y: event.screenY };
    }

    public onMouseMove(event: MouseEvent): void {
        super.onMouseMove(event);

        if (this.ignoreEvents) return;

        if (event.buttons == 1 && !event.altKey) //~ => Left button => Orbiting
        {
            const delta = { x: event.screenX - this.lastMousePos.x, y: event.screenY - this.lastMousePos.y };

            if (!this.dragging) {
                this.dragging = true;
            }

            this.orbiting.currentLerpTime = 0.0;
            this.orbiting.lastFrameAngleX = 0.0;
            this.orbiting.lastFrameAngleY = 0.0;
            this.orbiting.endAngleY = delta.x * this.orbitingSpeed;
            this.orbiting.endAngleX = delta.y * this.orbitingSpeed;

            this.lastMousePos = { x: event.screenX, y: event.screenY };
        }
        else if ((event.buttons == 4) || (event.buttons == 1 && event.altKey)) //~ => Middle button => Panning
        {
            const delta = { x: event.screenX - this.lastMousePos.x, y: event.screenY - this.lastMousePos.y };

            vec3.copy(this.panning.startPosition, this.position);
            vec3.copy(this.panning.lastFramePosition, this.position);

            vec3.copy(this.panning.endPosition, this.position);
            const incrVec = vec3.create();
            vec3.scale(incrVec, this.up(), delta.y * this.panningSpeed);
            vec3.add(this.panning.endPosition, this.panning.endPosition, incrVec);
            vec3.scale(incrVec, this.right(), delta.x * this.panningSpeed);
            vec3.add(this.panning.endPosition, this.panning.endPosition, incrVec);

            this.panning.currentLerpTime = 0.0;

            this.lastMousePos = { x: event.screenX, y: event.screenY };
        }


    }

    public onMouseUp(event: MouseEvent): void {
        super.onMouseUp(event);

        //~ left for future implementation
    }

    public onMouseEnter(event: MouseEvent): void {
        super.onMouseEnter(event);

        //~ left for future implementation
    }

    public onMouseLeave(event: MouseEvent): void {
        super.onMouseLeave(event);

        //~ left for future implementation
    }

    public onWheelEvent(event: WheelEvent): void {
        super.onWheelEvent(event);

        if (this.ignoreEvents) return;

        const speed = this.zoomingSpeed;

        this.zooming.endAmount = event.deltaY * speed;
        this.zooming.lastFrameZoomAmount = 0.0;
        this.zooming.currentLerpTime = 0.0;

        this.currentMousePos = { x: event.offsetX, y: event.offsetY };
    }

    public onKeyDown(event: KeyboardEvent): void {
        super.onKeyDown(event);

        if (this.ignoreEvents) return;

        if (event.key === 't') {
            console.log("T key pressed!");
            const depthSS = this.depthViewToScreenSpace(10);
            console.log("depth in screenspace: " + depthSS);

            const sampleVecSS = vec3.fromValues(0, 0, depthSS);
            const sampleVecWS = vec3.create();
            this.screenToWorldPoint(sampleVecWS, sampleVecSS);
            console.log("sampleVecWS: " + sampleVecWS);
        } if (event.key === 'r') { //~ testing if known projected WS position unprojects back correctly
            const origWS = vec3.fromValues(1, 2, 3);
            // let origWS = vec3.fromValues(0, 0, 0);
            //~ project to screenspace
            const vector = vec4.fromValues(origWS[0], origWS[1], origWS[2], 1.0);
            const out = vec4.create();
            vec4.transformMat4(out, vector, this.getModelViewMatrix()); //~ => view space
            vec4.transformMat4(out, out, this.projectionMatrix); //~ => clip space
            const vecNDC = vec3.fromValues(out[0] / out[3], out[1] / out[3], out[2] / out[3]); //~ NDC
            //~ do the rest of the transformation: viewport
            const viewport = { x: 0, y: 0, w: this.width, h: this.height };
            const x = vecNDC[0] * (viewport.w / 2.0) + (viewport.x + viewport.w / 2.0);
            const y = vecNDC[1] * (viewport.h / 2.0) + (viewport.y + viewport.h / 2.0);
            const z = vecNDC[2]; //TODO: need to verify
            const vecSS = vec3.fromValues(x, y, z);

            //~ get back the WS from SS
            const reconstructedWS = vec3.create();
            this.screenToWorldPoint(reconstructedWS, vecSS);
        }
        if (event.key === 'z') {
            if (this.zoomToCursor) {
                this.zoomToCursor = false;
                console.log("Zoom-To-Cursor: Switched OFF")
            } else {
                this.zoomToCursor = true;
                console.log("Zoom-To-Cursor: Switched ON")
            }
        }
    }
    //#endregion

    public lerpNumber(start: number, end: number, t: number): number {
        return start * (1.0 - t) + end * t;
    }

    public lerpVec3(start: vec3, end: vec3, t: number): vec3 {
        const A = vec3.create();
        const B = vec3.create();
        const result = vec3.create();
        vec3.scale(A, A, 1.0 - t);
        vec3.scale(B, B, t);
        vec3.add(result, A, B);

        return result;
    }



    public viewToScreenSpace(out: vec3, input: vec3): void {
        const viewPos = vec4.fromValues(input[0], input[1], input[2], 1.0);
        const res = vec4.create();
        vec4.transformMat4(res, viewPos, this.projectionMatrix);
        const screenPos = vec3.fromValues(res[0] / res[3], res[1] / res[3], res[2] / res[3]);
        vec3.copy(out, screenPos);
    }

    public depthViewToScreenSpace(depth: number): number {
        const justAVec = vec4.fromValues(0, 0, depth, 1.0);
        const result = vec4.create();
        vec4.transformMat4(result, justAVec, this.projectionMatrix);
        return result[2] / result[3]; // z / w
    }

    public screenToWorldPoint(out: vec3, screenPosition: vec3): vec3 {
        //~ compute view-projection matrix
        const viewMat = this.getModelViewMatrix();
        const projMat = this.projectionMatrix;

        //~ get world-space position from screen-space coordinates
        const worldPos = vec3.create();
        const viewport = vec4.fromValues(0, 0, this.width, this.height); // (x, y, width, height)
        this.Unproject(worldPos, screenPosition, viewMat, projMat, viewport);

        //~ output
        vec3.copy(out, worldPos);
        return worldPos;
    }

    /*
        used this: https://gist.github.com/evshiron/8339cd1f1f73925b92e395b6a8aebf80 (evshiron)
        different solution: https://github.com/toji/gl-matrix/issues/101 (mattdesl)
    */
    protected Unproject(out: vec3, input: vec3, view: mat4, projection: mat4, viewport: vec4): void {
        const x = viewport[0];
        const y = viewport[1];
        const width = viewport[2];
        const height = viewport[3];

        const dest = vec3.create(); // The result.
        const m = mat4.create(); // The view * projection matrix.
        const im = mat4.create(); // The inverted view * projection matrix.
        const v = vec4.create(); // The vector.
        const tv = vec4.create(); // The transformed vector.

        // Apply viewport transform.
        v[0] = (input[0] - x) * 2.0 / width - 1.0;
        v[1] = (input[1] - y) * 2.0 / height - 1.0;
        v[2] = input[2];
        v[3] = 1.0;

        // Build inverted view * projection matrix.
        mat4.multiply(m, projection, view);
        if (!mat4.invert(im, m)) { return; }

        vec4.transformMat4(tv, v, im);
        if (v[3] === 0.0) { return; }

        dest[0] = tv[0] / tv[3];
        dest[1] = tv[1] / tv[3];
        dest[2] = tv[2] / tv[3];

        vec3.copy(out, dest);
    }

}
