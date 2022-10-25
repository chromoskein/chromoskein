import { Dispatch } from "react";
import { ConfigurationAction, ConfigurationState, DistanceViewportConfiguration, SelectionsTrack } from "../../../modules/storage/models/viewports";
import * as GraphicsModule from "../../../modules/graphics";
import { SelectionAction, SelectionState } from "../../../modules/storage/models/selections";
import { DataAction, DataState } from "../../../modules/storage/models/data";
import { useConfiguration } from "../../hooks";

export function SASATrack(props: {
    graphicsLibrary: GraphicsModule.GraphicsLibrary,
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
    track: SelectionsTrack
}): JSX.Element {
    // Configuration/Data
    const configurationReducer = useConfiguration<DistanceViewportConfiguration>(props.configurationID, props.configurationsReducer);

    const [data, dataDispatch] = props.dataReducer;
    const [allSelections, allSelectionsDispatch] = props.selectionsReducer;
    const [configuration, updateConfiguration] = configurationReducer;


    // let maxSasa = 0;
    // let normalizedSasaValues = null;
    // let xSize = 0;
    // if (sasaValues[viewport.currentLoD] && tracksBlock) {
    //     maxSasa = Math.max(...sasaValues[viewport.currentLoD]);
    //     normalizedSasaValues = sasaValues[viewport.currentLoD].map(v => (v / maxSasa));
    //     xSize = tracksBlock.width / normalizedSasaValues.length;
    // }

    return (<div>selections track</div>);
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