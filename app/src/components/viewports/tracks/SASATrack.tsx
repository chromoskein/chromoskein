import { Dispatch, useMemo, useRef } from "react";
import { ConfigurationAction, ConfigurationState, DistanceViewportConfiguration, SASATrack, SelectionsTrack } from "../../../modules/storage/models/viewports";
import * as GraphicsModule from "../../../modules/graphics";
import { SelectionAction, SelectionState } from "../../../modules/storage/models/selections";
import { DataAction, DataState } from "../../../modules/storage/models/data";
import { useConfiguration } from "../../hooks";
import { sasaVec3 } from "../../../modules/sasa";
import { vec3 } from "gl-matrix";
import { quantile } from "simple-statistics";

export function SASATrack(props: {
    graphicsLibrary: GraphicsModule.GraphicsLibrary,
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
    track: SASATrack,
    viewport: GraphicsModule.DistanceViewport,
}): JSX.Element {
    // Configuration/Data
    const configurationReducer = useConfiguration<DistanceViewportConfiguration>(props.configurationID, props.configurationsReducer);

    const trackContainer = useRef<HTMLDivElement>(null);

    const [data, dataDispatch] = props.dataReducer;
    const [configuration, updateConfiguration] = configurationReducer;

    const sasaValues = useMemo(() => {
        const allPositions = props.viewport.positionsCPU;
        const positions = allPositions.slice(0, props.viewport.globals.sizes[0]).map(v => vec3.fromValues(v[0], v[1], v[2]));

        const distances = [];
        for (let i = 0; i < positions.length - 1; i++) {
            distances.push(vec3.distance(positions[i], positions[i + 1]));
        }

        const quantiles = quantile(distances, [0.05, 0.85]);
        const iqr = quantiles[1] - quantiles[0];
        const low = quantiles[0] - 1.5 * iqr;
        const high = quantiles[1] + 1.5 * iqr;

        const radius = 0.5 * (low + high);

        const globalSasaValues: Array<number[]> = [sasaVec3(positions, {
            method: 'constant',
            probe_size: radius,
        }, 36, 0.0)];

        for(let lod = 1; lod < 32; lod++) {
            const size = props.viewport.globals.sizes[lod];
            if (size === 0) {
                break;
            }

            const values = [];
            for(let i = 0; i < size; i++) {
                const j = i;

                if (i == size - 1 && props.viewport.globals.sizes[lod - 1] % 2 !== 0) {
                    values.push((globalSasaValues[lod-1][j] + globalSasaValues[lod-1][j + 1] + globalSasaValues[lod-1][j + 2]) * 0.33);
                    break;
                } else {
                    values.push((globalSasaValues[lod-1][j] + globalSasaValues[lod-1][j + 1]) * 0.5);
                }                            
            }

            globalSasaValues.push(values);
        }          
        
        return globalSasaValues.map(a => a.map(v => v * 40));
    }, [props.viewport.positionsCPU, props.viewport.globals.sizes]);

    const currentSasaValues = useMemo(() => {
        return sasaValues[Math.max(props.viewport.currentLoD - 3, 0)];
    }, [sasaValues, props.viewport.currentLoD]);

    const width = trackContainer?.current ? trackContainer.current.clientWidth : 0;
    const xSize = trackContainer?.current ? trackContainer.current.clientWidth / currentSasaValues.length : 0;

    // console.log(currentSasaValues, width, xSize);

    return (<div className="track track-sasa" style={{ pointerEvents: 'all' }} ref={trackContainer}>
        <svg style={{}} width="100%" height={"40px"} viewBox={"0 0 " + width.toString() + " 40"}>
            <path fill="none" stroke="lightblue" strokeWidth={"2"}
                d={"" + currentSasaValues.map((v, i) => { return (i == 0 ? "M" : " L") + (i * xSize).toString() + "," + (38 - v).toString(); })}
            />
        </svg>
    </div>);
}