import useMouse, { MousePosition } from "@react-hook/mouse-position";
import { vec2, vec4 } from "gl-matrix";
import { Dispatch, useEffect, useRef, useState } from "react";
import { useHoverDirty } from "react-use";
import { useKey, usePreviousImmediate } from "rooks";
import { ConfigurationAction, ConfigurationState, DistanceMapDataConfiguration, DistanceViewportConfiguration, DistanceViewportToolType, Track, TrackType } from "../../modules/storage/models/viewports";
import * as GraphicsModule from "../../modules/graphics";
import { BinPosition, CameraConfigurationType, OrthoCameraConfiguration, squareDiameter } from "../../modules/graphics";
import { SelectionAction, SelectionActionKind, SelectionState } from "../../modules/storage/models/selections";
import { DataAction, DataState, Positions3D } from "../../modules/storage/models/data";
import { useConfiguration, useSelections } from "../hooks";
import { sasa } from "../../modules/sasa";
import { SelectionsTrack } from "./tracks/SelectionsTrack";
import { Dropdown, IDropdownOption } from "@fluentui/react";
import { v4 } from 'uuid';

import './Tracks.css';
import { BreakoutRoom20Filled } from "@fluentui/react-icons";

export function TADViewport(props: {
    graphicsLibrary: GraphicsModule.GraphicsLibrary,
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}): JSX.Element {
    // Configuration/Data
    const configurationReducer = useConfiguration<DistanceViewportConfiguration>(props.configurationID, props.configurationsReducer);

    const [data, dataDispatch] = props.dataReducer;
    const [allSelections, allSelectionsDispatch] = props.selectionsReducer;
    const [configuration, updateConfiguration] = configurationReducer;

    // Canvas
    const canvasElement = useRef(null);
    const [viewport, setViewport] = useState<GraphicsModule.DistanceViewport>(() => props.graphicsLibrary.createDistanceViewport(null));

    const previousConfiguration = usePreviousImmediate(configuration);
    const previousViewport = usePreviousImmediate(viewport);

    // Camera/Input
    const [cameraConfiguration, setCameraConfiguration] = useState<OrthoCameraConfiguration>({
        type: CameraConfigurationType.Ortho,

        zoom: 0.0,
        maxZoom: 0.0,
        translateX: 0.0,
        translateY: 0.0,
    });

    const isBeingHovered = useHoverDirty(canvasElement);
    const mousePosition = useMouse(canvasElement);
    const [lastHeldMousePosition, setLastHeldMousePosition] = useState<MousePosition | null>(null);

    const canvasOnWheel = (event: any) => {
        setCameraConfiguration({
            ...cameraConfiguration,
            zoom: cameraConfiguration.zoom + event.deltaY / 1.0,
        });
    };

    useEffect(() => {
        viewport.cameraConfiguration = cameraConfiguration;
    }, [viewport, cameraConfiguration]);

    const [isControlPressed, setControlPressed] = useState(false);
    const [isAltPressed, setAltPressed] = useState(false);

    useKey(["ControlLeft"], () => setControlPressed(true), { eventTypes: ["keydown"] });
    useKey(["ControlLeft"], () => setControlPressed(false), { eventTypes: ["keyup"] });

    useKey(["AltLeft"], () => setAltPressed(true), { eventTypes: ["keydown"] });
    useKey(["AltLeft"], () => setAltPressed(false), { eventTypes: ["keyup"] });

    // TADs/Selections
    const selections = useSelections([configuration, updateConfiguration], props.dataReducer, props.selectionsReducer, 0);

    // Hovered Bins
    let hoveredBins: BinPosition | null = null;
    let hoveredBinRanges: [[number, number], [number, number]] | null = null;

    // Compute hovered bins
    if (viewport && isBeingHovered && mousePosition && mousePosition.x && mousePosition.y) {
        const hoveredElement = viewport.getHoveredElement(vec2.fromValues(mousePosition.x * window.devicePixelRatio, mousePosition.y * window.devicePixelRatio), viewport.currentLoD);

        hoveredBins = hoveredElement;

        if (hoveredElement && viewport.currentLoD > 0) {
            const newRanges: [[number, number], [number, number]] = [[0, 0], [0, 0]];
            const binsLength = Math.pow(2, viewport.currentLoD);
            for (let i = 0; i <= 1; i++) {
                const from = (i == 0 ? hoveredElement.from : hoveredElement.to) * binsLength;
                const to = Math.min(from + binsLength, viewport.sizes[0]);

                newRanges[i] = [from, to];
            }

            hoveredBinRanges = newRanges;
        } else {
            hoveredBinRanges = null;
        }
    }

    const updatePositions = () => {
        if (!viewport || !viewport.canvas) {
            return;
        }

        if (configuration.data == null) {
            viewport.setPositions([]);
            return;
        }

        if (previousConfiguration
            && previousViewport == viewport
            && previousConfiguration.data
            && previousConfiguration.data.type === DistanceMapDataConfiguration.Data
            && previousConfiguration.data.id === configuration.data.id) {
            return;
        }

        let maxBin = 0;
        if (configuration.data && configuration.data.type === DistanceMapDataConfiguration.Data) {
            const d = data.data.filter(d => d.id === configuration.data!.id).at(0);
            if (!d) {
                return;
            }

            switch (d.type) {
                case 'sparse-distance-matrix': {
                    // TODO: Future
                    break;
                }
                case '3d-positions': {
                    const values = (d.values as Positions3D).positions;
                    maxBin = values.length;

                    const positions = [];
                    for (let i = 0; i < values.length; i++) {
                        positions.push(vec4.fromValues(values[i].x, values[i].y, values[i].z, 1.0));
                    }

                    const globalSasaValues = [sasa(values, {
                        method: 'constant',
                        probe_size: 0.02,
                    }, 100)];

                    viewport.setPositions(positions);

                    // for(let lod = 1; lod < 32; lod++) {
                    //     const size = viewport.globals.sizes[lod];
                    //     if (size === 0) {
                    //         break;
                    //     }

                    //     const offset = viewport.globals.offsets[lod-1];

                    //     const values = [];
                    //     for(let i = 0; i < size; i++) {
                    //         const j = i;

                    //         if (i == size - 1 && viewport.globals.sizes[lod - 1] % 2 !== 0) {
                    //             values.push((globalSasaValues[lod-1][j] + globalSasaValues[lod-1][j + 1] + globalSasaValues[lod-1][j + 2]) * 0.33);
                    //             break;
                    //         } else {
                    //             values.push((globalSasaValues[lod-1][j] + globalSasaValues[lod-1][j + 1]) * 0.5);
                    //         }                            
                    //     }

                    //     globalSasaValues.push(values);
                    //     console.log(globalSasaValues);
                    // }                    

                    // setSasaValues(() => globalSasaValues);

                    break;
                }
            }
        }

        setCameraConfiguration({
            ...cameraConfiguration,
            zoom: 0.5 * (maxBin * 1.4142),
            translateX: (-0.5 * (maxBin * 1.4142)),
            translateY: (-0.5 * (maxBin * 0.7071)),
            maxZoom: (maxBin * 1.4142),
        });
    };

    // remove data removed from data tab
    // useEffect(() => {
    //     if (!configuration.data) return;

    //     const dataWithoutGlobalyRemoved = configuration.data.filter(confD => data.data.find(globalD => confD.id == globalD.id) != undefined);
    //     console.log(data, configuration.data, dataWithoutGlobalyRemoved)

    //     updateConfiguration({
    //         ...configuration,
    //         data: dataWithoutGlobalyRemoved
    //     })
    //     updatePositions();
    // }, [data]);

    //#region Viewport Initialization
    useEffect(() => {
        if (props.graphicsLibrary && canvasElement != null && canvasElement.current) {
            const viewport = props.graphicsLibrary.createDistanceViewport(canvasElement.current);

            setViewport(() => viewport);
            updatePositions();

            // Draw the scene repeatedly
            const render = () => {
                viewport.render();

                requestAnimationFrame(render);
            }
            const requestID = requestAnimationFrame(render);

            return function cleanup() {
                // viewport.deallocate();
                window.cancelAnimationFrame(requestID);
            };
        }
    }, [props.graphicsLibrary, canvasElement]);
    //#endregion

    //#region Data
    useEffect(() => {
        updatePositions();
    }, [viewport, data, configuration.data, allSelections]);
    //#endregion

    //#region Camera
    // - note: all of these must be in this order

    // Mouse movement
    useEffect(() => {
        if (!mousePosition || !lastHeldMousePosition || !mousePosition.clientX || !lastHeldMousePosition.clientX || !mousePosition.clientY || !lastHeldMousePosition.clientY || isControlPressed) return;

        const x = ((mousePosition.clientX - lastHeldMousePosition.clientX) / 500.0) * cameraConfiguration.zoom;
        const y = ((mousePosition.clientY - lastHeldMousePosition.clientY) / 500.0) * cameraConfiguration.zoom;

        setCameraConfiguration({
            ...cameraConfiguration,
            translateX: cameraConfiguration.translateX + x,
            translateY: cameraConfiguration.translateY - y
        });
    }, [lastHeldMousePosition, mousePosition, isControlPressed]);

    // Last positions where mouse was held
    useEffect(() => {
        if (!mousePosition) return;

        if (mousePosition.clientX && mousePosition.clientY && mousePosition.isDown) {
            setLastHeldMousePosition(() => mousePosition);
        } else {
            setLastHeldMousePosition(() => null);
        }
    }, [mousePosition, isControlPressed]);
    //#endregion

    //#region Selections
    // Color selections
    if (configuration.data && configuration.data.type != DistanceMapDataConfiguration.Selection) {

        const colors = [
            vec4.fromValues(1.0, 1.0, 1.0, 1.0),
            vec4.fromValues(1.0, 0.0, 0.0, 1.0)
        ];
        const binsLength = viewport.sizes[0];
        const finalColorIndices = new Uint16Array(binsLength);
        for (let selectionIndex = 0; selectionIndex < selections.length; selectionIndex++) {
            const selection = selections[selectionIndex][0];

            colors.push(vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, selection.color.a));

            const selectionID = configuration.selectedSelectionID;
            const selectedSelectionIndex = selections.findIndex(s => s[0].id == selectionID);

            for (let i = 0; i < binsLength; i++) {
                if (selectedSelectionIndex == selectionIndex && hoveredBins) {
                    const lodUnit = Math.pow(2, viewport.currentLoD);
                    const minFrom = hoveredBins.from * lodUnit;
                    const minTo = hoveredBins.to * lodUnit;

                    if (configuration.tool.type == DistanceViewportToolType.PairSelection) {
                        if (i >= minFrom && i < minFrom + lodUnit) {
                            finalColorIndices[i] = colors.length - 1;
                        }
                        if (i >= minTo && i < minTo + lodUnit) {
                            finalColorIndices[i] = colors.length - 1;
                        }
                    }

                    if (configuration.tool.type == DistanceViewportToolType.TriangleSelection) {
                        if (i >= minFrom && i < minTo + lodUnit) {
                            finalColorIndices[i] = colors.length - 1;
                        }
                    }

                }
            }
        }

        viewport.setColors(colors, finalColorIndices);
    }

    // Add selected bins to selection
    const onClick = () => {
        if (!viewport || !isBeingHovered || !hoveredBins || !isControlPressed || !configuration.data) {
            return;
        }

        const dataID = configuration.data.id;
        const selectionID = configuration.selectedSelectionID;
        const tool = configuration.tool;


        if (selections.length <= 0 || !selectionID) {
            return;
        }

        const selection = selections.filter(s => s[0].id == selectionID)[0][0];
        const newBins: Uint16Array = selection.bins.slice();


        if (tool.type == DistanceViewportToolType.PairSelection) {
            const binsLength = Math.pow(2, viewport.currentLoD);
            for (const bin of [hoveredBins.from, hoveredBins.to]) {
                const from = bin * binsLength;
                const to = from + binsLength;

                for (let i = from; i < to; i++) {
                    newBins[i] = isAltPressed ? 0 : 1;
                }
            }
        }

        if (tool.type == DistanceViewportToolType.TriangleSelection) {
            const binsLength = Math.pow(2, viewport.currentLoD);
            const minFrom = hoveredBins.from * binsLength;
            const maxTo = hoveredBins.to * binsLength + binsLength;
            for (let i = minFrom; i < maxTo; i++) {
                newBins[i] = isAltPressed ? 0 : 1;
            }
        }


        allSelectionsDispatch({ type: SelectionActionKind.UPDATE, id: selection.id, bins: newBins });
    };
    //#endregion

    let currentBinsAmount = 0;
    let tracksBlock: {
        width: number;
        left: number;
        top: number;
    } | null = null;

    if (viewport) {
        currentBinsAmount = viewport.sizes[viewport.currentLoD];
        const currentSquareDiameter = Math.pow(2.0, viewport.currentLoD) * squareDiameter;

        const beginPositionScreenSpace = viewport.worldSpaceToScreenSpace(vec4.fromValues(0.0, 0.0, 0.0, 1.0));
        const endPosition = viewport.worldSpaceToScreenSpace(vec4.fromValues(currentSquareDiameter * currentBinsAmount, 0.0, 0.0, 1.0));

        tracksBlock = {
            width: endPosition[0] - beginPositionScreenSpace[0],
            left: beginPositionScreenSpace[0],
            top: beginPositionScreenSpace[1],
        };
    }

    const tracksDropdownOptions: IDropdownOption[] = [
        { key: TrackType.Selections, text: 'Selections' }
    ];

    const addTrack = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption, index?: number): void => {
        if (!option) return;
        const trackType = option.key as TrackType;

        switch (trackType) {
            case TrackType.Selections: {
                updateConfiguration({
                    ...configuration,
                    tracks: [...configuration.tracks, {
                        id: v4(),
                        type: TrackType.Selections,
                        selections: [],
                    }]
                })
                break;
            }
        }
    };

    // console.log(configuration.tracks);

    return (<div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={onClick}
            onWheel={canvasOnWheel}
        >
        </canvas>
        {(currentBinsAmount > 0 && tracksBlock && !isNaN(tracksBlock.top)) && (<div className={'topDiv'}>
            <div style={{
                width: tracksBlock.width,
                position: 'absolute',
                top: tracksBlock.top,
                left: tracksBlock.left,
                color: 'white',
            }}>
                {configuration.tracks.map((t: Track) => {
                    switch (t.type) {
                        case TrackType.Selections: {
                            return <SelectionsTrack
                                key={t.id}
                                graphicsLibrary={props.graphicsLibrary}
                                configurationID={props.configurationID}
                                configurationsReducer={props.configurationsReducer}
                                dataReducer={props.dataReducer}
                                selectionsReducer={props.selectionsReducer}
                                track={t}
                                viewport={viewport}
                            ></SelectionsTrack>
                        }
                    }
                })}
                <div className="track track-add">
                    <Dropdown
                        placeholder="Select a track to add"
                        label=""
                        options={tracksDropdownOptions}
                        style={{ pointerEvents: 'all', maxWidth: 200, margin: 'auto' }}
                        onChange={addTrack}
                        notifyOnReselect={true}
                    ></Dropdown>
                </div>
            </div>
        </div>)}
    </div>
    );
}
