import { Data, DataID } from "./data"

export type CoordinatePreviewType = "bin-coordinates-single" | "bin-coordinates-pair"
export type TooltipTextAggregation = 'none' | 'count';
export type TooltipNumericAggregation = 'none' | 'min' | 'max' | 'median' | 'mean' | 'sum';

export type CoordinatePreviewState = {
    type: CoordinatePreviewType,

    dataId?: DataID,

    additionalInfo: Array<String>,
    mappingIds: Array<DataID>,
    textAggregation: TooltipTextAggregation,
    numericAggregation: TooltipNumericAggregation,
    visible: boolean,
    from: number,
    chromosomeName: string,
    to: number,
}


export type CoordinatePreviewAction = {
    type?: CoordinatePreviewType,
    dataId?: DataID,
    additionalInfo?: Array<String>,
    mappingIds?: Array<DataID>,
    textAggregation?: TooltipTextAggregation,
    numericAggregation?: TooltipNumericAggregation,
    visible?: boolean,
    from?: number,
    chromosomeName?: string,
    to?: number,
}


export function coordinatePreviewReducer(state: CoordinatePreviewState, action: CoordinatePreviewAction): CoordinatePreviewState {
    return {
        ...state,
        ...action
    }
}