import { vec3 } from "gl-matrix";

const createKDTree = require("static-kdtree");

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

function generate_sphere_points(point_count: number): Array<Positions3D> {
    const sphere_points: Array<Positions3D> = [];
    const increment = Math.PI * (3.0 - Math.sqrt(5.0));
    const offset = 2.0 / point_count;

    for (let i = 0; i < point_count; i++) {
        const y = i * offset - 1.0 + (offset / 2.0);
        const r = Math.sqrt(1.0 - y * y);
        const phi = i * increment;

        sphere_points.push({
            x: Math.cos(phi) * r,
            y: y,
            z: Math.sin(phi) * r
        })
    }
    return sphere_points;
}

function generate_constant_radii(bin_count: number, constant: number): Array<number> {
    const radii = Array(bin_count);
    radii.fill(constant);
    return radii;
}

function generate_approximate_radii(bin_positions: Array<Positions3D>): Array<number> {
    return [];
}


type RadiusConfiguration = ConstantRadiusConfiguration | GeneratedRadiusConfiguration;

type ConstantRadiusConfiguration = {
    method: 'constant',
    probe_size: number,
}

type GeneratedRadiusConfiguration = {
    method: 'generated',
    probe_size: number
}

/**
* @param bin_positions 
* @param bin_radii - radius of the atoms including the probe TODO: visual guidance by visualizing the radius in 3D?
* @param accuracy - higher number results in slower but more accurate calculation
*/
export function sasa(bin_positions: Array<Positions3D>, bin_radii_configuration: RadiusConfiguration, accuracy: number): Array<number> {

    let bin_radii: Array<number> = []
    if (bin_radii_configuration.method == 'constant') {
        bin_radii = Array(bin_positions.length);
        bin_radii.fill(bin_radii_configuration.probe_size);
    }

    if (bin_radii_configuration.method == 'generated') {
        bin_radii = generate_approximate_radii(bin_positions);
    }

    const bin_count = bin_positions.length;
    const sphere_points = generate_sphere_points(accuracy);
    const magic_constant = 4 * Math.PI / accuracy;
    const accessible_areas: Array<number> = [];

    const tree = createKDTree(bin_positions.map(p => [p.x, p.y, p.z]));

    for (let bin_i = 0; bin_i < bin_count; bin_i++) {
        const bin_position = bin_positions[bin_i];
        const bin_radius = bin_radii[bin_i];
        accessible_areas[bin_i] = 0;

        // const neighbor_indices: Array<number> = [];
        // for (let neighbor_i = 0; neighbor_i < bin_count; neighbor_i++) {
        //     if (bin_i == neighbor_i) {
        //         continue;
        //     }
        //     const neighbor_position = bin_positions[neighbor_i];
        //     const distance = positions_map(bin_position, neighbor_position, (a, b) => a - b);
        //     const distance2 = positions_map(distance, distance, (a, b) => a * b)
        //     const bin_neighbor_magnitute = distance2.x + distance2.y + distance2.z;
        //     if (bin_neighbor_magnitute < 0) {
        //         debugger;
        //     }

        //     const neighbor_radius = bin_radii[neighbor_i];

        //     const radius_cutoff = (bin_radius + neighbor_radius) * (bin_radius + neighbor_radius);

        //     if (bin_neighbor_magnitute < radius_cutoff) {
        //         neighbor_indices.push(neighbor_i);

        //     }

        //     if (bin_neighbor_magnitute < 1e-10) {
        //         console.warn(`Distance between ${neighbor_position} and ${bin_position} is ${bin_neighbor_magnitute} (less then 1e-10) - result might be jank.`);
        //     }
        // }
        const neighbor_indices: number[] = tree.knn([bin_position.x, bin_position.y, bin_position.z], 20);

        const centered_sphere_points: Array<Positions3D> = []
        for (let sphere_i = 0; sphere_i < accuracy; sphere_i++) {
            const sphere_position = sphere_points[sphere_i];
            centered_sphere_points.push({
                x: bin_position.x + bin_radius * sphere_position.x,
                y: bin_position.y + bin_radius * sphere_position.y,
                z: bin_position.z + bin_radius * sphere_position.z
            })
        }

        let closest_neighbor_i = 0;
        for (let sphere_i = 0; sphere_i < accuracy; sphere_i++) {
            let is_accessible = true;
            const sphere_position = centered_sphere_points[sphere_i];
            for (let close_neighbor_i = closest_neighbor_i; close_neighbor_i < closest_neighbor_i + neighbor_indices.length; close_neighbor_i++) {
                const close_neighbor_real = close_neighbor_i % neighbor_indices.length;
                const neighbor_i = neighbor_indices[close_neighbor_real]
                const neighbor_radius = bin_radii[neighbor_i];

                const distance = positions_map(sphere_position, bin_positions[neighbor_i], (a, b) => a - b);
                const distance2 = positions_map(distance, distance, (a, b) => a * b);
                const magnitude = distance2.x + distance2.y + distance2.z;

                if (magnitude < neighbor_radius * neighbor_radius) {
                    closest_neighbor_i = close_neighbor_i;
                    is_accessible = false;
                    break;
                }
            }
            if (is_accessible) {
                accessible_areas[bin_i]++;
            }
        }

        accessible_areas[bin_i] *= magic_constant * bin_radii[bin_i] * bin_radii[bin_i];
    }

    return accessible_areas;
} 

