import { DataID } from "./data"

export type CoordinatePreviewType = "bin-coordinates-single" | "bin-coordinates-pair"

export type CoordinatePreviewState = {
    type: CoordinatePreviewType,

    dataId?: DataID,
    visible: boolean,
    from: number,
    to: number,
}


export type CoordinatePreviewAction = {
    type?: CoordinatePreviewType,
    dataId?: DataID,
    visible?: boolean,
    from?: number,
    to?: number,
}


export function coordinatePreviewReducer(state: CoordinatePreviewState, action: CoordinatePreviewAction): CoordinatePreviewState {
    return {
        ...state,
        ...action
    }
}