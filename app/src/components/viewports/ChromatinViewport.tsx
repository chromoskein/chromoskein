import { useEffect, useRef, useState, Dispatch } from "react";
import * as GraphicsModule from "../../modules/graphics";
import { sasa } from "../../modules/sasa";
import { ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, getDefaultViewportSelectionOptions, ChromatinViewportToolType } from "../../modules/storage/models/viewports";
import { useDeepCompareEffect, useMouseHovered, usePrevious } from "react-use";
import { ChromatinIntersection, ContinuousTube, Sphere, Spheres, CullPlane, ChromatinRepresentation } from "../../modules/graphics";
import { vec3, vec4 } from "gl-matrix";
import { BEDAnnotations, BEDAnnotation, BinPositionsData, Data, DataAction, DataID, DataState, isoDataID, Positions3D, Sparse1DNumericData, Sparse1DTextData } from "../../modules/storage/models/data";
import { isoSelectionID, SelectionAction, SelectionActionKind, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration } from "../hooks";
import { useKey } from "rooks";
import * as chroma from "chroma-js";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { iso } from "newtype-ts";
import { quantile } from "simple-statistics";
import _ from "lodash";
import { Spline } from "../../modules/graphics/primitives/spline";
import { density } from "../../modules/density";
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
            newViewport.cameraConfiguration = configuration.camera;
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
        const rulerInfo = makeRulerTooltipInfo(closestIntersection);
        if (rulerInfo) {
            additionalInfo.push(rulerInfo);
        }

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

        const newColors = new Array(configuration.data.length);
        for (const [configurationDatumIndex, configurationDatum] of configuration.data.entries()) {
            const data3D = viewport.getChromatinPartByDataId(configurationDatumIndex);
            let dataMarkers = null;

            if (!data3D) {
                continue;
            }

            const binsAmount = data3D.getBinsPositions().length;

            if (configurationDatum.colorMappingMode == "single-color") {
                newColors[configurationDatumIndex] = data3D.cacheColorArray(new Array(binsAmount).fill(vec4.fromValues(
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
                newColors[configurationDatumIndex] = data3D.cacheColorArray(finalColors);
            }
        }

        /*
        const mapScaleToChromatin = (values: Array<number>, scale: chroma.Scale): Array<Array<vec4>> => {
            const ratio = Math.max(...values);
            const valuesNormalized = values.map(v => v / ratio);

            const allColors: Array<Array<vec4>> = new Array(data3D.chromosomes.length);

            for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);
                if (!chromatinPart) {
                    continue;
                }

                const chromosomeBinOffset = chromatineSlices[chromosomeIndex].from;

                const colors: Array<vec4> = valuesNormalized.slice(chromosomeBinOffset, chromosomeBinOffset + chromatinPart.getBinsPositions().length).map(v => {
                    return scale(v).gl();
                });

                allColors[chromosomeIndex] = chromatinPart.cacheColorArray(colors);
            }

            return allColors;
        }

        if (configuration.colorMappingMode == '1d-density') {

            const data1d: Array<{ chromosome: string, from: number, to: number }> | null = data.data.find(d => d.id == isoDataID.wrap(configuration.mapValues.id))?.values as Sparse1DTextData | Sparse1DNumericData | null;
            if (!data1d) {
                return;
            }

            const scale = chroma.scale(['white', 'blue']);
            const countPerBin: Array<number> = Array(data3D.values.length);
            _.fill(countPerBin, 0)

            for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                const partInfo = chromatineSlices[chromosomeIndex];
                const chromosomeData1d = data1d.filter(d => d.chromosome == partInfo.name);
                const res = data3D.basePairsResolution;
                for (let binIndex = 0; binIndex < partInfo.to - partInfo.from; binIndex++) {
                    for (const datum of chromosomeData1d) {
                        if (datum.from <= (binIndex + 1) * res && datum.to >= binIndex * res) {
                            countPerBin[binIndex + partInfo.from] += 1;
                        }
                    }
                }
            }

            const logCountPerBin = countPerBin.map(v => Math.log(v) + 1);

            setInnerColors(() => mapScaleToChromatin(logCountPerBin, scale));
        }

        if (configuration.colorMappingMode == '1d-numerical') {
            const data1d: Sparse1DNumericData | null = data.data.find(d => d.id == isoDataID.wrap(configuration.mapValues.id))?.values as Sparse1DNumericData | null;
            if (!data1d) {
                return;
            }

            const scale = chroma.scale(['white', 'blue']);
            const valuesPerBin: Array<Array<number>> = Array.from(Array(data3D.values.length), () => [])

            for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                const partInfo = chromatineSlices[chromosomeIndex];
                const chromosomeData1d = data1d.filter(d => d.chromosome == partInfo.name);
                const res = data3D.basePairsResolution;
                for (let binIndex = 0; binIndex < partInfo.to - partInfo.from; binIndex++) {
                    for (const datum of chromosomeData1d) {
                        if (datum.from <= (binIndex + 1) * res && datum.to >= binIndex * res) {
                            valuesPerBin[binIndex + partInfo.from].push(datum.value);
                        }
                    }
                }
            }



            const aggregationFunction: (n: Array<number>) => number | undefined = {
                "min": _.min,
                "max": _.max,
                "mean": _.mean,
                "median": median,
                "sum": _.sum
            }[configuration.mapValues.aggregationFunction]
            const aggregatedValuesPerBin = valuesPerBin.map((vs) => {
                const result = aggregationFunction(vs)
                if (result == null || isNaN(result)) {
                    return 0;
                }
                return result;
            })


            setInnerColors(() => mapScaleToChromatin(aggregatedValuesPerBin, scale));
        }

        if (configuration.colorMappingMode == "centromers") {
            const mapData1D: Positions3D | null = data.data.find(d => d.id == isoDataID.wrap(configuration.mapValues.id))?.values as Positions3D | null;
            if (!mapData1D) {
                return;
            }
            const centromereBins = new Array(mapData1D.length);

            // Normalize centromeres to current bounding box
            const normalizeCenter = data3D.normalizeCenter;
            const normalizeScale = data3D.normalizeScale;
            const centromeres: Array<vec3> = [];
            for (const c of mapData1D) {
                let centromere = vec3.fromValues(c.x, c.y, c.z);

                centromere = vec3.sub(vec3.create(), centromere, normalizeCenter);
                centromere = vec3.scale(vec3.create(), centromere, normalizeScale);

                centromeres.push(centromere);
            }

            // Map centromere 3D position to 1D bin index
            for (let centromereIndex = 0; centromereIndex < centromeres.length; centromereIndex++) {
                let minDistance = 1.0;
                let minIndex = -1;

                for (let valueIndex = 0; valueIndex < data3D.values.length; valueIndex++) {
                    const value = vec3.fromValues(data3D.values[valueIndex].x, data3D.values[valueIndex].y, data3D.values[valueIndex].z);

                    const diff = vec3.sub(vec3.create(), centromeres[centromereIndex], value);
                    const distance = vec3.dot(diff, diff);

                    if (distance < minDistance) {
                        minDistance = distance;
                        minIndex = valueIndex;
                    }
                }

                centromereBins[centromereIndex] = minIndex;
            }

            // Map bin to distance
            const distances: Array<number> = [];
            for (let valueIndex = 0; valueIndex < data3D.values.length; valueIndex++) {
                const distance = Math.min(...centromereBins.map((v) => Math.abs(v - valueIndex)));
                distances.push(distance);
            }

            // Color inside with mapping
            // const colorScale = chroma.scale('YlGnBu');
            const colorScale = chroma.scale(['white', 'blue']);

            setInnerColors(() => mapScaleToChromatin(distances, colorScale));
        }

        if (configuration.colorMappingMode == "linear-order") {
            const order: Array<number> = [];
            for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                const partInfo = chromatineSlices[chromosomeIndex];
                for (let o = 0; o < partInfo.to - partInfo.from + 1; o++) {
                    order.push(o);
                }
            }
            const colorScale = chroma.scale('YlGnBu'); //pick better color scale
            setInnerColors(() => mapScaleToChromatin(order, colorScale));
        }

        if (configuration.colorMappingMode == 'sasa') {
            if (configuration.sasa.method == 'generated') {
                throw "Not implemented"
            }
            //TODO: per chromosome or whole chromosome
            const globalSasaValues: Array<number> = [];

            if (!configuration.sasa.individual) {
                globalSasaValues.push(...sasa(data3D.values, {
                    method: configuration.sasa.method,
                    probe_size: configuration.sasa.probeSize,
                }, configuration.sasa.accuracy))

            } else {
                for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                    const partInfo = chromatineSlices[chromosomeIndex];
                    const chromosomePositions = data3D.values.slice(partInfo.from, partInfo.to + 1);
                    globalSasaValues.push(...sasa(chromosomePositions, {
                        method: configuration.sasa.method,
                        probe_size: configuration.sasa.probeSize,
                    }, configuration.sasa.accuracy));
                }

                //TODO: fix underlying bug where the something sometimes don't contain last bin of the chromosome
                if (globalSasaValues.length < data3D.values.length) {
                    globalSasaValues.push(globalSasaValues.reduce((a, b) => a + b, 0) / globalSasaValues.length);
                }

            }


            const colorScale = chroma.scale(['white', 'green']);

            setInnerColors(() => mapScaleToChromatin(globalSasaValues, colorScale));
        }

        if (configuration.colorMappingMode == '3d-density') {
            //TODO: per chromosome or whole chromosome
            const densities: Array<number> = [];

            if (!configuration.density.individual) {
                densities.push(...density(data3D.values, configuration.density.probeSize))
            } else {

                for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                    const partInfo = chromatineSlices[chromosomeIndex];
                    const chromosomePositions = data3D.values.slice(partInfo.from, partInfo.to + 1);
                    densities.push(...density(
                        chromosomePositions,
                        configuration.density.probeSize // TODO: user setting
                    ));
                }
            }
            //TODO: fix underlying bug where the data3d.values sometimes don't contain last bin of the chromosome
            if (densities.length < data3D.values.length) {
                console.warn("Fixing bullshit")
                console.log(densities)
                console.log(data3D.values)
                densities.push(densities.reduce((a, b) => a + b, 0) / densities.length);
            }

            const colorScale = chroma.scale(['white', 'red']);

            setInnerColors(() => mapScaleToChromatin(densities, colorScale));
        }
        */

        setColors(() => newColors);
    }, [viewport, globalSelections.selections, configuration.data, configuration.sasa, data.data, configuration.chromosomes, configuration.density]);

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

        const selection = globalSelections.selections.find(s => s.id == configuration.data[selectedDatum].selectedSelectionID);
        if (!selection) {
            return;
        }

        if (closestIntersection.chromatinPart.dataId !== configuration.selectedDatum) {
            return;
        }

        if (closestIntersection != null && tool.type == ChromatinViewportToolType.PointSelection) {
            closestIntersection.chromatinPart.setBinColor(closestIntersection.binIndex, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
        } else if (closestIntersection != null && tool.type == ChromatinViewportToolType.SphereSelection && configuration.data[selectedDatum].selectedSelectionID) {
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
        } else if (tool.type == ChromatinViewportToolType.JoinSelection && configuration.selectedSelectionID != null) {
            // const selection = globalSelections.selections.find(s => s.id == configuration.selectedSelectionID);
            // if (!selection) {
            //     return;
            // }

            // if (closestIntersection) {
            //     closestIntersection.chromatinPart.setBinColor(closestIntersection.binIndex, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
            // }

            // if (tool.from != null) {
            //     const fromChromosomeSliceIndex = chromosomeSlices.findIndex(c => c.from <= tool.from! && tool.from! < c.to);
            //     const fromChromosomePart = viewport.getChromatinPartByChromosomeIndex(fromChromosomeSliceIndex);

            //     fromChromosomePart?.setBinColor(tool.from, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
            // }

            // if (closestIntersection && tool.from != null) {
            //     const closestIntersectionChromosomeOffset = chromosomeSlices[closestIntersection.chromatinPart.chromosomeIndex].from;

            //     const startBinIndex = Math.min(closestIntersectionChromosomeOffset + closestIntersection.binIndex, tool.from);
            //     const endBinIndex = Math.max(closestIntersectionChromosomeOffset + closestIntersection.binIndex, tool.from);

            //     for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
            //         const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);
            //         if (!chromatinPart) return;

            //         const binsPositions = chromatinPart.getBinsPositions();
            //         const binOffset = chromosomeSlices[chromosomeIndex].from;
            //         for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
            //             if (startBinIndex <= (binOffset + binIndex) && (binOffset + binIndex) < endBinIndex) {
            //                 chromatinPart.setBinColor(binIndex, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
            //             }
            //         }
            //     }
            // }
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

    function makeRulerTooltipInfo(closestIntersection: ChromatinIntersection): string | null {
        // if (configuration.tool.type == 'ruler' && configuration.tool.from) {
        //     const measuringChromosomeName = configuration.tool.from.chrom;
        //     const datum = data.data.find((d: Data) => configuration.data && d.id == configuration.data.id) as BinPositionsData;
        //     const hoverChromosome = datum.chromosomes.find((c) => c.name == closestIntersection.chromatinPart.name);
        //     const measuringChromosome = datum.chromosomes.find((c) => c.name == measuringChromosomeName);
        //     if (hoverChromosome && measuringChromosome) {
        //         const from3D = datum.values[measuringChromosome.from + configuration.tool.from.bin];
        //         const to3D = datum.values[hoverChromosome.from + closestIntersection.binIndex];
        //         const distance = vec3.distance(vec3.fromValues(from3D.x, from3D.y, from3D.z), vec3.fromValues(to3D.x, to3D.y, to3D.z));
        //         return `Distance from bin #${configuration.tool.from.bin} on ${configuration.tool.from.chrom} is ${Math.round(distance * 1000) / 1000} units`;
        //     }
        // }
        return null;
    }


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
            // if (tool.from == null) {
            //     updateConfiguration({
            //         ...configuration,
            //         tool: {
            //             ...tool,
            //             from: selectedChromosomeOffset + closestIntersection.binIndex
            //         }
            //     });
            // } else {
            //     const closestIntersectionChromosomeOffset = chromosomeSlices[closestIntersection.chromatinPart.chromosomeIndex].from;

            //     const startBinIndex = Math.min(closestIntersectionChromosomeOffset + closestIntersection.binIndex, tool.from);
            //     const endBinIndex = Math.max(closestIntersectionChromosomeOffset + closestIntersection.binIndex, tool.from);

            //     const value = isSecondaryModPressed ? 0 : 1;
            //     for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
            //         const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);
            //         if (!chromatinPart) continue;

            //         const binsPositions = chromatinPart.getBinsPositions();
            //         const binOffset = chromosomeSlices[chromosomeIndex].from;
            //         for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
            //             if (startBinIndex <= (binOffset + binIndex) && (binOffset + binIndex) <= endBinIndex) {
            //                 newBins[binOffset + binIndex] = value;
            //             }
            //         }
            //     }

            //     updateConfiguration({
            //         ...configuration,
            //         tool: {
            //             ...tool,
            //             from: null,
            //             to: null
            //         }
            //     });
            // }
        } else if (tool.type == ChromatinViewportToolType.Ruler) {
            // const ruler = { ...tool };

            // if (!isSecondaryModPressed) {
            //     ruler.from = {
            //         bin: closestIntersection.binIndex,
            //         chrom: closestIntersection.chromatinPart.name,
            //     };
            // } else {
            //     ruler.from = null;
            // }


            // updateConfiguration({
            //     ...configuration,
            //     tool: ruler
            // });
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
