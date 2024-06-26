import { ContinuousTube, LowLevelStructure, Spheres } from "../primitives/index";
import { CameraConfigurationType, OrbitCamera, OrbitCameraConfiguration, SmoothCamera, SmoothCameraConfiguration } from "../cameras/index";
import { Scene } from "../scene";
import { GraphicsLibrary } from "..";
import { Viewport3D } from ".";
import { vec2, vec3, vec4, quat } from "gl-matrix";
import { Hit, Ray } from "../shared";
import { Spline } from "../primitives/spline";

const CHROMATIN_OBJECT_NAME = 'CHROMATIN';

export enum ChromatinRepresentation {
  Spheres = 0,
  ContinuousTube = 1,
  Spline = 2,
}

export type ChromatinRepresentationType = ContinuousTube | Spheres | Spline;

export class ChromatinPart {
  private _chromatinViewport: ChromatinViewport;

  private _name: string;
  private _structure: ChromatinRepresentationType;

  private _highLevelID: number;
  private _dataId: number;

  private _binsPositions: Array<vec3>;
  private _binsColor: Array<vec4>;

  constructor(chromatinViewport: ChromatinViewport, name: string, structure: ChromatinRepresentationType, highLevelID: number, dataId: number, binsPositions: Array<vec3>) {
    this._name = name;
    this._chromatinViewport = chromatinViewport;
    this._structure = structure;
    this._highLevelID = highLevelID;
    this._dataId = dataId;

    this._binsPositions = binsPositions;
    this._binsColor = new Array<vec4>(this._binsPositions.length);
  }

  public lowLevelIndexToBinIndex(hit: Hit): number | null {
    if (this._structure instanceof ContinuousTube) {
      const ray = hit.ray;

      // Calculate Intersection
      const intersection = vec3.add(vec3.create(), ray.origin, vec3.scale(vec3.create(), ray.direction, hit.distance));

      // Calculate normal
      const i = this._structure.localOffsetOf(LowLevelStructure.RoundedCone, hit.lowLevelIndex);

      const from = this._structure.points[i];
      const to = this._structure.points[i + 1];

      if (!from || !to) {
        return null;
      }

      const radius = this._structure.radius;

      const ba = vec3.sub(vec3.create(), to, from);
      const pa = vec3.sub(vec3.create(), intersection, from);
      const h = Math.min(Math.max(0.0, vec3.dot(pa, ba) / vec3.dot(ba, ba)), 1.0);
      const normal = vec3.scale(vec3.create(), vec3.sub(vec3.create(), pa, vec3.scale(vec3.create(), ba, h)), 1.0 / radius);

      // Calculate closest to side
      const capsuleLength = vec3.length(ba);
      const lengthOnIntersection = vec3.length(vec3.sub(vec3.create(), from, vec3.sub(vec3.create(), intersection, vec3.scale(vec3.create(), normal, radius))));
      const ratio = lengthOnIntersection / capsuleLength;

      if (i >= this._binsPositions.length) {
        return this._binsPositions.length - 1;
      }

      if (ratio < 0.5) {
        return i;
      } else {
        return i + 1;
      }
    } else if (this._structure instanceof Spheres) {
      return this._structure.localOffsetOf(LowLevelStructure.Sphere, hit.lowLevelIndex);
    } else if (this._structure instanceof Spline) {
      return Math.floor(this._structure.localOffsetOf(LowLevelStructure.QuadraticBezierCurve, hit.lowLevelIndex) / 2);
    }

    return null;
  }

  public resetColor(color: GPUColorDict): void {
    if (this._structure instanceof ContinuousTube) {
      this._structure.resetColors(vec4.fromValues(color.r, color.g, color.b, color.a));
    } else if (this._structure instanceof Spheres) {
      this._structure.resetColors(vec4.fromValues(color.r, color.g, color.b, color.a));
    } else if (this._structure instanceof Spline) {
      this._structure.resetColors(vec4.fromValues(color.r, color.g, color.b, color.a));
    }
  }

