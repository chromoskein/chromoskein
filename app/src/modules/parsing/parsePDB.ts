import { vec3 } from "gl-matrix";
import { BoundingBoxEmpty, BoundingBoxExtendByPoint } from "../graphics/shared";

const ATOM_NAME = 'ATOM  ';
const RESIDUE_NAME = 'SEQRES';

export class Atom {
  serial: number | null = null;
  name: string | null = null;
  altLoc: string | null = null;
  resName: string | null = null;
  chainID: string | null = null;
  resSeq: number | null = null; // Also CHROMOSOME
  iCode: string | null = null;
  x: number | null = null;
  y: number | null = null;
  z: number | null = null;
  occupancy: number | null = null;
  tempFactor: number | null = null;
  element: string | null = null;
  charge: string | null = null;
}

export class SeqResEntry {
  serNum: number | null = null;
  chainID: string | null = null;
  numRes: number | null = null;
  resNames: Array<string> = [];
}

export class Residue {
  id: number | null = null;
  serNum: number | null = null;
  chainID: string | null = null;
  resName: string | null = null;
  atoms: Array<Atom> = [];
}

export type ChromatinModel = {
  atoms: Array<{x: number, y: number, z: number}>;
  ranges: Array<{ name: string, from: number, to: number }>;

  normalizeCenter: vec3;
  normalizeScale: number;
};

/**
 * Parses the given PDB string into json
 * @param {String} pdb
 * @returns {Object}
 */
export function parsePdb(pdb: string): Array<ChromatinModel> {
  const pdbLines = pdb.split('\n');
  let atoms: Array<{x: number, y: number, z: number}> = [];

  // Connectivity
  let connectivityBitset: Array<0 | 1> = new Array(pdbLines.length).fill(0);
  let names: Array<string> = [];
  // Iterate each line looking for atoms
  let stop = false;
  pdbLines.forEach((pdbLine) => {
    if (pdbLine.length < 6) {
      return;
    }

    const identification = pdbLine.substring(0, 6);
    if (identification === ATOM_NAME || identification === 'HETATM') {
      if (!stop) {
        atoms.push({
          x: parseFloat(pdbLine.substring(30, 38)),
          y: parseFloat(pdbLine.substring(38, 46)),
          z: parseFloat(pdbLine.substring(46, 54))
        });
      }
      names.push(`chr${pdbLine.substring(17,21).trim()}`)
      // http://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
      // if (!stop) {
      //   atoms.push({
      //     serial: parseInt(pdbLine.substring(6, 11)),
      //     name: pdbLine.substring(12, 16).trim(),
      //     altLoc: pdbLine.substring(16, 17).trim(),
      //     resName: pdbLine.substring(17, 20).trim(),
      //     chainID: pdbLine.substring(21, 22).trim(),
      //     resSeq: parseInt(pdbLine.substring(22, 26)),
      //     iCode: pdbLine.substring(26, 27).trim(),
      //     x: parseFloat(pdbLine.substring(30, 38)),
      //     y: parseFloat(pdbLine.substring(38, 46)),
      //     z: parseFloat(pdbLine.substring(46, 54)),
      //     occupancy: parseFloat(pdbLine.substring(54, 60)),
      //     tempFactor: parseFloat(pdbLine.substring(60, 66)),
      //     element: pdbLine.substring(76, 78).trim(),
      //     charge: pdbLine.substring(78, 80).trim(),
      //   });
      // }
    } else if (identification === 'CONECT') {
      const from = parseInt(pdbLine.substring(6, 11)) - 1;
      const to = parseInt(pdbLine.substring(11, 16)) - 1;

      if (to - from == 1) {
        connectivityBitset[from] = 1;
      }
    } else if (identification === 'ENDMDL') {
      stop = true;
    }
  });

  const ranges: Array<{ name: string, from: number, to: number }> = [];

  connectivityBitset = connectivityBitset.slice(0, atoms.length);
  let expandingRange = false;
  for (let i = 0; i < connectivityBitset.length; i++) {
    const currentValue = connectivityBitset[i];

    if (expandingRange && i == connectivityBitset.length - 1 && currentValue === 1) {
      ranges[ranges.length - 1].to = connectivityBitset.length;
      break;
    }

    if (currentValue === 0 && !expandingRange) continue;
    if (currentValue === 1 && expandingRange) continue;

    if (currentValue === 1 && !expandingRange) {
      // Start new range
      ranges.push({
        name: names[i],
        from: i,
        to: i + 1
      });
      expandingRange = true;
    }

    if (currentValue === 0 && expandingRange) {
      // End the range
      ranges[ranges.length - 1].to = i;
      expandingRange = false;
    }
  }

  // Normalize to [-1.0, 1.0] and center
  // Build bounding box
  const bb = BoundingBoxEmpty();
  let points = atoms.map(v => vec3.fromValues(v.x, v.y, v.z));
  for (const point of points) {
    BoundingBoxExtendByPoint(bb, point);
  }

  points = points.map(v => vec3.sub(vec3.create(), v, bb.center));

  const bbSizeLengthsVec3 = vec3.sub(vec3.create(), bb.max, bb.min);
  const bbSizeLengths = [Math.abs(bbSizeLengthsVec3[0]), Math.abs(bbSizeLengthsVec3[1]), Math.abs(bbSizeLengthsVec3[2])];

  const maxLength = Math.max(...bbSizeLengths);
  const scale = 1.0 / maxLength;

  points = points.map(v => vec3.scale(vec3.create(), v, scale));

  atoms = atoms.map((a, i) => {
    return {
      ...a,
      x: points[i][0],
      y: points[i][1],
      z: points[i][2]
    };
  });

  return [{
    // Raw data from pdb
    atoms,
    // Connectivity
    ranges,
    // Normalize
    normalizeCenter: bb.center,
    normalizeScale: scale
  }];
}
