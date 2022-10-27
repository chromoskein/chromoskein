import { useEffect, useRef, useState, Dispatch } from "react";
import * as GraphicsModule from "../../modules/graphics";
import { sasa } from "../../modules/sasa";
import { ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, getDefaultViewportSelectionOptions, ChromatinViewportToolType } from "../../modules/storage/models/viewports";
import { useDeepCompareEffect, useMouseHovered, usePrevious } from "react-use";
import { ChromatinIntersection, ContinuousTube, Sphere, CullPlane } from "../../modules/graphics";
import { vec3, vec4 } from "gl-matrix";
import { BEDAnnotations, BEDAnnotation, BinPositionsData, Data, DataAction, DataState, isoDataID, Positions3D, Sparse1DNumericData, Sparse1DTextData } from "../../modules/storage/models/data";
import { SelectionAction, SelectionActionKind, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration } from "../hooks";
import { useKey } from "rooks";
import * as chroma from "chroma-js";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { LabelingOverlay } from "./LabelingOverlay"
import { LabelingDebugViewport } from "./LabelingDebugViewport";

const SphereSelectionName = 'SPHERE_SELECTION';

const median: (values: Array<number>) => number = values => {
    const sorted = values.sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    if (sorted.length % 2) {
        return sorted[half];
    } else {
        return (sorted[half - 1] + sorted[half]) / 2.0;
    }
}

