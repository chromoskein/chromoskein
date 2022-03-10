import { ContinuousTube, LowLevelStructure, Spheres } from "../primitives/index";
import { CameraConfigurationType, OrbitCamera, OrbitCameraConfiguration, SmoothCamera, SmoothCameraConfiguration } from "../cameras/index";
import { Scene } from "../scene";
import { GraphicsLibrary } from "..";
import { Viewport3D } from ".";
import { vec2, vec3, vec4, quat } from "gl-matrix";
import { BoundingBox, BoundingBoxEmpty, BoundingBoxExtendByPoint, Hit, Ray } from "../shared";
import { quantile } from 'simple-statistics'

const CHROMATIN_OBJECT_NAME = 'CHROMATIN';

export enum ChromatinRepresentation {
  ContinuousTube = 0,
  Spheres = 1,
}

export type ChromatinRepresentationType = ContinuousTube | Spheres;

export class ChromatinPart {
  private _chromatinViewport: ChromatinViewport;
  private _structure: ChromatinRepresentationType;
  private _highLevelID: number;
  private _dataId: number;
  private _chromosomeIndex: number;
  private _binsPositions: Array<vec3>;
  private _binsColor: Array<vec4>;

  constructor(chromatinViewport: ChromatinViewport, structure: ChromatinRepresentationType, highLevelID: number, dataId: number, chromosomeIndex: number, binsPositions: Array<vec3>) {
    this._chromatinViewport = chromatinViewport;
    this._structure = structure;
    this._highLevelID = highLevelID;
    this._dataId = dataId;
    this._chromosomeIndex = chromosomeIndex;
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

      if (i == 0) {
        return 0;
      }

      if (i >= this._binsPositions.length) {
        return this._binsPositions.length - 1;
      }

      if (ratio < 0.5) {
        return i - 1;
      } else {
        return i;
      }
    } else if (this._structure instanceof Spheres) {
      return this._structure.localOffsetOf(LowLevelStructure.Sphere, hit.lowLevelIndex);
    }

