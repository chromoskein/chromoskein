import { DetailsList, DetailsListLayoutMode, IColumn, Separator, Stack, Text } from "@fluentui/react";
import { identity } from "lodash";
import { Dispatch, useRef, useState } from "react";
import { useDimensionsRef, useMouse, useWindowSize } from "rooks";
import { binToGenomicCoordinate } from "../../modules/coordniatesUtils";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { BinPositionsData, DataAction, DataState, Sparse1DTextData, Sparse1DNumericData } from "../../modules/storage/models/data";
import { ConfigurationAction, ConfigurationState } from "../../modules/storage/models/viewports";
import { useConfigurationTypeless, useResizeObserverRef } from "../hooks";
import './Viewports.scss'
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

    const getMappedDataMap = (chromosome: string, genomicFrom: number, genomicTo: number) => {
        const dataMap = new Map<string, { values: string[], type: 'text' | 'numeric' }>();
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
                const subMap = new Map<string, { values: string[], type: 'text' | 'numeric' }>();
                for (const txtValue of data1d.filter(v => v.chromosome == chromosome && v.from <= genomicTo && v.to >= genomicFrom)) {
                    if (!subMap.has(mappedData.name)) {
                        subMap.set(mappedData.name, { values: [txtValue.name], type: 'text' })
                    } else {
                        subMap.get(mappedData.name)!.values.push(txtValue.name);
                    }
                }

                if (coordinatePreview.textAggregation == 'none') {
                    for (const [key, value] of subMap) {
                        dataMap.set(key, value);
                    }
                }
                if (coordinatePreview.textAggregation == 'count') {
                    // count per one array in subMap
                    const countMap = new Map<string, number>();
                    for (const [key, value] of subMap) {
                        countMap.set(key, value.values.length);
                    }
                    for (const [key, value] of countMap) {
                        dataMap.set(`${key} - Count`, { values: [value.toString()], type: 'numeric' })
                    }
                }
            }
            if (mappedData.type == 'sparse-1d-data-numerical') {
                const subMap = new Map<string, { values: string[], type: 'text' | 'numeric' }>();
                const data1d = mappedData.values as Sparse1DNumericData
                const processNumber = (num: number) => Math.round(num * 100) / 100;
                for (const numValue of data1d.filter(v => v.chromosome == chromosome && v.from <= genomicTo && v.to >= genomicFrom)) {
                    if (!subMap.has(mappedData.name)) {
                        subMap.set(mappedData.name, { values: [processNumber(numValue.value).toString()], type: 'numeric' })
                    } else {
                        subMap.get(mappedData.name)!.values.push(processNumber(numValue.value).toString());
                    }
                }

                //sorry about the mess and repetition, playing around with github coopilot :)
                if (coordinatePreview.numericAggregation == 'none') {
                    for (const [key, value] of subMap) {
                        dataMap.set(key, value);
                    }
                }
                if (coordinatePreview.numericAggregation == 'mean') {
                    //for individual array in subMap
                    const meanMap = new Map<string, number>();
                    for (const [key, value] of subMap) {
                        const sum = value.values.reduce((a, b) => a + parseFloat(b), 0);
                        meanMap.set(key, sum / value.values.length);
                    }
                    for (const [key, value] of meanMap) {
                        dataMap.set(`${key} - Mean`, { values: [value.toString()], type: 'numeric' })
                    }
                }
                if (coordinatePreview.numericAggregation == 'median') {
                    // for individual array in subMap
                    const medianMap = new Map<string, number>();
                    for (const [key, value] of subMap) {
                        const sorted = value.values.sort((a, b) => parseFloat(a) - parseFloat(b));
                        medianMap.set(key, parseFloat(sorted[Math.floor(sorted.length / 2)]));
                    }
                    for (const [key, value] of medianMap) {
                        dataMap.set(`${key} - Median`, { values: [value.toString()], type: 'numeric' })
                    }
                }
                if (coordinatePreview.numericAggregation == 'max') {
                    // for individual array in subMap
                    const maxMap = new Map<string, number>();
                    for (const [key, value] of subMap) {
                        maxMap.set(key, Math.max(...value.values.map(v => parseFloat(v))));
                    }
                    for (const [key, value] of maxMap) {
                        dataMap.set(`${key} - Max`, { values: [value.toString()], type: 'numeric' })
                    }

                }
                if (coordinatePreview.numericAggregation == 'min') {
                    // for individual array in subMap
                    const minMap = new Map<string, number>();
                    for (const [key, value] of subMap) {
                        minMap.set(key, Math.min(...value.values.map(v => parseFloat(v))));
                    }
                    for (const [key, value] of minMap) {
                        dataMap.set(`${key} - Min`, { values: [value.toString()], type: 'numeric' })
                    }
                }
                if (coordinatePreview.numericAggregation == 'sum') {
                    // for individual array in subMap
                    const sumMap = new Map<string, number>();
                    for (const [key, value] of subMap) {
                        const sum = value.values.reduce((a, b) => a + parseFloat(b), 0);
                        sumMap.set(key, sum);
                    }
                    for (const [key, value] of sumMap) {
                        dataMap.set(`${key} - Sum`, { values: [value.toString()], type: 'numeric' })
                    }
                }
            }
        }
        return dataMap
    }

    const renderMapped = (dataMap: Map<string, { values: string[], type: 'text' | 'numeric' }>) => {

        return <table style={{}}>
            {/* row for every data map key */}
            {Array.from(dataMap.keys()).map((key, i) => {
                return <>
                    {i != 0 && <Separator className="table-separator"></Separator>}
                    <tr>
                        <td style={{ verticalAlign: 'top', paddingRight: '12px' }}>{key}</td>
                        <td> {dataMap.get(key)!.values.map(value => <p>{value}</p>)}</td>
                    </tr>
                </>
            })}
        </table>

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
        const mappedData = getMappedDataMap(coordinatePreview.chromosomeName, genomicFrom, genomicTo);

        return <div ref={ref} className="coordinatePreview" style={{ ...props.style, top: verticalShift, left: horizontalShift }}>
            <Stack tokens={{ childrenGap: '4px', padding: '8px' }}>
                <Text style={{ fontWeight: 600 }}>Chromosome: {coordinatePreview.chromosomeName} | Bin: {coordinatePreview.from} | Genomic: {genomicFrom} - {genomicTo} </Text>

                {mappedData.size > 0
                    ? <>
                        <Separator></Separator>
                        {renderMapped(mappedData)}
                    </>
                    : <></>
                }
            </Stack>
        </div>

    }

    return <></>

}