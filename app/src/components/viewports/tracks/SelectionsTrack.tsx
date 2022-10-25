import { Dispatch, useMemo } from "react";
import * as GraphicsModule from "../../../modules/graphics";
import { ConfigurationAction, ConfigurationState, DistanceViewportConfiguration, SelectionsTrack } from "../../../modules/storage/models/viewports";
import { SelectionAction, SelectionState } from "../../../modules/storage/models/selections";
import { DataAction, DataState } from "../../../modules/storage/models/data";
import { useConfiguration } from "../../hooks";
import { notEmpty } from "../../../modules/utils";

export function SelectionsTrack(props: {
    graphicsLibrary: GraphicsModule.GraphicsLibrary,
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
    track: SelectionsTrack,
    viewport: GraphicsModule.DistanceViewport,
}): JSX.Element {
    // Configuration/Data
    const configurationReducer = useConfiguration<DistanceViewportConfiguration>(props.configurationID, props.configurationsReducer);

    const [data, dataDispatch] = props.dataReducer;
    const [allSelections, allSelectionsDispatch] = props.selectionsReducer;
    const [configuration, updateConfiguration] = configurationReducer;

    const viewport = props.viewport;
    const currentBinsAmount = viewport.sizes[viewport.currentLoD];

    const selections = useMemo(() => props.track.selections.map(selectionID => {
        return allSelections.selections.find(s => s.id == selectionID);
    }).filter(notEmpty), [props.track.selections, allSelections]);

    const selectionsRanges: Array<Array<{
        from: number,
        to: number;
    }>> = useMemo(() => {
        const selectionsRanges: Array<Array<{
            from: number,
            to: number;
        }>> = [];

        for (const selection of selections) {
            if (!selection) continue;

            const selectionRanges: Array<{
                from: number,
                to: number;
            }> = [];

            // Bitset to ranges
            const bins = selection.bins;
            const binsPerBit = Math.pow(2.0, viewport.currentLoD);
            const connectivityBitset: Array<0 | 1> = new Array(viewport.sizes[viewport.currentLoD]).fill(0);
            for (let i = 0; i < connectivityBitset.length; i++) {
                const sliceBegin = i * binsPerBit;
                const sliceEnd = Math.min(i * binsPerBit + binsPerBit, bins.length);

                if (bins.slice(sliceBegin, sliceEnd).reduce((p, c) => (c === 1) || p, false)) {
                    connectivityBitset[i] = 1;
                }
            }
            let expandingRange = false;
            for (let i = 0; i < connectivityBitset.length; i++) {
                const currentValue = connectivityBitset[i];

                if (expandingRange && i == connectivityBitset.length - 1 && currentValue === 1) {
                    selectionRanges[selectionRanges.length - 1].to = connectivityBitset.length;
                    break;
                }

                if (currentValue === 0 && !expandingRange) continue;
                if (currentValue === 1 && expandingRange) continue;

                if (currentValue === 1 && !expandingRange) {
                    // Start new range
                    selectionRanges.push({
                        from: i,
                        to: i + 1
                    });
                    expandingRange = true;
                }

                if (currentValue === 0 && expandingRange) {
                    // End the range
                    selectionRanges[selectionRanges.length - 1].to = i;
                    expandingRange = false;
                }
            }

            selectionsRanges.push(selectionRanges);
        }

        return selectionsRanges;
    }, [viewport.currentLoD, viewport.sizes, selections]);

    const onClick = () => {
        updateConfiguration({
            ...configuration,
            selectedTrackID: props.track.id,
        });
    };

    return <div className="track track-selections" onClick={() => onClick()} style={{pointerEvents: 'all'}}>
        {(selections && selectionsRanges) && selectionsRanges.map((selectionRange, selectionRangeIndex) => {
            if (selections[selectionRangeIndex]) {
                return <div key={selectionRangeIndex} style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(' + currentBinsAmount + ', 1fr)',
                    position: 'absolute'
                }}>
                    {selectionRange.map((range, index) => {
                        return <div key={index} style={{
                            backgroundColor: 'rgb(' + selections[selectionRangeIndex].color.r * 255 + ',' + selections[selectionRangeIndex].color.g * 255 + ',' + selections[selectionRangeIndex].color.b * 255 + ')',
                            gridColumn: (range.from + 1).toString() + ' / ' + (range.to + 1).toString()
                        }}></div>
                    })}
                </div>
            } else { return <div key={selectionRangeIndex}></div> }
        })}
    </div>;
}


// {(selections && selectionsRanges) && selectionsRanges.map((selectionRange, selectionRangeIndex) => {
//     if (selections[selectionRangeIndex] && selections[selectionRangeIndex][1].visible) {
//         return <div key={selectionRangeIndex} style={{
//             width: '100%',
//             height: '8px',
//             display: 'grid',
//             marginTop: '8px',
//             gridTemplateColumns: 'repeat(' + currentBinsAmount + ', 1fr)',
//             position: 'absolute'
//         }}>
//             {selectionRange.map((range, index) => {
//                 return <div key={index} style={{
//                     backgroundColor: 'rgb(' + selections[selectionRangeIndex][0].color.r * 255 + ',' + selections[selectionRangeIndex][0].color.g * 255 + ',' + selections[selectionRangeIndex][0].color.b * 255 + ')',
//                     gridColumn: (range.from + 1).toString() + ' / ' + (range.to + 1).toString()
//                 }}></div>
//             })}
//         </div>
//     } else { return <div key={selectionRangeIndex}></div> }
// })}
// <div style={{width: '100%', height: '40px' }}></div>
// {/* <SparklineChart 
// width={tracksBlock.width} 
// height={80} 
// data={ normalizedSasaValues.map((v, i) => { return { key: i, data: 1.0 - v } as ChartShallowDataShape } ) }>
// </SparklineChart> */}
// {/* <svg style={{marginTop: '40px'}} width={tracksBlock.width.toString()} height={"80"} viewBox={"0 0 " + tracksBlock.width.toString() + " 80"}>
//     <path fill="none" stroke="blue" strokeWidth={"1"}
//         d={"" + normalizedSasaValues.map((v, i) => { return (i == 0 ? "M" : " L") + (i * xSize).toString() + "," + (80 - v).toString(); })}
//     />
// </svg> */}