  public cacheColorArray(colors: Array<vec4>): Array<vec4> {
    const binsLength = this._binsPositions.length;
    let finalColorsArray: Array<vec4> = [];

    if (this._structure instanceof ContinuousTube) {
      finalColorsArray = new Array(2 * (binsLength - 1));

      for (let i = 0; i < binsLength - 1; i++) {
        finalColorsArray[2 * i + 0] = colors[i];
        finalColorsArray[2 * i + 1] = colors[i + 1];
      }
    } else if (this._structure instanceof Spheres) {
      finalColorsArray = colors.map(v => vec4.clone(v));
    } else if (this._structure instanceof Spline) {
      finalColorsArray = new Array(4 * binsLength);

      for (let i = 0; i < binsLength; i++) {
        finalColorsArray[4 * i + 0] = colors[i];
        finalColorsArray[4 * i + 1] = colors[i];
        finalColorsArray[4 * i + 2] = colors[i];
        finalColorsArray[4 * i + 3] = colors[i];
      }
    }

    this._binsColor = colors.map(c => vec4.clone(c));

    return finalColorsArray;
  }

  public setBinColor(binIndex: number, color: GPUColorDict): void {
    const c = vec4.fromValues(color.r, color.g, color.b, color.a);
    this._binsColor[binIndex] = c;

    this.setBinColorVec4(binIndex, c);
  }

  public setBinColorVec4(binIndex: number, color: vec4): void {
    this._binsColor[binIndex] = vec4.clone(color);

    if (this._structure instanceof ContinuousTube) {
      if (binIndex == 0) {
        this._structure.setColor(color, 0);
      } else {
        this._structure.setColor2(color, binIndex - 1);
        this._structure.setColor(color, binIndex);   
      }   
    } else if (this._structure instanceof Spheres) {
      this._structure.setColor(binIndex, color);
    } else if (this._structure instanceof Spline) {
      this._structure.setColor(binIndex, color);
    }
  }

  public setCullableBins(cullable: Array<boolean>) {
    if (this._structure instanceof ContinuousTube) {
      this._structure.setCullablePoints(cullable);
    }
  }

  public getBinsPositions(): Array<vec3> {
    return this._binsPositions;
  }

  public get structure(): ChromatinRepresentationType {
    return this._structure;
  }

  public get dataId(): number {
    return this._dataId;
  }

  public get name(): string {
    return this._name;
  }

  public get highLevelID(): number {
    return this._highLevelID;
  }
}

export type ChromatinIntersection = {
  chromatinPart: ChromatinPart;

  lowLevelIndex: number;
  highLevelID: number;

  binIndex: number;

  ray: Ray,
  distance: number;
}

export class ChromatinViewport extends Viewport3D {
  public _chromatin: Array<ChromatinPart> = [];

  private maxId = 0;
  private binPositions: vec3[] = [];

  constructor(
    graphicsLibrary: GraphicsLibrary,
    canvas: HTMLCanvasElement | null,
    scene: Scene | null = null,
    camera: OrbitCamera | SmoothCamera | null = null) {
    super(graphicsLibrary, canvas, scene, camera);
  }

  public clearChromatin(): void {
    if (!this._scene) {
      return;
    }

    for (let i = 0; i < this._chromatin.length; i++) {
      this._scene.removeStructureByID(this._chromatin[i].highLevelID);
    }

    this._chromatin = [];
  }

  public buildBVH(): void {
    this._scene?.buildBVH();
  }

  public rebuild(): void {
    if (!this._scene) {
      return;
    }

    this._scene.buildLowLevelStructure();
  }

