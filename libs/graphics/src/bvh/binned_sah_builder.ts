/// This is a top-down, classic binned SAH BVH builder. It works by approximating
/// the SAH with bins of fixed size at every step of the recursion.
/// See "On fast Construction of SAH-based Bounding Volume Hierarchies",
/// by I. Wald.

import { Node, NodeEmpty } from "./shared";
import { BoundingBox, BoundingBoxClone, BoundingBoxDiagonal, BoundingBoxEmpty, BoundingBoxExtendByBox, BoundingBoxHalfArea, BoundingBoxLargestAxis } from "../shared";
import { vec3 } from "gl-matrix";
import { partition } from "lodash";
import { cylinderToBoundingBox, LL_STRUCTURE_SIZE, LL_STRUCTURE_SIZE_BYTES, LowLevelStructure, roundedConeToBoundingBox, sphereToBoundingBox } from "../primitives";
import { ArrayViews } from "../allocators";
import { quadraticBezierToBoundingBox } from "../primitives/quadratic_bezier";

const binCount = 3;
const maxDepth = 64;
const maxLeafSize = 16;

class Bin {
    bbox: BoundingBox = BoundingBoxEmpty();
    primitiveCount = 0;
    rightCost = 0;
}

export type BVHResult = {
    nodes: Array<Node>;
    bboxes: Array<BoundingBox>;
    nodeCount: number;
};

export function buildBVHBinnedSAH(
    bboxes: Array<BoundingBox>,
    global_bbox: BoundingBox,
): BVHResult {
    const primitiveCount = bboxes.length;

    const nodes = new Array(2 * primitiveCount + 1);
    let nodeCount = 1;

    nodes[0] = NodeEmpty();
    nodes[0].boundingBox = BoundingBoxClone(global_bbox);

    const binsPerAxis = new Array(3);
    for (let i = 0; i < 3; i++) {
        binsPerAxis[i] = new Array(binCount);
        for (let j = 0; j < binCount; j++) {
            binsPerAxis[i][j] = new Bin();
        }
    }

    const findSplit = (axis: number): [number, number] => {
        const bins = binsPerAxis[axis];

        // Right sweep to compute partial SAH
        let current_bbox = BoundingBoxEmpty();
        let current_count = 0;
        for (let i = binCount - 1; i > 0; --i) {
            current_bbox = BoundingBoxExtendByBox(current_bbox, bins[i].bbox);
            current_count += bins[i].primitiveCount;
            bins[i].rightCost = BoundingBoxHalfArea(current_bbox) * current_count;
        }

        // Left sweep to compute full cost and find minimum
        current_bbox = BoundingBoxEmpty();
        current_count = 0;
        let best_split: [number, number] = [Number.MAX_VALUE, binCount];
        for (let i = 0; i < binCount - 1; +i++) {
            current_bbox = BoundingBoxExtendByBox(current_bbox, bins[i].bbox);
            current_count += bins[i].primitiveCount;
            const cost = BoundingBoxHalfArea(current_bbox) * current_count + bins[i + 1].rightCost;
            if (cost < best_split[0]) {
                best_split = [cost, i + 1];
            }
        }

        return best_split;
    }

    const build = (node: Node, begin: number, end: number, depth: number): void => {
        const makeLeaf = function (node: Node, begin: number, end: number) {
            node.firstChildOrPrimitive = begin;
            node.primitiveCount = end - begin;
        }

        const workSize = end - begin;
        if (workSize <= 1 || depth >= maxDepth) {
            makeLeaf(node, begin, end);
            return;
        }

        const bestSplits: Array<[number, number]> = new Array(3);

        const bbox = node.boundingBox;
        const centerToBin: vec3 = vec3.scale(vec3.create(), vec3.inverse(vec3.create(), BoundingBoxDiagonal(bbox)), binCount);
        const binOffset: vec3 = vec3.mul(vec3.create(), bbox.min, vec3.negate(vec3.create(), centerToBin));

        const computeBinIndex = (center: vec3, axis: number) => {
            const binIndex = center[axis] * centerToBin[axis] + binOffset[axis];
            return Math.min(binCount - 1, Math.round(Math.max(0, binIndex)));
        }

        // Setup bins
        for (let axis = 0; axis < 3; axis++) {
            for (const bin of binsPerAxis[axis]) {
                bin.bbox = BoundingBoxEmpty();
                bin.primitiveCount = 0;
            }
        }

        // Fill bins with primitives
        for (let i = begin; i < end; ++i) {
            const bbox = bboxes[i];
            for (let axis = 0; axis < 3; ++axis) {
                const bin = binsPerAxis[axis][computeBinIndex(bbox.center, axis)];
                bin.primitiveCount += 1;
                BoundingBoxExtendByBox(bin.bbox, bbox);
            }
        }

        for (let axis = 0; axis < 3; axis++) {
            bestSplits[axis] = findSplit(axis);
        }

        let bestAxis = 0;
        if (bestSplits[0][0] > bestSplits[1][0]) {
            bestAxis = 1;
        }

        if (bestSplits[bestAxis][0] > bestSplits[2][0]) {
            bestAxis = 2;
        }

        let splitIndex = bestSplits[bestAxis][1];

        // Make sure the cost of splitting does not exceed the cost of not splitting
        const max_split_cost = BoundingBoxHalfArea(node.boundingBox) * (workSize - 1);
        if (bestSplits[bestAxis][1] == binCount || bestSplits[bestAxis][0] >= max_split_cost) {
            if (workSize > maxLeafSize) {
                // Fallback strategy: approximate median split on largest axis
                bestAxis = BoundingBoxLargestAxis(node.boundingBox);
                for (let i = 0, count = 0; i < binCount - 1; ++i) {
                    count += binsPerAxis[bestAxis][i].primitiveCount;
                    // Split when we reach 0.4 times the number of primitives in the node
                    if (count >= (workSize * 2 / 5 + 1)) {
                        splitIndex = i + 1;
                        break;
                    }
                }
            } else {
                makeLeaf(node, begin, end);
                return;
            }
        }

        const indicesSlice = bboxes.slice(begin, end);

        const [leftSplit, rightSplit] = partition(indicesSlice, (bbox: BoundingBox) => {
            return computeBinIndex(bbox.center, bestAxis) < splitIndex;
        });

        for (let i = 0; i < leftSplit.length; i++) {
            bboxes[begin + i] = leftSplit[i];
        }
        for (let i = 0; i < rightSplit.length; i++) {
            bboxes[begin + leftSplit.length + i] = rightSplit[i];
        }

        const beginRight = (begin + leftSplit.length);

        // Check that the split does not leave one side empty
        if (beginRight > begin && beginRight < end) {
            const firstChild = nodeCount;
            nodeCount += 2;

            nodes[firstChild + 0] = NodeEmpty();
            nodes[firstChild + 1] = NodeEmpty();

            const left = nodes[firstChild + 0];
            const right = nodes[firstChild + 1];

            node.firstChildOrPrimitive = firstChild;
            node.primitiveCount = 0;
            node.axis = bestAxis;

            // Compute the bounding boxes of each node
            const bins = binsPerAxis[bestAxis];
            const leftBbox = BoundingBoxEmpty();
            const rightBbox = BoundingBoxEmpty();
            for (let i = 0; i < bestSplits[bestAxis][1]; ++i) {
                BoundingBoxExtendByBox(leftBbox, bins[i].bbox);
            }
            for (let i = splitIndex; i < binCount; ++i) {
                BoundingBoxExtendByBox(rightBbox, bins[i].bbox);
            }
            left.boundingBox = BoundingBoxClone(leftBbox);
            right.boundingBox = BoundingBoxClone(rightBbox);

            build(left, begin, beginRight, depth + 1);
            build(right, beginRight, end, depth + 1);

            return;
        }

        makeLeaf(node, begin, end);
        return;
    }

    build(nodes[0], 0, primitiveCount, 0);

    return {
        nodes,
        bboxes,
        nodeCount,
    }
}

