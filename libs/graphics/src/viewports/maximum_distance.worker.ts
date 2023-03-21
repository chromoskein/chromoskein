import { vec4 } from "gl-matrix";
import { Globals } from "./distance_viewport";

const ctx: Worker = self as any;

export type MaximumDistanceInput = {
    globals: Globals,
    positions: Array<vec4>,
}

ctx.onmessage = (event: MessageEvent<MaximumDistanceInput>) => {
    const globals: Globals = event.data.globals;
    const positions: Array<vec4> = event.data.positions;

    console.log(globals, positions);

    // LoD 0
    let currentLoD = 0;
    globals.sizes[0] = positions.length;
    globals.offsets[0] = 0;

    let topMaximumDistance = 0.0;
    for (let i = 0; i < globals.sizes[0]; i++) {
        for (let j = i + 1; j < globals.sizes[0]; j++) {
            const v1 = positions[i];
            const v2 = positions[j];

            const distance = vec4.squaredDistance(v1, v2);

            if (distance > topMaximumDistance) {
                topMaximumDistance = distance;
            }
        }
    }

    globals.maxDistances[0] = Math.sqrt(topMaximumDistance);

    // LoD 1+
    let currentSize = globals.sizes[0];
    let evenStrategy = true;
    while (currentSize > 1) {
        currentLoD += 1;

        let newSize = 0;
        if (currentSize % 2 == 0) {
            newSize = Math.floor(currentSize / 2);
        } else {
            newSize = evenStrategy ? Math.floor(currentSize / 2) : Math.floor(currentSize / 2) + 1;
        }

        const currentOffset = globals.offsets[currentLoD - 1];

        const end = (currentSize % 2 == 0) ? newSize : newSize - 1;
        for (let i = 0; i < end; i++) {
            const newPosition = vec4.add(vec4.create(), positions[currentOffset + i * 2], positions[currentOffset + i * 2 + 1]);
            vec4.scale(newPosition, newPosition, 0.5);

            positions.push(newPosition);
        }

        if (currentSize % 2 !== 0) {
            const offset = globals.sizes[currentLoD - 1] + globals.offsets[currentLoD - 1] - 1;

            if (evenStrategy) {
                const newPosition = vec4.add(vec4.create(), positions[offset - 2], positions[offset - 1]);
                vec4.add(newPosition, newPosition, positions[offset]);
                vec4.scale(newPosition, newPosition, 1.0 / 3.0);

                positions.push(newPosition);
            } else {
                positions.push(positions[offset]);
            }

            evenStrategy = !evenStrategy;
        }

        currentSize = newSize;
        globals.sizes[currentLoD] = currentSize;
        globals.offsets[currentLoD] = globals.offsets[currentLoD - 1] + globals.sizes[currentLoD - 1];

        let maximumDistance = 0.0;

        console.time('distanceMap::setPositions::maxDistance');
        const subsetStart = globals.offsets[currentLoD];
        const subsetEnd = globals.offsets[currentLoD] + globals.sizes[currentLoD];
        for (let i = subsetStart; i < subsetEnd; i++) {
            for (let j = i + 1; j < subsetEnd; j++) {
                const v1 = positions[i];
                const v2 = positions[j];

                const distance = vec4.squaredDistance(v1, v2);

                if (distance > maximumDistance) {
                    maximumDistance = distance;
                }
            }
        }
        console.timeEnd('distanceMap::setPositions::maxDistance');

        globals.maxDistances[currentLoD] = Math.sqrt(maximumDistance);
    }

    ctx.postMessage({
        globals,
        positions,
    });
};
