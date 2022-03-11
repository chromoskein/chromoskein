import { Dispatch } from "react";
import { binToGenomicCoordinate } from "../../modules/coordniatesUtils";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { BinPositionsData, DataAction, DataState, Sparse1DTextData, Sparse1DNumericData } from "../../modules/storage/models/data";
import { ConfigurationAction, ConfigurationState } from "../../modules/storage/models/viewports";
import { useConfigurationTypeless } from "../hooks";

export function CoordinatePreview(props: {
    coordinatePreviewReducer: [CoordinatePreviewState, React.Dispatch<CoordinatePreviewAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    style?: React.CSSProperties

}) {
    const [coordinatePreview, dispatchCoordinatePreview] = props.coordinatePreviewReducer;
    const [data, dispatchData] = props.dataReducer;
    if (!coordinatePreview.visible || coordinatePreview.dataId == null) {
        return <></>
    }

    const dataModel = data.data.filter(d => d.id == coordinatePreview.dataId)[0];
    if (!dataModel) {
        return <></>
    }

    const renderMapped = (genomicFrom: number, genomicTo: number) => {
        const mappedPairs = [];
        for (const mappedId of coordinatePreview.mappingIds) {
            const mappedData = data.data.find(d => d.id == mappedId);
            if (!mappedData) {
                continue
            }
            if (mappedData.type != 'sparse-1d-data-text' && mappedData.type != 'sparse-1d-data-numerical') {
                throw `No representation for data type ${mappedData.type}`
            }


            if (mappedData.type == 'sparse-1d-data-text') {
                const data1d = mappedData.values as Sparse1DTextData
                for (const txtValue of data1d.filter(v => v.from <= genomicTo && v.to >= genomicFrom)) {
                    mappedPairs.push(<><span>{mappedData.name}:  {txtValue.name} </span> | </>)
                }
            }
            if (mappedData.type == 'sparse-1d-data-numerical') {
                const data1d = mappedData.values as Sparse1DNumericData
                for (const txtValue of data1d.filter(v => v.from <= genomicTo && v.to >= genomicFrom)) {
                    mappedPairs.push(<><span>{mappedData.name}:  {txtValue.value} </span> | </>)
                }
            }
        }
        return mappedPairs;
    }
    if (dataModel.type == '3d-positions') {
        const dataModel3d = dataModel as BinPositionsData;
        const [genomicFrom, genomicTo] = binToGenomicCoordinate(coordinatePreview.from, dataModel3d.basePairsResolution)
        return <div style={props.style}>Bin: {coordinatePreview.from} (Genomic: {genomicFrom} - {genomicTo}) | {renderMapped(genomicFrom, genomicTo)}</div>

    }

    return <></>

}