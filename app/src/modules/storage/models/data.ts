import { Newtype, iso } from 'newtype-ts'
import { NodeModel } from "@minoru/react-dnd-treeview";
import { vec3 } from 'gl-matrix';

//#region Data Description
export type Dense1DData = Array<number>;
export type Sparse1DTextData = Array<{
  from: number, to: number, name: string
}>
export type Sparse1DNumericData = Array<{
  from: number, to: number, value: number
}>
export type SparseDistanceMatrix = Array<{ from: number, to: number, distance: number }>;
export type Position3D = { x: number, y: number, z: number }
export type Positions3D = Array<Position3D>;
export type Colors = Array<{ r: number, g: number, b: number, a: number }>


export type BEDAnnotations = Array<BEDAnnotation>
export type BEDAnnotation = {
  chrom: string,
  from: number, to: number,
  attributes: Record<number, string>
}



export type GFF3Annotations = Array<GFF3Annotation>;
export type GFF3Annotation = {
  seqId: string | null, //this is *not* an ID of annotation. 
  from?: number | null, to?: number | null,
  // source?: string,
  // type?: string,
  score?: number | null,
  strand?: "+" | "-" | "?" | "." | null
  // phase?: string
  attributes: Record<string, string[] | undefined>
}


export type DataType =
  Dense1DData
  | Sparse1DTextData
  | Sparse1DNumericData
  | GFF3Annotations
  | BEDAnnotations
  | SparseDistanceMatrix
  | Positions3D
  | Colors;

export type DataTypeName = 'dense-1d-data'
  | 'sparse-1d-data-text'
  | 'sparse-1d-data-numerical'
  | 'gff3-annotation'
  | 'bed-annotation'
  | 'sparse-distance-matrix'
  | '3d-positions'
  | 'colors';

export type DataTreeViewItemType = 'single-data' | 'timeseries';

export interface DataID extends Newtype<{ readonly DataID: unique symbol }, number> { };
export const isoDataID = iso<DataID>();
//#endregion

//#region Reducer
export interface AddData {
  type: DataTypeName;
  name: string;
  values: DataType;
}

export interface Data extends AddData {
  type: DataTypeName;

  id: DataID;
  name: string;

  values: DataType;
}

export interface BinPositionsData extends Data {
  type: '3d-positions';

  values: Positions3D;
  basePairsResolution: number;
  binOffset: number;

  normalizeCenter: vec3;
  normalizeScale: number;

  chromosomes: Array<{
    name: string;
    from: number;
    to: number;
  }>
}

export type DataState = {
  dataMaxId: number;

  data: Array<Data>;
}

export enum DataActionKind {
  ADD_DATA = 'ADD_DATA',
  SET_TREE_DATA = 'SET_TREE_DATA',
  SET = 'SET',
  UPDATE = 'UPDATE',
  REMOVE = 'REMOVE'
}

export type DataActionSetData = {
  type: DataActionKind.SET;

  state: DataState;
};

export type DataActionModifyData = {
  type: DataActionKind.UPDATE;

  id: DataID;
  modifiedDatapoint: Data;
}

export type DataActionDeleteData = {
  type: DataActionKind.REMOVE;
  id: DataID;
}

export type DataActionAddData = {
  type: DataActionKind.ADD_DATA;

  data: AddData;
}


export type DataAction = DataActionSetData | DataActionAddData | DataActionModifyData | DataActionDeleteData;

export function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case DataActionKind.ADD_DATA: {
      const dataMaxID = state.dataMaxId + 1;
      const dataID = isoDataID.wrap(dataMaxID);

      return {
        ...state,
        dataMaxId: dataMaxID,
        data: [...state.data, {
          ...action.data,
          id: dataID,
        }],
      };
    }
    case DataActionKind.SET: {
      return action.state;
    }

    case DataActionKind.REMOVE: {
      const newData = state.data.filter(d => d.id !== action.id);

      return {
        ...state,
        data: newData,
      }
    }

    case DataActionKind.UPDATE: {
      const newData = state.data.map(
        (d) => {
          if (d.id === action.id) {
            return {
              ...action.modifiedDatapoint,
              id: d.id //no touchy the id
            }
          }
          return d;
        }
      )

      return {
        ...state,
        data: newData,
      }

    }


    default: return state;
  }
}
//#endregion
