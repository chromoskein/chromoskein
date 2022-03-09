import { Dispatch } from "react";
import { binToGenomicCoordinate } from "../../modules/coordniatesUtils";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { BinPositionsData, DataAction, DataState } from "../../modules/storage/models/data";
import { ConfigurationAction, ConfigurationState } from "../../modules/storage/models/viewports";
import { useConfigurationTypeless } from "../hooks";

export function CoordinatePreview(props: {
    coordinatePreviewReducer: [CoordinatePreviewState, React.Dispatch<CoordinatePreviewAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    style?: React.CSSProperties

}) {
    const [coordinatePreview, dispatchCoordinatePreview] = props.coordinatePreviewReducer;
    const [data, dispatchData] = props.dataReducer;
    if (!coordinatePreview.visible) {
        return <></>
    }

    const dataModel = data.data.filter(d => d.id == coordinatePreview.dataId)[0];
    if (!dataModel) {
        return <></>
    }

    if (dataModel.type == '3d-positions') {
        const dataModel3d = dataModel as BinPositionsData;
        const [genomicFrom, genomicTo] = binToGenomicCoordinate(coordinatePreview.from, dataModel3d.basePairsResolution)
        return <div style={props.style}>Bin: {coordinatePreview.from} (Genomic: {genomicFrom} - {genomicTo})</div>

    }

    return <></>

}