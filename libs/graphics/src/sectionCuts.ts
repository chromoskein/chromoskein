import { vec2, vec3, vec4, quat } from "gl-matrix";
import { BoundingBox, BoundingBoxEmpty, BoundingBoxExtendByPoint } from "./shared";

//~ line plane intersection stuff
export type Plane = { n: vec3, p: vec3 };
export type Line = { v: vec3, p: vec3 };

function linePlaneIntersection(line: Line, plane: Plane): vec3 {
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

function isBetween(p: vec3, a: vec3, b: vec3): boolean {
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

function isBetween2(p: vec3, a: vec3, b: vec3): boolean {

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

export class SectionCuts {
    public intersections: vec3[] = [];
    public planes: Plane[] = [];

    // public binPositions: vec3[] = [];

    constructor() {}

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

    protected prepareLinesAndSegments(binPositions: vec3[]): [Line[], { a: vec3, b: vec3 }[]] {
        const allLines: Line[] = [];
        const allLineSegments: { a: vec3, b: vec3 }[] = [];
        for (let i = 0; i < (binPositions.length - 1); i++) {
            const a = binPositions[i];
            const b = binPositions[i + 1];
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
                const intersecPoint = linePlaneIntersection(lines[j], planes[i]);

                if (isNaN(intersecPoint[0]) || isNaN(intersecPoint[1]) || isNaN(intersecPoint[2])) {
                    continue;
                }
                const lineSeg = lineSegments[j];
                const A = lineSeg.a;
                const B = lineSeg.b;

                //~ check if intersection is in line segment
                if (isBetween2(intersecPoint, A, B)) {
                    intersections.push(intersecPoint);
                }
            }
        }
        return intersections;
    }

    public calculateSectionCuts(binPositions: vec3[]): void {
        // create n slices along the ortogonal axes
        const planes = this.generateCutPlanes(binPositions, 10);

        //~ create list of lines from the chromain data (points in sequence)
        const [allLines, allLineSegments] = this.prepareLinesAndSegments(binPositions);

        //~ test each slice (= plane) with each line (between two consecutive points of the chromatin)
        const intersections = this.computePlaneLineSegmentIntersections(planes, allLines, allLineSegments);

        //~ add some marks to the scene
        // this.displayBins(this.binPositions, this.debugRadius);
        // this.displayPlanes(planes, this.debugRadius);
        // this.displayIntersections(intersections, this.debugRadius);

        this.intersections = intersections;
        this.planes = planes;
    }

}