const ctx: Worker = self as any;

ctx.onmessage = ({ data: { objectsBuffer } }) => {
    if (!objectsBuffer) {
        ctx.postMessage({
            result: {
                nodes: null,
                bboxes: null,
                nodeCount: 0,
            },
        });

        return;
    }
    
    const arrayViews: ArrayViews = {
        data: objectsBuffer,
        f32View: new Float32Array(objectsBuffer, objectsBuffer.byteOffset),
        i32View: new Int32Array(objectsBuffer, objectsBuffer.byteOffset),
        u32View: new Uint32Array(objectsBuffer, objectsBuffer.byteOffset),
    };

    const objectsCount = objectsBuffer.byteLength / LL_STRUCTURE_SIZE_BYTES;

    let objectNumber = 0;
    const bboxes = [];
    const global_bbox = BoundingBoxEmpty();
    
    for (let i = 0; i < objectsCount; i++) {
        const objectOffsetWords = i * LL_STRUCTURE_SIZE;
        const objectOffsetBytes = i * LL_STRUCTURE_SIZE_BYTES;

        const partOfBVH = arrayViews.i32View[objectOffsetWords + 29];
        const objectType = arrayViews.i32View[objectOffsetWords + 31];

        if (objectType != LowLevelStructure.None && partOfBVH) {
            switch (objectType) {
                case LowLevelStructure.Sphere: bboxes.push(sphereToBoundingBox(arrayViews, i)); break;
                case LowLevelStructure.Cylinder: bboxes.push(cylinderToBoundingBox(objectsBuffer, i)); break;
                case LowLevelStructure.RoundedCone: bboxes.push(roundedConeToBoundingBox(arrayViews, i)); break;
                case LowLevelStructure.QuadraticBezierCurve: bboxes.push(quadraticBezierToBoundingBox(arrayViews, i)); break;
                default: continue;
            }

            bboxes[objectNumber].primitive = i;
            BoundingBoxExtendByBox(global_bbox, bboxes[objectNumber]);

            objectNumber++;
        }
    }

    const result = buildBVHBinnedSAH(bboxes, global_bbox);

    ctx.postMessage({
        result: result,
    });
};