  /**
   * Adds a part of chromatin to the viewport
   * 
   * @param bins - sequence of points that represent bins of a chromatin part
   * @param dataId - unique id of the supplied data
   * 
   * @returns created structure
   */
  public addPart(
    chromosomeName: string, 
    bins: Array<{ x: number, y: number, z: number }>, 
    connectivityBitset: Array<0 | 1> | null, 
    dataId: number, representation: ChromatinRepresentation, update = true): ChromatinPart {
    const pointsVec3 = bins.map(p => vec3.fromValues(p.x, p.y, p.z));

    this.binPositions = pointsVec3.map(p => vec3.clone(p));

    let highLevelID;
    let structure;
    switch (representation) {
      case ChromatinRepresentation.ContinuousTube: {
        [highLevelID, structure] = this._scene.addContinuousTube(CHROMATIN_OBJECT_NAME + this.maxId, pointsVec3, connectivityBitset, 1.0, null, true, update);
        break;
      }
      case ChromatinRepresentation.Spheres: {
        [highLevelID, structure] = this._scene.addSpheres(CHROMATIN_OBJECT_NAME + this.maxId, pointsVec3, null, null, false, update);
        break;
      }
      case ChromatinRepresentation.Spline: {
        [highLevelID, structure] = this._scene.addSpline(CHROMATIN_OBJECT_NAME + this.maxId, pointsVec3, null, null, true, update);
        break;
      }
    }

    this._chromatin.push(new ChromatinPart(
      this,
      chromosomeName,
      structure,
      highLevelID,
      dataId,
      this.binPositions,
    ));

    this.maxId++;

    return this._chromatin[this._chromatin.length - 1];
  }

  public removeChromatinPartByDataId(dataId: number, update = true): void {
    if (!this._scene) {
      return;
    }

    const chromatinPartIndex = this._chromatin.findIndex(v => v.dataId == dataId);
    const highLevelID = this._chromatin[chromatinPartIndex].highLevelID;

    this._scene.removeStructureByID(highLevelID, update);
    this._chromatin.splice(chromatinPartIndex, 1);
  }

  public getChromatinPartByDataId(dataId: number): ChromatinPart | null {
    if (!this._scene) {
      return null;
    }

    return this._chromatin.find(c => c.dataId == dataId) || null;
  }

  public getChromatinParts(): Array<ChromatinPart> {
    return this._chromatin;
  }

  public closestIntersectionBin(screenSpacePosition: { x: number, y: number }): ChromatinIntersection | null {
    const closestIntersection = this.closestIntersection(vec2.fromValues(screenSpacePosition.x, screenSpacePosition.y));

    if (closestIntersection == null) {
      return null;
    }

    const chromatinPart = this._chromatin.find(chromatinPart => chromatinPart.highLevelID == closestIntersection.highLevelIndex);

    if (chromatinPart == undefined) {
      return null;
    }

    const binIndex = chromatinPart.lowLevelIndexToBinIndex(closestIntersection);

    if (binIndex == null) {
      return null;
    }

    return {
      chromatinPart,

      lowLevelIndex: closestIntersection.lowLevelIndex,
      highLevelID: closestIntersection.highLevelIndex,

      binIndex,

      ray: closestIntersection.ray,
      distance: closestIntersection.distance,
    };
  }

  public set cameraConfiguration(cameraConfiguration: OrbitCameraConfiguration | SmoothCameraConfiguration) {
    // public set cameraConfiguration(cameraConfiguration: CameraConfiguration) {
    if (this._camera) {
      if ((cameraConfiguration.type === CameraConfigurationType.Orbit) && (this._camera instanceof OrbitCamera)) {
        this._camera.rotX = cameraConfiguration.rotX;
        this._camera.rotY = cameraConfiguration.rotY;
        this._camera.distance = cameraConfiguration.distance;
      } else if ((cameraConfiguration.type === CameraConfigurationType.Smooth) && (this._camera instanceof SmoothCamera)) {
        const cc = cameraConfiguration;
        this._camera.position = vec3.fromValues(cc.position.x, cc.position.y, cc.position.z);
        this._camera.orbitingPivot = vec3.fromValues(cc.lookAtPosition.x, cc.lookAtPosition.y, cc.lookAtPosition.z);
        //~ rotation may seem redundant but it is used internally
        this._camera.rotation = quat.fromValues(cc.rotationQuat.x, cc.rotationQuat.y, cc.rotationQuat.z, cc.rotationQuat.w);
      }
    }
  }

  public get cameraConfiguration(): OrbitCameraConfiguration | SmoothCameraConfiguration {
    return this._camera?.cameraConfiguration ?? {
      type: CameraConfigurationType.Orbit,

      rotX: 0.0,
      rotY: 0.0,
      distance: 0.0,
      position: { x: 0.0, y: 0.0, z: 0.0 },
      lookAtPosition: { x: 0.0, y: 0.0, z: 0.0 }
    }
  }
}
