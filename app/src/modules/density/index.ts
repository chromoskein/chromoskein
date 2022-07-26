type Positions3D = {
    x: number,
    y: number,
    z: number
}

function positions_map(pos1: Positions3D, pos2: Positions3D, f: (a: number, b: number) => number) {
    return {
        x: f(pos1.x, pos2.x),
        y: f(pos1.y, pos2.y),
        z: f(pos1.z, pos2.z)
    }
}


function compute_distance(bin1: Positions3D, bin2: Positions3D) {
    const distance = positions_map(bin1, bin2, (a, b) => a - b);
    const distance_squared = positions_map(distance, distance, (a, b) => a * b)
    return distance_squared.x + distance_squared.y + distance_squared.z;
}

export function density(bins: Array<Positions3D>, probe_size: number) {
    const densities: Array<number> = [];
    for (let bin of bins) {
        let bin_density = 0;
        for (let neighbor of bins) {
            if (compute_distance(bin, neighbor) < probe_size) {
                bin_density++;
            }
        }
        densities.push(bin_density);
    }
    return densities;
}