export function ChromatinViewport(props: {
    graphicsLibrary: GraphicsModule.GraphicsLibrary,
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    coordinatePreviewReducer: [CoordinatePreviewState, React.Dispatch<CoordinatePreviewAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}): JSX.Element {
    // Configuration/Data
    const configurationReducer = useConfiguration<ChromatinViewportConfiguration>(props.configurationID, props.configurationsReducer);
    const [coordinatePreview, dispatchCoordinatePreview] = props.coordinatePreviewReducer;

    const [data, dataDispatch] = props.dataReducer;
    const [globalSelections, globalSelectionsDispatch] = props.selectionsReducer;
    const [configuration, updateConfiguration] = configurationReducer;

    // Canvas
    const canvasElement = useRef<HTMLCanvasElement>(null);
    const [viewport, setViewport] = useState<GraphicsModule.ChromatinViewport>(() => props.graphicsLibrary.createChromatinViewport(null));

    const previousConfiguration = usePrevious(configuration);

    const mousePosition = useMouseHovered(canvasElement);

    const [closestIntersection, setClosestIntersection] = useState<ChromatinIntersection | null>(null);

    const interesctionConfigurationDatum = closestIntersection && configuration.data[closestIntersection.chromatinPart.dataId];

    const interesctionPrimaryData = interesctionConfigurationDatum ? data.data.find(d => d.id == interesctionConfigurationDatum.id) || null : null;
    const interesctionSecondaryData = interesctionConfigurationDatum ? data.data.find(d => isoDataID.unwrap(d.id) == closestIntersection.chromatinPart.dataId) || null : null;

    const intersection3DDataID = (interesctionConfigurationDatum?.secondaryID || interesctionConfigurationDatum?.id) || null;
    const intersection3DDataBin = (closestIntersection && interesctionConfigurationDatum?.secondaryID) ? ((interesctionPrimaryData?.values as BEDAnnotations)[closestIntersection.binIndex].from) : closestIntersection?.binIndex;

    const [isPrimaryModPressed, setPrimaryModPressed] = useState(false);
    const [isSecondaryModPressed, setSecondaryModPressed] = useState(false);

    const [isShiftPressed, setShiftPressed] = useState(false);

    //~ Labeling
    const [layoutGenerator, setLayoutGenerator] = useState<GraphicsModule.LabelLayoutGenerator>(() => new GraphicsModule.LabelLayoutGenerator(viewport, props.graphicsLibrary));
    const [labels, setLabels] = useState<GraphicsModule.Label[]>([]);

    // Input
    useKey(["Control", "Meta"], () => setPrimaryModPressed(true), { eventTypes: ["keydown"] });
    useKey(["Control", "Meta"], () => setPrimaryModPressed(false), { eventTypes: ["keyup"] });

    useKey(["Alt"], () => setSecondaryModPressed(true), { eventTypes: ["keydown"] });
    useKey(["Alt"], () => setSecondaryModPressed(false), { eventTypes: ["keyup"] });

    useKey(["Shift"], () => setShiftPressed(true), { eventTypes: ["keydown"] });
    useKey(["Shift"], () => setShiftPressed(false), { eventTypes: ["keyup"] });

    // 
    const [colors, setColors] = useState<Array<Array<vec4>>>([]);
    const [binIds, setBinIds] = useState<number[][]>([]); //~ should be equivalent to Array<Array<number>>

    // Viewport Setup
    useEffect(() => {
        if (props.graphicsLibrary && canvasElement != null && canvasElement.current) {
            const newViewport = props.graphicsLibrary.createChromatinViewport(canvasElement.current);
            ///newViewport.cameraConfiguration = configuration.camera;
            setViewport(() => newViewport);

            // Draw the scene repeatedly
            const render = async (frametime: number) => {
                await newViewport.render(frametime);
                //~ label rendered scene. 
                // setLabels(await layoutGenerator.getLabelPositions());

                requestAnimationFrame(render);
            }
            const requestID = requestAnimationFrame(render);

            return function cleanup() {
                viewport?.deallocate();
                window.cancelAnimationFrame(requestID);
            };
        }
    }, [props.graphicsLibrary, props.configurationID, canvasElement]);

    useEffect(() => {
        layoutGenerator.viewport = viewport;
    }, [layoutGenerator, viewport, viewport.width, viewport.height]);

    // Camera Update
    // useDeepCompareEffect(() => {
    //     viewport.cameraConfiguration = configuration.camera;
    // }, [configuration.camera]);

    // useDeepCompareEffect(() => {
    //     if (!viewport.camera || !viewport.canvas) return;

    //     const timer = setTimeout(() => {
    //         updateConfiguration({
    //             ...configuration,
    //             camera: viewport.cameraConfiguration
    //         });
    //     }, 500)

    //     return () => clearTimeout(timer);
    // }, [viewport.cameraConfiguration]);

    // Disable camera if control is pressed
    useEffect(() => {
        if (!viewport || !viewport.camera) return;

        viewport.camera.ignoreEvents = isPrimaryModPressed;
    }, [viewport, isPrimaryModPressed]);

    // remove data removed from data tab 
    // useEffect(() => {
    //     const dataWithoutGlobalyRemoved = configuration.data.filter(confD => data.data.find(globalD => confD.id == globalD.id) != undefined);
    //     updateConfiguration({
    //         ...configuration,
    //         data: dataWithoutGlobalyRemoved
    //     })

    // }, [data, globalSelections]);

    // Data
    useEffect(() => {
        if (!viewport.canvas) return;

        viewport.clearChromatin();

        for (const [configurationDatumIndex, configurationDatum] of configuration.data.entries()) {
            const primaryData = data.data.find((d: Data) => d.id == configurationDatum.id);
            if (primaryData?.type == '3d-positions') {
                const datum = primaryData as BinPositionsData;
                const positions = datum.values.positions;

                const chromatinPart = viewport.addPart(datum.name, positions, datum.values.connectivity || null, configurationDatumIndex, configurationDatum.representation, false);
                chromatinPart.structure.radius = configurationDatum.radius;
            } else if (primaryData?.type == 'bed-annotation' && configurationDatum.secondaryID) {
                const data3D = data.data.find((d: Data) => d.id == configurationDatum.secondaryID)?.values as Positions3D | undefined;

                if (data3D) {
                    const positions = (primaryData.values as BEDAnnotations).map((annotation: BEDAnnotation) => data3D.positions[annotation.from]);

                    const chromatinPart = viewport.addPart(primaryData.name, positions, null, configurationDatumIndex, configurationDatum.representation, false);
                    chromatinPart.structure.radius = configurationDatum.radius;
                }
            }
        }

        viewport.rebuild();
    }, [viewport, configuration.data, data.data]);

    // Find closest intersection
    useEffect(() => {
        // so useMouseHovered doesn't work, so this bullshit needs to be here to prevent setting intersections when hovering outside canvas
        if (0 > mousePosition.elX || mousePosition.elX > (canvasElement.current?.offsetWidth ?? 0)) {
            setClosestIntersection(null);
            return;
        }
        if (0 > mousePosition.elY || mousePosition.elY > (canvasElement.current?.offsetHeight ?? 0)) {
            setClosestIntersection(null);
            return;
        }
        setClosestIntersection(() => viewport.closestIntersectionBin({ x: mousePosition.elX * window.devicePixelRatio, y: mousePosition.elY * window.devicePixelRatio }));
    }, [viewport, mousePosition]);

    useEffect(() => {
        if (!closestIntersection || !configuration.showTooltip || !intersection3DDataID) {
            dispatchCoordinatePreview({
                visible: false
            })
            return;
        }

        const additionalInfo: Array<string> = [];

        dispatchCoordinatePreview({
            visible: true,
            type: "bin-coordinates-single",
            dataId: intersection3DDataID,
            additionalInfo: additionalInfo,
            mappingIds: configuration.tooltip.tooltipDataIDs,
            textAggregation: configuration.tooltip.tooltipTextAggregation,
            numericAggregation: configuration.tooltip.tooltipNumericAggregation,
            from: intersection3DDataBin,
            chromosomeName: closestIntersection.chromatinPart.name
        })
    }, [viewport, closestIntersection]);

    // Calculate/Cache Colors (1D Data Mapping + Selections)
    useEffect(() => {
        if (!viewport || !configuration.data) {
            return;
        }

        const mapScaleToChromatin = (chromatinPart: GraphicsModule.ChromatinPart, values: Array<number>, scale: chroma.Scale): Array<vec4> => {
            const ratio = Math.max(...values);
            const valuesNormalized = values.map(v => v / ratio);

            const colors: Array<vec4> = valuesNormalized.map(v => {
                return scale(v).gl();
            });

            return colors;
        }

        const newColors = new Array(configuration.data.length);
        for (const [configurationDatumIndex, configurationDatum] of configuration.data.entries()) {
            const datum: Data | undefined = data.data.find(d => d.id === configurationDatum.id);

            if (!datum) {
                continue;
            }
            const datumPositions = datum.values as Positions3D;
            const chromatinPart = viewport.getChromatinPartByDataId(configurationDatumIndex);
            let dataMarkers = null;

            if (!datumPositions || !chromatinPart) {
                continue;
            }

            const positions = datumPositions.positions;

            const binsAmount = chromatinPart.getBinsPositions().length;

            if (configurationDatum.colorMappingMode == "single-color") {
                newColors[configurationDatumIndex] = chromatinPart.cacheColorArray(new Array(binsAmount).fill(vec4.fromValues(
                    configurationDatum.color.r / 255.0,
                    configurationDatum.color.g / 255.0,
                    configurationDatum.color.b / 255.0,
                    1.0
                )));
            } else if (configurationDatum.colorMappingMode == "selections") {
                const selections = globalSelections.selections.filter(s => s.dataID == configurationDatum.id);

                const colors: Array<vec4> = [vec4.fromValues(1.0, 1.0, 1.0, 1.0)];
                const finalColorIndices = new Uint16Array(binsAmount);
                for (let selectionIndex = 0; selectionIndex < selections.length; selectionIndex++) {
                    const selection = selections[selectionIndex];
                    const associatedData = configurationDatum.selections.find(s => s.selectionID == selection.id) ?? getDefaultViewportSelectionOptions(selection.id);

                    if (!associatedData.visible) {
                        continue;
                    }

                    colors.push(vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, selection.color.a));
                    const colorIndex = colors.length - 1;

                    for (let i = 0; i < binsAmount; i++) {
                        finalColorIndices[i] = selection.bins[i] * colorIndex + (1 - selection.bins[i]) * finalColorIndices[i];
                    }
                }

                const finalColors: Array<vec4> = new Array(binsAmount);
                for (let i = 0; i < binsAmount; i++) {
                    finalColors[i] = colors[finalColorIndices[i]];
                }
                newColors[configurationDatumIndex] = chromatinPart.cacheColorArray(finalColors);
            } else if (configurationDatum.colorMappingMode == "sasa") {
                if (configuration.sasa.method == 'generated') {
                    throw "Not implemented";
                }

                //TODO: per chromosome or whole chromosome
                const globalSasaValues = sasa(positions, {
                    method: configuration.sasa.method,
                    probe_size: configuration.sasa.probeSize,
                }, configuration.sasa.accuracy);

                //TODO: fix underlying bug where the something sometimes don't contain last bin of the chromosome
                // if (globalSasaValues.length < chromatinPart.values.length) {
                // globalSasaValues.push(globalSasaValues.reduce((a, b) => a + b, 0) / globalSasaValues.length);
                // }

                const colorScale = chroma.scale(['#fcfdfd', '#010a4e']);
                newColors[configurationDatumIndex] = chromatinPart.cacheColorArray(mapScaleToChromatin(chromatinPart, globalSasaValues, colorScale));
            } else if (configurationDatum.colorMappingMode == "1d-density") {
                const data1d: Array<{ chromosome: string, from: number, to: number }> | null = data.data.find(d => d.id == isoDataID.wrap(configurationDatum.mapValues.id))?.values as Sparse1DTextData | Sparse1DNumericData | null;

                if (!data1d || !(datum.type == '3d-positions')) {
                    return;
                }

                const datumTyped = datum as BinPositionsData;

                const countPerBin: Array<number> = new Array(binsAmount).fill(0);

                const chromosomeData1d = [...data1d.map(v => { return { ...v } })];
                const res = datumTyped.basePairsResolution;

                const connectivity = datumTyped.values.connectivity;

                if (connectivity) {
                    const indexes = [];
                    for (let i = 0; i < connectivity.length; i++) {
                        if (connectivity[i] === 0)
                            indexes.push(i);
                    }

                    for (const [i, offset] of indexes.entries()) {
                        const underChrosome = chromosomeData1d.filter(c => parseInt(c.chromosome) === i + 1);

                        for (const v of underChrosome) {
                            v.from += offset * res;
                            v.to += offset * res;
                        }
                    }
                }

                for (let binIndex = 0; binIndex < binsAmount; binIndex++) {
                    for (const datum of chromosomeData1d) {
                        if (datum.from <= (binIndex + 1) * res
                            && datum.to >= binIndex * res) {
                            countPerBin[binIndex] += 1;
                        }
                    }
                }

                const logCountPerBin = countPerBin.map(v => Math.log(v) + 1);
                const colorScale = chroma.scale(['#fcfdfd', '#010a4e']);

                newColors[configurationDatumIndex] = chromatinPart.cacheColorArray(mapScaleToChromatin(chromatinPart, logCountPerBin, colorScale));
            } else if (configurationDatum.colorMappingMode == "linear-order") {
                const colorScale = chroma.scale(['#0d1a29', '#133250', '#1e4c7b', '#3868a7', '#658ac6', '#88a0c9', '#aab6ca', '#d3d6da']);

                const numbers = [...Array(binsAmount).keys()];

                console.log(numbers);

                newColors[configurationDatumIndex] = chromatinPart.cacheColorArray(mapScaleToChromatin(chromatinPart, numbers, colorScale));
            }
        }

        setColors(() => newColors);
    }, [viewport, globalSelections.selections, configuration.data, configuration.sasa, data.data, configuration.chromosomes, configuration.density]);

    // Calculate cullable bins
    useEffect(() => {
        if (!viewport || !configuration.data) {
            return;
        }

        for (const [configurationDatumIndex, configurationDatum] of configuration.data.entries()) {
            const data3D = viewport.getChromatinPartByDataId(configurationDatumIndex);

            if (!data3D) {
                continue;
            }

            const binsAmount = data3D.getBinsPositions().length;
            const cullableBins: Array<boolean> = new Array(binsAmount).fill(true);

            const selections = globalSelections.selections.filter(s => s.dataID == configurationDatum.id);
            for (let selectionIndex = 0; selectionIndex < selections.length; selectionIndex++) {
                const selection = selections[selectionIndex];
                const associatedData = configurationDatum.selections.find(s => s.selectionID == selection.id) ?? getDefaultViewportSelectionOptions(selection.id);

                if (!associatedData.visible) {
                    continue;
                }

                if (!associatedData.cullable) {
                    for (let i = 0; i < binsAmount; i++) {
                        if (selection.bins[i] == 1) {
                            cullableBins[i] = false;
                        }
                    }
                }
            }

            data3D.setCullableBins(cullableBins);
        }
    }, [viewport, globalSelections.selections, configuration.data, data.data]);

    // Color bins
    useEffect(() => {
        if (!viewport.canvas) {
            return;
        }

        for (const [configurationDatumIndex, configurationDatum] of configuration.data.entries()) {
            const data3D = viewport.getChromatinPartByDataId(configurationDatumIndex);

            if (data3D && colors.length > configurationDatumIndex && colors[configurationDatumIndex]) {
                if (data3D.structure instanceof ContinuousTube) {
                    data3D.structure.setColorsCombined(colors[configurationDatumIndex]);
                } else {
                    data3D.structure.setColors(colors[configurationDatumIndex]);
                }
            }
        }

        // Color by interesction
        // console.time('colorBins::intersection');
        if (!configuration.tool) {
            // console.timeEnd('colorBins');
            return;
        }

        const tool = configuration.tool;
        if (tool.type != ChromatinViewportToolType.SphereSelection || closestIntersection == null || configuration.selectedDatum == null) {
            viewport.removeStructureByName(SphereSelectionName);
        }

        const selectedDatum = configuration.selectedDatum;
        if (selectedDatum == null || closestIntersection == null) {
            return;
        }

        if (!configuration.data[selectedDatum] || !configuration.data[selectedDatum].selectedSelectionID) {
            return;
        }

        const selection = globalSelections.selections.find(s => s.id == configuration.data[selectedDatum].selectedSelectionID);
        if (!selection) {
            return;
        }

        if (closestIntersection.chromatinPart.dataId !== configuration.selectedDatum) {
            return;
        }

        if (tool.type == ChromatinViewportToolType.PointSelection) {
            console.log('bin is: ', closestIntersection.binIndex);
            closestIntersection.chromatinPart.setBinColor(closestIntersection.binIndex, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
        } else if (tool.type == ChromatinViewportToolType.SphereSelection && configuration.data[selectedDatum].selectedSelectionID) {
            // Only find position in space where the ray intersects
            const intersectionExactPosition = vec3.add(vec3.create(), closestIntersection.ray.origin, vec3.scale(vec3.create(), closestIntersection.ray.direction, closestIntersection.distance));

            //~ Snapping into bins (ALT)
            //~ get ID of the intersected bin and the position of the intersected bin (not the tube but the point)
            const binIdx = closestIntersection.binIndex;
            const binPositions = closestIntersection.chromatinPart.getBinsPositions();
            const binPos = binPositions[binIdx];

            const sphereCenter = isShiftPressed ? binPos : intersectionExactPosition; //~ if ALT is pressed, snapping onto bin positions

            // Update (create if not already created) the configuration of selection sphere
            const sphere = (viewport.getStructureByName(SphereSelectionName) ?? viewport.scene.addSphere(
                SphereSelectionName,
                sphereCenter,
                null,
                null,
                false,
                true
            )[1]) as Sphere;
            sphere.opaque = false;
            const sphereRadius = tool.radius; // TODO: variable

            if (sphere instanceof Sphere) {
                sphere.setCenter(sphereCenter);
                sphere.setColor(vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, 0.5));
                sphere.setRadius(sphereRadius);
            }

            // Highlight all the bins inside the sphere
            const selectionColor = vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, selection.color.a);

            const chromatinPart = closestIntersection.chromatinPart;
            const binsPositions = chromatinPart.getBinsPositions();
            for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                const binPosition = binsPositions[binIndex];

                if (vec3.distance(binPosition, sphereCenter) < sphereRadius) {
                    chromatinPart.setBinColorVec4(binIndex, selectionColor);
                }
            }
        } else if (tool.type == ChromatinViewportToolType.JoinSelection) {
            const selectionColor = vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, selection.color.a);
            const chromatinPart = closestIntersection.chromatinPart;

            if (closestIntersection) {
                chromatinPart.setBinColorVec4(closestIntersection.binIndex, selectionColor);
            }

            if (tool.from != null) {
                chromatinPart.setBinColorVec4(tool.from, selectionColor);
            }

            if (closestIntersection && tool.from != null) {
                const startBinIndex = Math.min(closestIntersection.binIndex, tool.from);
                const endBinIndex = Math.max(closestIntersection.binIndex, tool.from);

                const binsPositions = chromatinPart.getBinsPositions();
                for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                    if (startBinIndex <= binIndex && binIndex < endBinIndex) {
                        chromatinPart.setBinColorVec4(binIndex, selectionColor);
                    }
                }
            }
        } else if (tool.type == ChromatinViewportToolType.Ruler) {
            // // color bin where the ruler is from
            // if (tool.from != null) {
            //     const from = tool.from;
            //     const fromChromosomeSliceIndex = chromosomeSlices.findIndex(c => c.name == from.chrom);

            //     const fromChromosomePart = viewport.getChromatinPartByChromosomeIndex(fromChromosomeSliceIndex);

            //     fromChromosomePart?.setBinColor(tool.from.bin, { r: 1.0, g: 0, b: 0, a: 1.0 });
            // }
        }
        // console.timeEnd('colorBins::intersection');
        // console.timeEnd('colorBins');
    }, [viewport, closestIntersection, colors, configuration.data, configuration.selectedDatum, configuration.tool, configuration.selectedSelectionID, configuration.chromosomes, data.data, globalSelections.selections, isShiftPressed]);

    // Cutaways
    useEffect(() => {
        if (!viewport) return;

        viewport.deleteCullObjects();

        for (const cutaway of configuration.cutaways) {
            let planeNormal;
            if (cutaway.axis == 'X' || cutaway.axis == 'Y' || cutaway.axis == 'Z') {
                switch (cutaway.axis) {
                    case 'X': {
                        planeNormal = vec3.fromValues(0.0, 0.0, 1.0);
                        break;
                    }
                    case 'Y': {
                        planeNormal = vec3.fromValues(0.0, 1.0, 0.0);
                        break;
                    }
                    case 'Z': {
                        planeNormal = vec3.fromValues(1.0, 0.0, 0.0);
                        break;
                    }
                }
            } else {
                planeNormal = vec3.clone(cutaway.axis);
            }

            const planePoint = vec3.scale(vec3.create(), planeNormal, cutaway.length);
            viewport.addCullObject(new CullPlane(planeNormal, planePoint));
        }

        viewport.updateCullObjects();
    }, [viewport, configuration.cutaways]);

    //#region Labels
    const [labelsWorldSpace, setLabelsWorldSpace] = useState<Array<[vec3, string | number]>>([]);

    // Create Labels
    useEffect(() => {
        for (const [configurationDatumIndex, configurationDatum] of configuration.data.entries()) {
            const primaryData = data.data.find((d: Data) => d.id == configurationDatum.id);

            // Let's only go through markers
            if (primaryData?.type == 'bed-annotation' && configurationDatum.secondaryID) {
                const data3D = data.data.find((d: Data) => d.id == configurationDatum.secondaryID)?.values as Positions3D | undefined;

                if (data3D) {
                    setLabelsWorldSpace((primaryData.values as BEDAnnotations).map((annotation: BEDAnnotation) => [
                        vec3.fromValues(data3D.positions[annotation.from].x, data3D.positions[annotation.from].y, data3D.positions[annotation.from].z),
                        // annotation.attributes[0] || 'None'
                        annotation.attributes[4] || 'None'
                    ]));
                }
            }
        }
    }, [viewport, configuration.data, data.data, viewport.cameraConfiguration]);

    // Update screen space positions
    useEffect(() => {
        function makeLabel(text: string, id: number, x: number, y: number): GraphicsModule.Label | null {
            const devicePixelRatio = window.devicePixelRatio || 1.0;
            const xScreen = x * (viewport.width / devicePixelRatio);
            const yScreen = (1.0 - y) * (viewport.height / devicePixelRatio);

            const labelText = text;
            // const labelColor = found ? found.color : { r: 0, g: 0, b: 0, a: 0 };
            const labelColor = { r: 1, g: 1, b: 1, a: 1 };

            const lbl = {
                x: xScreen,
                y: yScreen,
                id: id,
                text: labelText,
                color: labelColor,
            };

            return lbl;
        }

        // TODO
        const pm = viewport.camera?.projectionMatrix;
        if (!pm) return; // ???
        const mvm = viewport.camera?.viewMatrix;
        if (!mvm) return; // ???

        const labels: GraphicsModule.Label[] = [];
        let i = 0;
        for (const [position, marker] of labelsWorldSpace) {
            const viewSpacePosition = vec4.transformMat4(vec4.create(), vec4.fromValues(position[0], position[1], position[2], 1.0), mvm);
            const screenSpacePosition = vec4.transformMat4(vec4.create(), viewSpacePosition, pm);
            const w = screenSpacePosition[3];
            const finalPos = vec3.fromValues(screenSpacePosition[0] / w, screenSpacePosition[1] / w, screenSpacePosition[2] / w);
            
            const text = (typeof marker === "string") ? marker : "error";
            const newLbl = makeLabel(text, i, 0.5 * finalPos[0] + 0.5, 0.5 * finalPos[1] + 0.5);
            if (newLbl != null) {
                labels.push(newLbl);
                i += 1;
            }
        }
        setLabels(labels);
    }, [viewport, viewport.cameraConfiguration, labelsWorldSpace]);


    //~ Propagate selections to labelLayoutGenerator
    useEffect(() => {
        layoutGenerator.selections = globalSelections.selections;
    }, [globalSelections.selections, layoutGenerator]);

    //~ Turn label computation on/off (to save computation when label overlay is anyway disabled)
    useEffect(() => {
        if (configuration.labeling.showLabelingOverlay) {
            layoutGenerator.enableLabeling();
        } else {
            layoutGenerator.disableLabeling();
        }
    }, [configuration.labeling.showLabelingOverlay, layoutGenerator]);

    //~ propagate debug setting: whether labeling uses CPU or GPU implementation for the final step
    useEffect(() => {
        layoutGenerator.useMaxDistCPU = configuration.labeling.useMaxDistCPU;
    }, [configuration.labeling.useMaxDistCPU, layoutGenerator]);

    //#endregion Labels

    //#region Options
    useEffect(() => {
        if (viewport && configuration.backgroundColor) {
            const bgColor = configuration.backgroundColor;
            viewport.backgroundColor = {
                r: bgColor.r / 255.0,
                g: bgColor.g / 255.0,
                b: bgColor.b / 255.0,
                a: (bgColor.a ?? 100.0) / 100.0,
            };
        }
    }, [viewport, configuration.backgroundColor]);

    useEffect(() => {
        if (!viewport) return;

        viewport.ssaoKernelRadius = configuration.ssao.radius;
    }, [viewport, configuration.ssao.radius]);
    //#endregion Options

    const onClick = () => {
        if (!viewport || !configuration.data || !closestIntersection || !isPrimaryModPressed || !configuration.tool || configuration.selectedDatum == null || !configuration.data[configuration.selectedDatum]) {
            return;
        }

        const datum = configuration.data[configuration.selectedDatum];
        const tool = configuration.tool;

        const selectionId = datum.selectedSelectionID;
        if (selectionId == null) {
            return;
        }

        const selectedChromatinPart = closestIntersection.chromatinPart;

        const selection = globalSelections.selections.find(s => s.id == selectionId);
        if (!selection) {
            throw "No global selection found with local selection ID " + selectionId;
        }

        const binPositions = data.data.filter(d => d.id == datum.id)[0] as BinPositionsData;

        const newBins: Uint16Array = selection.bins.slice();
        if (tool.type == ChromatinViewportToolType.PointSelection) {
            newBins[closestIntersection.binIndex] = isSecondaryModPressed ? 0 : 1;
        } else if (tool.type == ChromatinViewportToolType.SphereSelection) {
            const sphereCenter = vec3.add(vec3.create(), closestIntersection.ray.origin, vec3.scale(vec3.create(), closestIntersection.ray.direction, closestIntersection.distance));
            const sphereRadius = tool.radius;
            const value = isSecondaryModPressed ? 0 : 1;

            const binsPositions = selectedChromatinPart.getBinsPositions();

            for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                const binPosition = binsPositions[binIndex];

                if (vec3.distance(binPosition, sphereCenter) < sphereRadius) {
                    newBins[binIndex] = value;
                }
            }
        } else if (tool.type == ChromatinViewportToolType.JoinSelection) {
            if (tool.from == null) {
                updateConfiguration({
                    ...configuration,
                    tool: {
                        ...tool,
                        from: closestIntersection.binIndex
                    }
                });
            } else {
                const startBinIndex = Math.min(closestIntersection.binIndex, tool.from);
                const endBinIndex = Math.max(closestIntersection.binIndex, tool.from);

                const chromatinPart = closestIntersection.chromatinPart;
                const value = isSecondaryModPressed ? 0 : 1;

                if (chromatinPart) {
                    const binsPositions = chromatinPart.getBinsPositions();
                    for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                        if (startBinIndex <= binIndex && binIndex <= endBinIndex) {
                            newBins[binIndex] = value;
                        }
                    }

                    updateConfiguration({
                        ...configuration,
                        tool: {
                            ...tool,
                            from: null,
                            to: null
                        }
                    });
                }
            }
        }

        globalSelectionsDispatch({ type: SelectionActionKind.UPDATE, id: selectionId, bins: newBins });
    };

    return (<div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <canvas data-tip data-for='tooltip' ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden' }} tabIndex={1} onClick={() => onClick()}></canvas>
        {configuration.labeling.showDebugViewport && (
            <LabelingDebugViewport graphicsLibrary={props.graphicsLibrary} viewport={viewport} labelingGenerator={layoutGenerator} shownTexture={configuration.labeling.shownDebugTexture}></LabelingDebugViewport>
        )}
        {configuration.labeling.showLabelingOverlay && (
            <LabelingOverlay labels={labels} configuration={{ showAnchors: configuration.labeling.showLabelAnchors, }}></LabelingOverlay>
        )}
    </div>
    );


}