    return null;
  }

  public resetColor(color: GPUColorDict): void {
    if (this._structure instanceof ContinuousTube) {
      this._structure.resetColorBorder(vec4.fromValues(color.r, color.g, color.b, color.a));
    } else if (this._structure instanceof Spheres) {
      this._structure.resetColor(vec4.fromValues(color.r, color.g, color.b, color.a));
    }
  }

  public setBinColor(binIndex: number, color: GPUColorDict): void {
    const c = vec4.fromValues(color.r, color.g, color.b, color.a);

    if (this._structure instanceof ContinuousTube) {
      this.setBinColorVec4(binIndex, c);
    } else if (this._structure instanceof Spheres) {
      this._binsColor[binIndex] = c;
      this._structure.setColor(binIndex, c);
    }
  }

  public setBinColorVec4(binIndex: number, color: vec4): void {
    if (this._structure instanceof ContinuousTube) {
      this._binsColor[binIndex] = color;

      if (binIndex == 0) {
        this._structure.setColor(color, 0);
        this._structure.setColor2(color, 0);
        this._structure.setColor(color, 1);
      } else if (binIndex >= this._binsPositions.length - 1) {
        this._structure.setColor2(color, binIndex);
        
        this._structure.setColor(color, binIndex + 1);
        this._structure.setColor2(color, binIndex + 1);
      }  else {
        this._structure.setColor2(color, binIndex);
        this._structure.setColor(color, binIndex + 1);
      }
    } else if (this._structure instanceof Spheres) {
      this._binsColor[binIndex] = color;
      this._structure.setColor(binIndex, color);
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

  public get highLevelID(): number {
    return this._highLevelID;
  }

  public get chromosomeIndex(): number {
    return this._chromosomeIndex;
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

//~ line plane intersection stuff
type Plane = { n: vec3, p: vec3 };
type Line = { v: vec3, p: vec3 };

export class ChromatinViewport extends Viewport3D {
  public _chromatin: Array<ChromatinPart> = [];
  private maxId = 0;
  private binPositions: vec3[] = [];
  private debugRadius = 5.0;
  private sectionCuts: { intersections: vec3[], planes: Plane[] } = {
    intersections: [],
    planes: []
  }
  // private box: BoundingBox = BoundingBoxEmpty();
  // private yRange = 0;

  //#region
  protected debugDisplay = {
    showBins: true,
    showPlanes: true,
    showIntersections: true
  }
  //#endregion

  constructor(
    graphicsLibrary: GraphicsLibrary,
    canvas: HTMLCanvasElement | null,
    scene: Scene | null = null,
    camera: OrbitCamera | SmoothCamera | null = null) {
    super(graphicsLibrary, canvas, scene, camera);
    // this.calculateSectionCuts();
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
   * @param center - whether the supplied data should be centered around point [0, 0, 0]
   * @param dataId - unique id of the supplied data
   * 
   * @returns created structure
   */
  public addPart(bins: Array<{ x: number, y: number, z: number }>, center = false, dataId: number, chromosomeIndex: number, representation: ChromatinRepresentation, update = true): ChromatinPart {
    const pointsVec3 = bins.map(p => vec3.fromValues(p.x, p.y, p.z));

    this.binPositions = pointsVec3.map(p => vec3.clone(p));

    let highLevelID;
    let structure;
    switch (representation) {
      case ChromatinRepresentation.ContinuousTube: {
        // Double the amount of points
        const newPoints = [];
        newPoints.push(vec3.add(vec3.create(), pointsVec3[0], vec3.sub(vec3.create(), pointsVec3[0], pointsVec3[1])));
        // newPoints.push(vec3.scale(vec3.create(), vec3.add(vec3.create(), pointsVec3[0], pointsVec3[1]), 0.5));

        for (let i = 0; i < pointsVec3.length; i++) {
          newPoints.push(vec3.clone(pointsVec3[i]));
        }

        // newPoints.push(pointsVec3[pointsVec3.length - 1]);
        newPoints.push(vec3.add(vec3.create(), pointsVec3[pointsVec3.length - 1], vec3.sub(vec3.create(), pointsVec3[pointsVec3.length - 1], pointsVec3[pointsVec3.length - 2])));

        [highLevelID, structure] = this._scene.addContinuousTube(CHROMATIN_OBJECT_NAME + this.maxId, newPoints, 1.0, null, true, update);
        break;
      }
      case ChromatinRepresentation.Spheres: {
        [highLevelID, structure] = this._scene.addSpheres(CHROMATIN_OBJECT_NAME + this.maxId, pointsVec3, null, null, true, update);
        break;
      }
    }

    this._chromatin.push(new ChromatinPart(
      this,
      structure,
      highLevelID,
      dataId,
      chromosomeIndex,
      this.binPositions,
    ));

    this.maxId++;

    // this.calculateSectionCuts();

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

  public getChromatinParts(): Array<ChromatinPart> {
    return this._chromatin;
  }

  public getChromatinPartByChromosomeIndex(chromosomeIndex: number): ChromatinPart | null {
    const chromatinPartIndex = this._chromatin.findIndex(v => v.chromosomeIndex == chromosomeIndex);

    return this._chromatin[chromatinPartIndex];
  }

  public closestIntersectionBin(screenSpacePosition: { x: number, y: number }): ChromatinIntersection | null {
    // console.time('ChromatinIntersection::closestIntersectionBin');
    const closestIntersection = this.closestIntersection(vec2.fromValues(screenSpacePosition.x, screenSpacePosition.y));

    if (closestIntersection == null) {
      // console.timeEnd('ChromatinIntersection::closestIntersectionBin');
      return null;
    }

    const chromatinPart = this._chromatin.find(chromatinPart => chromatinPart.highLevelID == closestIntersection.highLevelIndex);

    if (chromatinPart == undefined) {
      // console.timeEnd('ChromatinIntersection::closestIntersectionBin');
      return null;
    }

    const binIndex = chromatinPart.lowLevelIndexToBinIndex(closestIntersection);

    if (binIndex == null) {
      // console.timeEnd('ChromatinIntersection::closestIntersectionBin');
      return null;
    }

    // console.timeEnd('ChromatinIntersection::closestIntersectionBin');

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
      lookAtPosition: { x: 0.0, y: 0.0, z: 0.0 }
    }
  }

  //#region SECTION CUTS INTERSECTIONS

  public set showDebugPlanes(show: boolean) {
    this.debugDisplay.showPlanes = show;
    if (!show) { this.hidePlanes(); } else { this.displayPlanes(this.sectionCuts.planes); }
  }
  public get showDebugPlanes(): boolean {
    return this.debugDisplay.showPlanes;
  }

  public set showDebugBins(show: boolean) {
    this.debugDisplay.showBins = show;
    if (!show) { this.hideBins(); } else { this.displayBins(this.binPositions); }
  }
  public get showDebugBins(): boolean {
    return this.debugDisplay.showBins;
  }

  public set showDebugIntersections(show: boolean) {
    this.debugDisplay.showIntersections = show;
    if (!show) { this.hideIntersections(); } else { this.displayIntersections(this.sectionCuts.intersections); }
  }
  public get showDebugIntersections(): boolean {
    return this.debugDisplay.showIntersections;
  }

  protected linePlaneIntersection(line: Line, plane: Plane): vec3 {
    //~ line.v = l, line.p =  l_0
    //~ plane.n = n, plane.p = p_0

    if (vec3.dot(line.v, plane.n) === 0) { //~ parallel
      return vec3.fromValues(NaN, NaN, NaN);
    }

    // d = ((p_0 - l_0) * n) / l * n;
    const temp = vec3.create();
    vec3.sub(temp, plane.p, line.p);
    const d = vec3.dot(temp, plane.n) / vec3.dot(line.v, plane.n);

    // p = l_0 + l * d;
    const scaled = vec3.create();
    vec3.scale(scaled, line.v, d);
    const p = vec3.create();
    vec3.add(p, line.p, scaled);

    return p;
  }

  protected isBetween(p: vec3, a: vec3, b: vec3): boolean {
    const vecA = vec3.create();
    const vecB = vec3.create();
    vec3.sub(vecA, a, p);
    vec3.sub(vecB, b, p);

    const dotproduct = vec3.dot(vecA, vecB);

    if (dotproduct < 0.0) {
      return false;
    }

    const squaredlengthba = Math.sqrt(vec3.dist(a, b));
    if (dotproduct > squaredlengthba) {
      return false;
    }

    return true;
  }

  protected isBetween2(p: vec3, a: vec3, b: vec3): boolean {

    const vecA = vec3.create();
    const vecB = vec3.create();
    const vecAtoB = vec3.create();
    vec3.sub(vecA, a, p);
    vec3.sub(vecB, b, p);
    vec3.sub(vecAtoB, b, a);

    const distToA = vec3.length(vecA);
    const distToB = vec3.length(vecB);
    const distAB = vec3.length(vecAtoB);

    if (distToA + distToB - distAB <= 0.1) {
      // if (distToA + distToB - distAB <= Number.EPSILON) {
      return true;
    }

    return false;
  }

  protected generateCutPlanes(binPositions: vec3[], planesNum: number): Plane[] {
    //~ calculate bounding box 
    const bb = BoundingBoxEmpty();
    for (const point of binPositions) {
      BoundingBoxExtendByPoint(bb, point);
    }

    //~ generate n planes along the bounding box y-axis
    const planes: Plane[] = [];
    const maxY = bb.max[1];
    const minY = bb.min[1];
    const yRange = maxY - minY;
    const offset = yRange / planesNum;
    for (let i = 0; i < planesNum; i++) {
      const p = { n: vec3.fromValues(0, 1, 0), p: vec3.fromValues(0, minY + i * offset, 0) };
      planes.push(p);
    }

    return planes;
  }

  protected prepareLinesAndSegments(): [Line[], { a: vec3, b: vec3 }[]] {
    const allLines: Line[] = [];
    const allLineSegments: { a: vec3, b: vec3 }[] = [];
    for (let i = 0; i < (this.binPositions.length - 1); i++) {
      const a = this.binPositions[i];
      const b = this.binPositions[i + 1];
      const lineVec = vec3.create();
      vec3.sub(lineVec, b, a);

      const v = vec3.create();
      vec3.normalize(v, lineVec);
      const p = a;
      allLines.push({ v: v, p: p });
      allLineSegments.push({ a: a, b: b });
    }
    return [allLines, allLineSegments];
  }

  protected computePlaneLineSegmentIntersections(planes: Plane[], lines: Line[], lineSegments: { a: vec3, b: vec3 }[]): vec3[] {
    const intersections: vec3[] = [];
    for (let i = 0; i < planes.length; i++) {
      for (let j = 0; j < lines.length; j++) {
        const intersecPoint = this.linePlaneIntersection(lines[j], planes[i]);

        if (isNaN(intersecPoint[0]) || isNaN(intersecPoint[1]) || isNaN(intersecPoint[2])) {
          continue;
        }
        const lineSeg = lineSegments[j];
        const A = lineSeg.a;
        const B = lineSeg.b;

        //~ check if intersection is in line segment
        if (this.isBetween2(intersecPoint, A, B)) {
          intersections.push(intersecPoint);
        }
      }
    }
    return intersections;
  }

  protected displayBins(binPositions: vec3[], sphereRadius = 5.0): void {
    const radii = Array(binPositions.length).fill(sphereRadius);
    const colors = Array(binPositions.length).fill(vec4.fromValues(0, 1, 1, 1));
    this._scene.addSpheres("bins", binPositions, radii, colors);
  }

  protected displayPlanes(planes: Plane[], sphereRadius = 5.0): void {
    const radii = Array(planes.length).fill(sphereRadius);
    const colors = Array(planes.length).fill(vec4.fromValues(1, 0, 1, 1));
    const positions = planes.map(plane => plane.p);
    this._scene.addSpheres("planes", positions, radii, colors);

  }

  protected displayIntersections(intersections: vec3[], sphereRadius = 5.0): void {
    const radii = Array(intersections.length).fill(sphereRadius);
    const colors = Array(intersections.length).fill(vec4.fromValues(1, 1, 0, 1));
    this._scene.addSpheres("intersections", intersections, radii, colors);

  }

  protected hideBins(): void {
    this._scene.removeStructureByName("bins", true);
  }

  protected hidePlanes(): void {
    this._scene.removeStructureByName("planes", true);
  }

  protected hideIntersections(): void {
    this._scene.removeStructureByName("intersections", true);
  }

  public calculateSectionCuts(): void {
    // create n slices along the ortogonal axes
    const planes = this.generateCutPlanes(this.binPositions, 10);

    //~ create list of lines from the chromain data (points in sequence)
    const [allLines, allLineSegments] = this.prepareLinesAndSegments();

    //~ test each slice (= plane) with each line (between two consecutive points of the chromatin)
    const intersections = this.computePlaneLineSegmentIntersections(planes, allLines, allLineSegments);

    //~ add some marks to the scene
    // this.displayBins(this.binPositions, this.debugRadius);
    // this.displayPlanes(planes, this.debugRadius);
    // this.displayIntersections(intersections, this.debugRadius);

    this.sectionCuts.intersections = intersections;
    this.sectionCuts.planes = planes;
  }

  //# endregion
}