/**
* @param bin_positions 
* @param bin_radii - radius of the atoms including the probe TODO: visual guidance by visualizing the radius in 3D?
* @param accuracy - higher number results in slower but more accurate calculation
*/
export function sasaVec3(bin_positions: Array<vec3>, bin_radii_configuration: RadiusConfiguration, accuracy: number, probe_size: number): Array<number> {
    if (bin_radii_configuration.method != "constant") return [];

    console.time('sasa');

    const radius = bin_radii_configuration.probe_size;
    // const radius_cutoff = radius + radius;

    console.log(radius);

    const tree = createKDTree(bin_positions);

    const bin_count = bin_positions.length;
    const sphere_points = generate_sphere_points(accuracy);
    const magic_constant = (4 * Math.PI * radius * radius) / accuracy;
    const accessible_areas: Array<number> = [];

    for (let bin_i = 0; bin_i < bin_count; bin_i++) {
        const bin_position = bin_positions[bin_i];
        accessible_areas[bin_i] = 0;

        // const neighbor_indices: Array<number> = [];
        // for (let neighbor_i = 0; neighbor_i < bin_count; neighbor_i++) {
        //     if (bin_i == neighbor_i) {
        //         continue;
        //     }

        //     const neighbor_position = bin_positions[neighbor_i];
        //     const distance = vec3.sub(vec3.create(), bin_position, neighbor_position);
        //     const distance2 = vec3.mul(vec3.create(), distance, distance);
        //     const bin_neighbor_magnitute = distance2[0] + distance2[1] + distance2[2];

        //     if (bin_neighbor_magnitute < (radius + radius) * (radius + radius)) {
        //         neighbor_indices.push(neighbor_i);
        //     }
        // }
        // console.log(neighbor_indices);
        const neighbor_indices: number[] = tree.knn(bin_position, 20);

        // console.log(neighbor_indices);

        const centered_sphere_points: Array<vec3> = [];
        for (let sphere_i = 0; sphere_i < accuracy; sphere_i++) {
            const sphere_position = sphere_points[sphere_i];
            centered_sphere_points.push(vec3.fromValues(
                bin_position[0] + radius * sphere_position.x,
                bin_position[1] + radius * sphere_position.y,
                bin_position[2] + radius * sphere_position.z,
            ))
        }

        let closest_neighbor_i = 0;
        for (let sphere_i = 0; sphere_i < accuracy; sphere_i++) {
            let is_accessible = true;
            const sphere_position = centered_sphere_points[sphere_i];
            for (let close_neighbor_i = closest_neighbor_i; close_neighbor_i < closest_neighbor_i + neighbor_indices.length; close_neighbor_i++) {
                const close_neighbor_real = close_neighbor_i % neighbor_indices.length;
                const neighbor_i = neighbor_indices[close_neighbor_real];

                const distance = vec3.sub(vec3.create(), sphere_position, bin_positions[neighbor_i]);
                const distance2 = vec3.mul(vec3.create(), distance, distance);
                const magnitude = distance2[0] + distance2[1] + distance2[2];

                if (magnitude < radius * radius) {
                    closest_neighbor_i = close_neighbor_i;
                    is_accessible = false;
                    break;
                }
            }
            if (is_accessible) {
                accessible_areas[bin_i]++;
            }
        }

        accessible_areas[bin_i] = accessible_areas[bin_i] / accuracy;
    }

    console.timeEnd('sasa');

    return accessible_areas;
} 