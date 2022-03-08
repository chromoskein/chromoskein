import useMouse, { MousePosition } from "@react-hook/mouse-position";
import { vec2, vec4 } from "gl-matrix";
import React, { Dispatch, Fragment, useEffect, useRef, useState } from "react";
import { useDeepCompareEffect, useHoverDirty, useMouseWheel } from "react-use";
import { useKey, usePrevious, usePreviousImmediate } from "rooks";
import { ConfigurationAction, ConfigurationState, DistanceDataConfiguration, DistanceMapDataConfiguration, DistanceSelectionConfiguration, DistanceViewportConfiguration } from "../../modules/storage/models/viewports";
import * as GraphicsModule from "../../modules/graphics";
import { BinPosition, binsToCenterVec4, CameraConfigurationType, OrthoCameraConfiguration } from "../../modules/graphics";
import { isoSelectionID, SelectionAction, SelectionActionKind, SelectionState } from "../../modules/storage/models/selections";
import { Data, DataAction, DataState, Positions3D } from "../../modules/storage/models/data";
import { useConfiguration, useSelections } from "../hooks";


function groupSubsequentNumbers(array: Array<number>): Array<Array<number>> {
    return array.reduce<Array<Array<number>>>((grouped, next) => {
        const lastSubArray = grouped[grouped.length - 1];

        if (!lastSubArray || lastSubArray[lastSubArray.length - 1] !== next - 1) {
            grouped.push([]);
        }
        grouped[grouped.length - 1].push(next);

        return grouped;
    }, []);
}

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

    // Input
    const isBeingHovered = useHoverDirty(canvasElement);
    const mousePosition = useMouse(canvasElement);
    const [lastHeldMousePosition, setLastHeldMousePosition] = useState<MousePosition | null>(null);

    const mouseScroll = useMouseWheel();
    const previousMouseScroll = usePreviousImmediate(mouseScroll);

    const [isControlPressed, setControlPressed] = useState(false);
    const [isAltPressed, setAltPressed] = useState(false);

    useKey(["ControlLeft"], () => setControlPressed(true), { eventTypes: ["keydown"] });
    useKey(["ControlLeft"], () => setControlPressed(false), { eventTypes: ["keyup"] });

    useKey(["AltLeft"], () => setAltPressed(true), { eventTypes: ["keydown"] });
    useKey(["AltLeft"], () => setAltPressed(false), { eventTypes: ["keyup"] });

    // TADs/Selections
    const selections = useSelections(0, [configuration, updateConfiguration], props.dataReducer, props.selectionsReducer);
    const [hoveredBins, setHoveredBins] = useState<BinPosition | null>(null);
    const [hoveredBinRanges, setHoveredBinRanges] = useState<[[number, number], [number, number]] | null>(null);

    // Annotation
    const [binNumbers, setBinNumbers] = useState<Array<number>>([]);
    const [binGroups, setBinGroups] = useState<Array<Array<number>>>([]);
    const [svgNumbers, setSvgNumbers] = useState<Array<JSX.Element>>([]);



    const updatePositions = () => {
        if (!viewport || !viewport.canvas) {
            return;
        }

        if (configuration.data.length === 0) {
            viewport.setPositions([]);
            return;
        }

        if (previousConfiguration
            && previousViewport == viewport
            && previousConfiguration.data.length > 0
            && previousConfiguration.data[0].type === DistanceMapDataConfiguration.Data
            && previousConfiguration.data[0].id === configuration.data[0]?.id) {
            return;
        }


        let maxBin = 0;
        if (configuration.data[0].type === DistanceMapDataConfiguration.Data) {
            const d = data.data.filter(d => d.id === configuration.data[0].id).at(0);
            if (!d) {
                return;
            }

            switch (d.type) {
                case 'sparse-distance-matrix': {
                    // TODO: Future
                    break;
                }
                case '3d-positions': {
                    const values = d.values as Positions3D;
                    maxBin = values.length;

                    const positions = [];
                    for (let i = 0; i < values.length; i++) {
                        positions.push(vec4.fromValues(values[i].x, values[i].y, values[i].z, 1.0));
                    }

                    viewport.setPositions(positions);
                    break;
                }
            }
        }

        if (configuration.data[0].type === DistanceMapDataConfiguration.Selection) {
            const selectedSelection = allSelections.selections.filter(s => s.id == configuration.data[0].id).at(0);

            if (selectedSelection) {
                const dataID = selectedSelection.dataID;

                const d = data.data.filter(d => d.id === dataID).at(0);
                if (!d) {
                    return;
                }

                const values = d.values as Positions3D;

                const positions = [];
                const binNumbersAnnotation: Array<number> = [];

                for (let i = 0; i < selectedSelection.bins.length; i++) {
                    if (selectedSelection.bins[i] == 1) {
                        positions.push(vec4.fromValues(values[i].x, values[i].y, values[i].z, 1.0));
                        binNumbersAnnotation.push(i);
                    }
                }

                const groupedBinNumbersAnnotations = groupSubsequentNumbers(binNumbersAnnotation);
                setBinNumbers(() => binNumbersAnnotation);
                setBinGroups(() => groupedBinNumbersAnnotations);
                maxBin = positions.length;
                viewport.setPositions(positions);
            }
        }

        updateConfiguration({
            ...configuration,
            camera: {
                ...viewport.cameraConfiguration,
                zoom: 0.5 * (maxBin * 1.4142),
                translateX: (-0.5 * (maxBin * 1.4142)),
                translateY: (-0.5 * (maxBin * 0.7071)),

                maxZoom: (maxBin * 1.4142),
            }
        });
    };

    // remove data removed from data tab
    useEffect(() => {
        const dataWithoutGlobalyRemoved = configuration.data.filter(confD => data.data.find(globalD => confD.id == globalD.id) != undefined);
        console.log(data, configuration.data, dataWithoutGlobalyRemoved)

        updateConfiguration({
            ...configuration,
            data: dataWithoutGlobalyRemoved
        })
        updatePositions();
    }, [data])

    //#region Viewport Initialization
    useEffect(() => {
        if (props.graphicsLibrary && canvasElement != null && canvasElement.current) {
            const viewport = props.graphicsLibrary.createDistanceViewport(canvasElement.current);
            viewport.cameraConfiguration = configuration.camera;
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

    //#region Camera update
    useDeepCompareEffect(() => {
        viewport.cameraConfiguration = configuration.camera;
    }, [configuration.camera]);

    useDeepCompareEffect(() => {
        if (!viewport.camera || !viewport.canvas) return;

        const timer = setTimeout(() => {
            updateConfiguration({
                ...configuration,
                camera: viewport.cameraConfiguration
            });
        }, 1000)

        return () => clearTimeout(timer);
    }, [viewport.cameraConfiguration]);
    //#endregion

    //#region Data
    useEffect(() => {
        updatePositions();
    }, [viewport, data, configuration.data, allSelections]);
    //#endregion

    //#region Camera
    // - note: all of these must be in this order
    // Scroll
    useEffect(() => {
        if (!mouseScroll || !previousMouseScroll || !isBeingHovered || isControlPressed) return;

        const y = ((mouseScroll - previousMouseScroll) / 100.0) * (configuration.camera.zoom / 10.0);

        updateConfiguration({
            ...configuration,
            camera: {
                ...viewport.cameraConfiguration,
                zoom: viewport.cameraConfiguration.zoom + y
            }
        });
    }, [previousMouseScroll, mouseScroll, isControlPressed]);

    // Mouse movement
    useEffect(() => {
        if (!mousePosition || !lastHeldMousePosition || !mousePosition.clientX || !lastHeldMousePosition.clientX || !mousePosition.clientY || !lastHeldMousePosition.clientY || isControlPressed) return;

        const x = ((mousePosition.clientX - lastHeldMousePosition.clientX) / 500.0) * configuration.camera.zoom;
        const y = ((mousePosition.clientY - lastHeldMousePosition.clientY) / 500.0) * configuration.camera.zoom;

        updateConfiguration({
            ...configuration,
            camera: {
                ...viewport.cameraConfiguration,
                translateX: configuration.camera.translateX + x,
                translateY: configuration.camera.translateY - y
            }
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
    useEffect(() => {
        if (configuration.data.length == 0) return;
        if (configuration.data[0].type == DistanceMapDataConfiguration.Selection) return;

        // console.time('tadViewport::selections');
        const colors = [vec4.fromValues(1.0, 1.0, 1.0, 1.0)];
        const binsLength = viewport.sizes[0];
        const finalColorIndices = new Uint16Array(binsLength);
        for (let selectionIndex = 0; selectionIndex < selections.length; selectionIndex++) {
            const selection = selections[selectionIndex][0];

            colors.push(vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, selection.color.a));
            const colorIndex = colors.length - 1;

            for (let i = 0; i < binsLength; i++) {
                finalColorIndices[i] = selection.bins[i] * colorIndex + (1 - selection.bins[i]) * finalColorIndices[i];
            }
        }

        viewport.setColors(colors, finalColorIndices);
        // console.timeEnd('tadViewport::selections');
    }, [selections]);

    // Compute hovered bins
    useEffect(() => {
        if (!viewport || !isBeingHovered || !mousePosition || !mousePosition.x || !mousePosition.y) {
            setHoveredBins(null);
            setHoveredBinRanges(null);
            return;
        }

        const hoveredElement = viewport.getHoveredElement(vec2.fromValues(mousePosition.x * window.devicePixelRatio, mousePosition.y * window.devicePixelRatio), viewport.currentLoD);

        setHoveredBins(hoveredElement);

        if (hoveredElement && viewport.currentLoD > 0) {
            const newRanges: [[number, number], [number, number]] = [[0, 0], [0, 0]];
            const binsLength = Math.pow(2, viewport.currentLoD);
            for (let i = 0; i <= 1; i++) {
                const from = (i == 0 ? hoveredElement.from : hoveredElement.to) * binsLength;
                const to = Math.min(from + binsLength, viewport.sizes[0]);

                newRanges[i] = [from, to];
            }

            setHoveredBinRanges(newRanges);
        }
    }, [viewport, mousePosition, mouseScroll, isBeingHovered]);

    // Add selected bins to selection
    const onClick = () => {
        if (!viewport || !isBeingHovered || !hoveredBins || !isControlPressed) {
            return;
        }

        const dataID = configuration.data[0].id;
        const selectionID = configuration.selectedSelectionID;

        if (selections.length <= 0 || !selectionID) {
            return;
        }

        const selection = selections.filter(s => s[0].id == selectionID)[0][0];
        const newBins: Uint16Array = selection.bins.slice();

        const binsLength = Math.pow(2, viewport.currentLoD);
        for (const bin of [hoveredBins.from, hoveredBins.to]) {
            const from = bin * binsLength;
            const to = from + binsLength;

            for (let i = from; i < to; i++) {
                newBins[i] = isAltPressed ? 0 : 1;
            }
        }

        allSelectionsDispatch({ type: SelectionActionKind.UPDATE, id: selection.id, name: null, color: null, bins: newBins });
    };
    //#endregion

    //#region Annotations
    useEffect(() => {
        function labelTransformation(index: number, type: "fill" | "end" | "start" | "mid") {
            const transformations = {

                "end": {
                    labelScale: 20,
                    xTransform: 0,
                    rotation: 45
                },
                "start": {
                    labelScale: 20,
                    xTransform: 0,
                    rotation: 45

                },
                "mid": {
                    labelScale: 20,
                    xTransform: 0,
                    rotation: 45
                },
                "fill": {
                    labelScale: 16,
                    xTransform: 0,
                    rotation: 0

                }
            }

            let additionalScaling = 1;
            if (hoveredBins?.from == index || hoveredBins?.to == index) {
                additionalScaling = 3;
            }


            const start = viewport.worldSpaceToScreenSpace(vec4.fromValues(index * 1.4142 + 0.7071, -0.35355, 0.0, 1.0));

            return `translate(${start[0]},  ${start[1]}),
             scale(${additionalScaling * transformations[type].labelScale / viewport.cameraConfiguration.zoom}),
             translate(0, 10)`;
        }

        function renderLabel(index: number, label: string, key: string, type: "end" | "start" | "mid" | "fill") {
            return <g transform={labelTransformation(index, type)} key={key} ><text
                x={0}
                y={0}
                fill="cyan"
                textAnchor="middle"
                fontSize={16}
            >{label}
            </text></g>
        }
        if (configuration.data.length != 0 && configuration.data[0].type != DistanceMapDataConfiguration.Selection) {
            setSvgNumbers([]);
            return
        }


        if (!viewport || !viewport.canvas) return;

        const labels: Array<JSX.Element> = [];

        let renderedBins = 0;
        for (const binGroup of binGroups) {



            if (binGroup.length == 1) {
                labels.push(renderLabel(renderedBins, `${binGroup[0]} `, `${binGroup[0]} `, "mid"));
                renderedBins++;
            } else {
                labels.push(renderLabel(renderedBins, `${binGroup[0]} `, `${binGroup[0]} `, "start"));
                renderedBins++;
                for (const bin of binGroup.slice(1, binGroup.length - 1)) {
                    labels.push(renderLabel(renderedBins, "•", `${bin} `, "fill"));
                    renderedBins++;
                }
                labels.push(renderLabel(renderedBins, `${binGroup[binGroup.length - 1]} `, `${binGroup[binGroup.length - 1]} `, "end"));
                renderedBins++;
            }



        }
        setSvgNumbers(() => labels);
    }, [viewport, binGroups, hoveredBins, viewport.cameraConfiguration.zoom, viewport.cameraConfiguration.translateX, viewport.cameraConfiguration.translateY]);
    //#endregion

    return (<div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onClick={onClick}></canvas>
        <svg style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            {(viewport && hoveredBins && !hoveredBinRanges) && (
                <g>
                    <text x={18} y={34} fontSize={18} fill='white'>{`Bin numbers: [${binNumbers[hoveredBins.from]} × ${binNumbers[hoveredBins.to]}]`}</text>
                    <text x={18} y={56} fontSize={18} fill='grey'>{`Bin indices: [${hoveredBins.from} × ${hoveredBins.to}]`}</text>
                </g>

            )}
            {(viewport && hoveredBinRanges) && (
                <text x={18} y={34} fontSize={18} fill='white'>[{hoveredBinRanges[0][0]}-{hoveredBinRanges[0][1]}, {hoveredBinRanges[1][0]}-{hoveredBinRanges[1][1]}]</text>
            )}
            {svgNumbers}
        </svg>
    </div>
    );
}
