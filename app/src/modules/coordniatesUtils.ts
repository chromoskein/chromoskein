import { groupBy, range, toNumber } from "lodash";
import { BEDAnnotation, BEDAnnotations, GFF3Annotation, GFF3Annotations, Positions3D, Sparse1DNumericData, Sparse1DTextData } from "./storage/models/data"


export function fromBEDtoSparse1DTextData(annotations: BEDAnnotations, column: number): Sparse1DTextData {
    const nameSelector = (d: BEDAnnotation) => d.attributes[column];

    return annotations
        .filter(d => nameSelector(d) != null)
        .map(d => {
            return {
                chromosome: d.chromosome,
                from: d.from,
                to: d.to,
                name: nameSelector(d) as string // filtered above
            }
        })
}


export function fromBEDtoSparse1DNumericData(annotations: BEDAnnotations, column: number): Sparse1DNumericData {


    const valueSelector = (d: BEDAnnotation) => toNumber(d.attributes[column]);

    return annotations
        .filter(d => {
            const value = valueSelector(d);
            return value != null && !isNaN(value)
        }).map(d => {
            return {
                chromosome: d.chromosome,
                from: d.from,
                to: d.to,
                value: valueSelector(d) as number // filtered above
            }
        })
}


export type GFFSimplificationSettings = {
    nameBy: string | null,
    nameByAttribute: boolean,
    valueBy: string | null,
    valueByAttribute: boolean
}

// export function fromGFF3toSparse1DTextData(annotations: GFF3Annotations, simplification: GFFSimplificationSettings): Sparse1DTextData {
//     const nameBy = simplification.nameBy
//     if (!nameBy) {
//         return [];
//     }

//     const nameSelector = (d: GFF3Annotation) => simplification.nameByAttribute
//         ? (d.attributes[nameBy]?.join(";"))
//         : (d.seqId ?? "")

//     return annotations.filter(d => nameSelector(d) != null && d.from != null && d.to != null)
//         .map(d => {
//             return {
//                 from: d.from!,
//                 to: d.to!,
//                 strand: d.strand ?? ".",
//                 name: nameSelector(d) as string // filtered above
//             }
//         })
// }

// export function fromGFF3toSparse1DNumericData(annotations: GFF3Annotations, simplification: GFFSimplificationSettings): Sparse1DNumericData {
//     const valueBy = simplification.valueBy
//     if (!valueBy) {
//         return [];
//     }

//     const valueSelector = (d: GFF3Annotation) => {
//         const valueArray = d.attributes[valueBy] ?? [];
//         return simplification.valueByAttribute
//             ? toNumber(valueArray[0])
//             : d.score

//     }

//     return annotations.filter(d => valueSelector(d) != null && d.from != null && d.to != null)
//         .map(d => {
//             return {
//                 from: d.from!,
//                 to: d.to!,
//                 strand: d.strand ?? ".",
//                 value: valueSelector(d) as number // filtered above
//             }
//         })
// }

export function simplifySparseBinData(data: Sparse1DNumericData, simplificator: (bin: number[]) => number): Sparse1DNumericData {
    //group values by bin
    const dataByChromosome = groupBy(data, d => d.chromosome);
    const choromsomes = data.map(d => d.chromosome);
    const simplifiedCoodrs: Sparse1DNumericData = []


    for (let chromosome of choromsomes) {
        const coords = new Map<number, number[]>();

        for (const d of dataByChromosome[chromosome]) {
            for (const coord of range(d.from, d.to)) {

                if (coords.has(coord)) {
                    coords.get(coord)?.push(d.value);
                } else {
                    coords.set(coord, [d.value]);
                }

            }
        }

        //recreate sparse data
        //todo? group adjacent to reduce array lenght


        for (const [coord, values] of coords) {
            simplifiedCoodrs.push({
                chromosome: chromosome,
                from: coord,
                to: coord,
                value: simplificator(values)
            })
        }
    }


    return simplifiedCoodrs;
}

export function numericDataGenomicToBinCoordinates(data: Sparse1DNumericData, binResolution: number): Sparse1DNumericData {
    return data.map(a => ({
        ...a,
        from: Math.floor(a.from / binResolution),
        to: Math.floor(a.to / binResolution)
    }))
}

export function textDataGenomicToBinCoordinates(data: Sparse1DTextData, binResolution: number): Sparse1DTextData {
    return data.map(a => ({
        ...a,
        from: Math.floor(a.from / binResolution),
        to: Math.floor(a.to / binResolution)
    }))
}

export function normalizeNumericData(data: Sparse1DNumericData): Sparse1DNumericData {
    const maximum = Math.max(...data.map(a => a.value));
    return data.map(a => ({
        ...a,
        value: a.value / maximum
    }))
}

// Worklofw: numericDataGenomicToBinCoordinates -> normalizeNumericData -> simplifySparseBinDataToDense
export function simplifySparseBinDataToDense(data: Sparse1DNumericData, size: number, simplificator: (bin: number[]) => number, defaultValue = 0.0): Array<number> {
    const simplifiedSparse = simplifySparseBinData(data, simplificator);

    const result = new Array(size).fill(defaultValue);

    for (const datum of simplifiedSparse) {
        result[datum.from] = datum.value;
    }

    return result;
}

export function centromeresPositionsToBins(centromeres: Positions3D, binsPositions: Positions3D): Array<number> {
    const result = [];

    for (const c of centromeres) {
        let minimumIndex = 0;
        let minimumDistance = 100000.0;
        for (const [index, p] of binsPositions.entries()) {
            const diff = { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z };

            const distance = diff.x * diff.x + diff.y * diff.y + diff.z * diff.z;

            if (distance < minimumDistance) {
                minimumIndex = index;
                minimumDistance = distance;
            }
        }

        result.push(minimumIndex);
    }

    return result;
}

export function binToGenomicCoordinate(binNumber: number, binResolution: number): [number, number] {
    return [binNumber * binResolution, (binNumber + 1) * binResolution]
}