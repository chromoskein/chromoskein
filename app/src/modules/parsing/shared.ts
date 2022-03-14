import Papa, { parse } from "papaparse";
import { ChromatinModel, parsePdb } from "./parsePDB";
// import gff from "@gmod/gff";
import { toNumber } from "lodash";
import { vec3 } from "gl-matrix";

export const enum FileType {
    PDB,
    CSV,
}

export const enum CSVDelimiter {
    Comma = ',',
    Tabulator = '\t',
    Space = ' ',
}

export const enum FileState {
    NoFile,
    ParseError,
    Downloading,
    Parsing,
    Done,
}

export type ParsePDBConfiguration = { type: FileType.PDB };
export type ParseCSVConfiguration = {
    type: FileType.CSV, delimiter: CSVDelimiter,
    hasHeader: boolean,
};

export type ParseConfiguration = ParsePDBConfiguration | ParseCSVConfiguration;

export type ParseResultType = 'CSV' | 'PDB';
export type ParseResult = ParseResultCSV | ParseResultPDB;
export interface IParseResult {
    type: ParseResultType;
}

export interface ParseResultCSV extends IParseResult {
    type: 'CSV';

    columns: Array<string | number>;
    rows: Array<Record<string, string>>;
}

export interface ParseResultPDB extends IParseResult {
    type: 'PDB';
    atoms: Array<{ x: number, y: number, z: number }>;

    normalizeCenter: vec3;
    normalizeScale: number;

    ranges: Array<{ name: string, from: number, to: number }>;
}

export function fileStateToText(state: FileState): string {
    switch (state) {
        case FileState.NoFile: return "No file is selected";
        case FileState.ParseError: return "There was an unknown error during parsing";
        case FileState.Downloading: return "Downloading file";
        case FileState.Parsing: return "File is being parsed";
        case FileState.Done: return "Parsing has completed";
    }
}

export function parseToRows(content: string, config: ParseConfiguration): Array<ParseResult> {
    switch (config.type) {
        case FileType.PDB: return parsePDBToObjects(content, config as ParsePDBConfiguration);
        case FileType.CSV: return [parseCSVToObjects(content, config as ParseCSVConfiguration)];
    }
}

function parsePDBToObjects(content: string, config: ParsePDBConfiguration): Array<ParseResultPDB> {
    const parsed = parsePdb(content);

    return parsed.map((p: ChromatinModel) => {
        return {
            type: 'PDB',

            atoms: p.atoms,

            normalizeCenter: p.normalizeCenter,
            normalizeScale: p.normalizeScale,
            ranges: p.ranges,
        }
    });
}

function parseCSVToObjects(content: string, config: ParseCSVConfiguration): ParseResultCSV {
    const result: ParseResultCSV = {
        type: 'CSV',

        columns: [],
        rows: [],
    };

    let delimiter;
    const header = config.hasHeader;
    switch (config.delimiter) {
        case CSVDelimiter.Comma: delimiter = ','; break;
        case CSVDelimiter.Space: delimiter = ' '; break;
        case CSVDelimiter.Tabulator: delimiter = '\t'; break;
    }

    const papaResults = Papa.parse(content, {
        delimiter,
        header,
    });

    if (header && papaResults.meta['fields']) {
        result.columns = papaResults.meta['fields'];
    } else {
        const row = papaResults.data[0] as Array<unknown>;
        result.columns = Array.from({ length: row.length }, (_, i) => i + 1);
    }

    if (header) {
        for (let i = 0; i < papaResults.data.length; i++) {
            result.rows.push(papaResults.data[i] as unknown as Record<string, string>);
        }
    } else {
        for (let i = 0; i < papaResults.data.length; i++) {
            const row = papaResults.data[i] as Array<unknown>;
            const entries = new Map<string, string>();
            for (let i = 0; i < row.length; i++) {
                const value = row[i];
                entries.set(String(i + 1), String(value));
            }
            result.rows.push(Object.fromEntries(entries));
        }
    }

    return result;
}

export function parseResultToXYZ(parseResult: ParseResultCSV, columns: Array<string | number>): Array<{ x: number, y: number, z: number }> {
    const positions: Array<{ x: number, y: number, z: number }> = [];

    for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];
        positions.push({
            x: parseFloat(row[columns[0]]),
            y: parseFloat(row[columns[1]]),
            z: parseFloat(row[columns[2]])
        });
    }

    return positions;
}

export function parseResultToSparse1D(parseResult: ParseResultCSV, columns: Array<string | number>): Array<{ from: number, to: number, value: number }> {
    const data: Array<{ from: number, to: number, value: number }> = [];

    for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];
        data.push({
            from: parseFloat(row[columns[0]]),
            to: parseFloat(row[columns[1]]),
            value: parseFloat(row[columns[2]])
        });
    }

    return data;
}

export function parseResultToSparseDistanceMatrix(parseResult: ParseResultCSV, columns: Array<string | number>): Array<{ from: number, to: number, distance: number }> {
    const data: Array<{ from: number, to: number, distance: number }> = [];

    for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];
        data.push({
            from: parseFloat(row[columns[0]]),
            to: parseFloat(row[columns[1]]),
            distance: parseFloat(row[columns[2]])
        });
    }

    return data;
}




//todo: screw the lib and rewrite
// export function parseGFF(content: string): Array<{
//     seqId: string | null,
//     from?: number | null, to?: number | null,
//     score?: number | null,
//     strand?: "+" | "-" | "?" | "." | null
//     attributes: Record<string, string[] | undefined>
// }> {
//     const annotations = gff.parseStringSync(content);

//     const parsedAnnotations = [];

//     for (const annotation of annotations) {

//         if (!(Symbol.iterator in Object.values(annotation))) {
//             continue;
//         }
//         for (const feature of annotation) {
//             parsedAnnotations.push({
//                 seqId: feature.seq_id,
//                 from: feature.start,
//                 to: feature.end,
//                 score: feature.score,
//                 strand: feature.strand as "+" | "-" | "?" | "." | null,
//                 attributes: feature.attributes ?? {}
//             })

//         }
//     }

//     return parsedAnnotations;
// }

export type ParseResultBED = Array<{
    chromosome: string,
    from: number, to: number,
    attributes: Record<number, string>
}>

export function parseBED(content: string, delimiter: CSVDelimiter.Space | CSVDelimiter.Tabulator): ParseResultBED {

    const parseResults = parseCSVToObjects(content, {
        type: FileType.CSV,
        hasHeader: false,
        delimiter: delimiter
    }) as ParseResultCSV;

    const annotations = parseResults.rows.filter(r => r[1] != "browser" && r[1] != "track" && Object.keys(r).length != 1)

    return annotations.map(
        a => {
            return {
                chromosome: a[1],
                from: toNumber(a[2]),
                to: toNumber(a[3]),
                attributes: a,
                ...a
            }
        }
    );
}