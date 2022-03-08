import { BoundingBox, BoundingBoxIntersects, Hit, Ray } from "../shared";
import { vec3 } from "gl-matrix";
import { LinearImmutableArray } from "../allocators";
import { LL_STRUCTURE_SIZE_BYTES } from "../primitives/shared";
import { Node, intersectPrimitive, NODE_SIZE, BOUNDING_BOX_SIZE } from "./shared";
import { NodeIsLeaf } from ".";
import { CullObject } from "../culling";

/**
 * This structure represents a BVH with a list of nodes and primitives indices.
 * The memory layout is such that the children of a node are always grouped together.
 * This means that each node only needs one index to point to its children, as the other
 * child can be obtained by adding one to the index of the first child. The root of the
 * hierarchy is located at index 0 in the array of nodes.
 */
export class BoundingVolumeHierarchy {
    nodes: Array<Node> = [];
    bboxes: Array<BoundingBox> = [];
    nodeCount = 0;
    primitives: DataView | null = null;

    // Given a node index, returns the index of its sibling.
    sibling(index: number): number {
        // assert(index != 0);

        return index % 2 == 1 ? index + 1 : index - 1;
    }

    // Returns true if the given node is the left sibling of another.
    is_left_sibling(index: number): boolean {
        // assert(index != 0);

        return index % 2 == 1;
    }

    closestIntersection(ray: Ray, cullObjects: Array<CullObject> = []): Hit | null {
        let closestHit: [number, number] = [-1, -1];

        if (!this.primitives) {
            return null;
        }

        const invRayDirection = vec3.inverse(vec3.create(), ray.direction);
        const invRay = new Ray(ray.origin, invRayDirection);

        const nodesToIntersect = [this.nodes[0]];
        while (nodesToIntersect.length > 0) {
            const node = nodesToIntersect.pop();

            if (!node) {
                break;
            }

            // Check ray against BVH node
            if (BoundingBoxIntersects(node.boundingBox, invRay)) {
                if (NodeIsLeaf(node)) {
                    for (let i = 0; i < node.primitiveCount; ++i) {
                        const primitiveIndex = this.bboxes[node.firstChildOrPrimitive + i].primitive;

                        const intersection = intersectPrimitive(this.primitives, ray, primitiveIndex, cullObjects);
                        if ((intersection > 0.0 && intersection < closestHit[1]) || (intersection > 0.0 && closestHit[1] < 0.0)) {
                            closestHit = [primitiveIndex, intersection];
                        }
                    }
                } else {
                    nodesToIntersect.push(this.nodes[node.firstChildOrPrimitive]);
                    nodesToIntersect.push(this.nodes[node.firstChildOrPrimitive + 1]);
                }
            }
        }

        if (closestHit[0] == -1 || closestHit[1] == -1) {
            return null;
        }

        return {
            ray,
            distance: closestHit[1],

            lowLevelIndex: closestHit[0], 
            highLevelIndex: this.primitives.getInt32(closestHit[0] * LL_STRUCTURE_SIZE_BYTES + 120, true) 
        };
    }

    allIntersections(ray: Ray): Array<Hit> {
        const hits: Array<[number, number]> = [];

        const primitives = this.primitives;

        if (!primitives) {
            return [];
        }

        const invRayDirection = vec3.inverse(vec3.create(), ray.direction);
        const invRay = new Ray(ray.origin, invRayDirection);

        const nodesToIntersect = [this.nodes[0]];
        while (nodesToIntersect.length > 0) {
            const node = nodesToIntersect.pop();

            if (!node) {
                break;
            }

            // Check ray against BVH node
            if (BoundingBoxIntersects(node.boundingBox, invRay)) {
                if (NodeIsLeaf(node)) {
                    for (let i = 0; i < node.primitiveCount; ++i) {
                        const primitiveIndex = this.bboxes[node.firstChildOrPrimitive + i].primitive;

                        const intersection = intersectPrimitive(primitives, ray, primitiveIndex);
                        if (intersection > 0.0) {
                            hits.push([primitiveIndex, intersection]);
                        }
                    }
                } else {
                    nodesToIntersect.push(this.nodes[node.firstChildOrPrimitive]);
                    nodesToIntersect.push(this.nodes[node.firstChildOrPrimitive + 1]);
                }
            }
        }

        // Sort intersection front-to-back
        const intersections = hits.sort((a, b) => a[1] - b[1]);

        return intersections.map((hit) => { return { ray, distance: hit[1], lowLevelIndex: hit[0], highLevelIndex: primitives.getInt32(hit[0] * LL_STRUCTURE_SIZE_BYTES + 120, true) }; });
    }

    toGPUArrays(nodesBuffer: LinearImmutableArray, bboxesBuffer: LinearImmutableArray): void {
        // let buffer = new ArrayBuffer(this.nodeCount * NODE_SIZE_BYTES);
        // console.time('buildBVH::toGPUArrays');
        {
            const i32View = nodesBuffer.i32View;
            const f32View = nodesBuffer.f32View;

            let offset = 0;
            for (let i = 0; i < this.nodeCount; i++) {
                const node = this.nodes[i];
                f32View.set([
                    node.boundingBox.min[0],
                    node.boundingBox.min[1],
                    node.boundingBox.min[2],
                    0.0,
                    node.boundingBox.max[0],
                    node.boundingBox.max[1],
                    node.boundingBox.max[2],
                    0.0
                ], offset);
                i32View.set([node.firstChildOrPrimitive, node.primitiveCount, node.axis], offset + 8);

                offset += NODE_SIZE;
            }
        }

        {
            const i32View = bboxesBuffer.i32View;
            const f32View = bboxesBuffer.f32View;

            let offset = 0;
            for (const bbox of this.bboxes) {
                f32View.set([
                    bbox.min[0],
                    bbox.min[1],
                    bbox.min[2],
                    0.0,
                    bbox.max[0],
                    bbox.max[1],
                    bbox.max[2],
                    0.0
                ], offset);
                i32View.set([bbox.primitive], offset + 3);

                offset += BOUNDING_BOX_SIZE;
            }
        }
        // console.timeEnd('buildBVH::toGPUArrays');

        nodesBuffer.setModifiedBytes({ start: 0, end: NODE_SIZE * this.nodeCount });
        bboxesBuffer.setModifiedBytes({ start: 0, end: BOUNDING_BOX_SIZE * this.bboxes.length });
    }
}
