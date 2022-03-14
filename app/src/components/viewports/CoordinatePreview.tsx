import { Separator, Stack, Text } from "@fluentui/react";
import { identity } from "lodash";
import { Dispatch, useRef, useState } from "react";
import { useDimensionsRef, useMouse, useWindowSize } from "rooks";
import { binToGenomicCoordinate } from "../../modules/coordniatesUtils";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { BinPositionsData, DataAction, DataState, Sparse1DTextData, Sparse1DNumericData } from "../../modules/storage/models/data";
import { ConfigurationAction, ConfigurationState } from "../../modules/storage/models/viewports";
import { useConfigurationTypeless, useResizeObserverRef } from "../hooks";

export function CoordinatePreview(props: {
    coordinatePreviewReducer: [CoordinatePreviewState, React.Dispatch<CoordinatePreviewAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    style?: React.CSSProperties

}) {
    const [coordinatePreview, dispatchCoordinatePreview] = props.coordinatePreviewReducer;
    const [data, dispatchData] = props.dataReducer;
    const { clientX, clientY } = useMouse();
    const [contentBoxSize, setContentBoxSize] = useState({
        blockSize: 0,
        inlineSize: 0
    })
    const [ref] = useResizeObserverRef((e, a) => setContentBoxSize(e[0]?.devicePixelContentBoxSize[0] ?? { blockSize: 0, inlineSize: 0 }));


    if (!coordinatePreview.visible || coordinatePreview.dataId == null) {
        return <></>
    }

    const dataModel = data.data.filter(d => d.id == coordinatePreview.dataId)[0];
    if (!dataModel) {
        return <></>
    }

    const renderMapped = (genomicFrom: number, genomicTo: number) => {
        const valueRender = [];
        for (const mappedId of coordinatePreview.mappingIds) {
            const mappedData = data.data.find(d => d.id == mappedId);
            if (!mappedData) {
                continue
            }
            if (mappedData.type != 'sparse-1d-data-text' && mappedData.type != 'sparse-1d-data-numerical') {
                throw `No representation for data type ${mappedData.type}`
            }

            valueRender.push(<Separator></Separator>)

            if (mappedData.type == 'sparse-1d-data-text') {
                const data1d = mappedData.values as Sparse1DTextData
                for (const txtValue of data1d.filter(v => v.from <= genomicTo && v.to >= genomicFrom)) {
                    valueRender.push(<Text>{mappedData.name}:  {txtValue.name} </Text>)
                }
            }
            if (mappedData.type == 'sparse-1d-data-numerical') {
                const data1d = mappedData.values as Sparse1DNumericData
                for (const txtValue of data1d.filter(v => v.from <= genomicTo && v.to >= genomicFrom)) {
                    valueRender.push(<Text>{mappedData.name}:  {txtValue.value} </Text>)
                }
            }
        }
        return valueRender;
    }
    // shift element if out of window
    let horizontalShift = (clientX ?? 0);
    let verticalShift = (clientY ?? 0);
    const elementWidth = contentBoxSize.inlineSize
    const elementHeight = contentBoxSize.blockSize
    if (elementWidth + horizontalShift >= (innerWidth ?? 0)) {
        horizontalShift -= elementHeight;
    }
    if (elementHeight + verticalShift >= (innerHeight ?? 0)) {
        verticalShift -= elementHeight;
    }

    if (dataModel.type == '3d-positions') {
        const dataModel3d = dataModel as BinPositionsData;
        const [genomicFrom, genomicTo] = binToGenomicCoordinate(coordinatePreview.from, dataModel3d.basePairsResolution)
        return <div ref={ref} className="coordinatePreview" style={{ ...props.style, top: verticalShift, left: horizontalShift }}>
            <Stack tokens={{ childrenGap: '4px', padding: '8px' }}>
                <Text style={{ fontWeight: 600 }}>Chromosome: {coordinatePreview.chromosomeName} | Bin: {coordinatePreview.from} | Genomic: {genomicFrom} - {genomicTo} </Text>
                {...renderMapped(genomicFrom, genomicTo)}
            </Stack>
        </div>

    }

    return <></>

}