import { useEffect, useRef, useState, Dispatch } from "react";
import * as GraphicsModule from "../../modules/graphics";
import { ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, chromatinDataConfigurationEqual, getDefaultViewportSelectionOptions, IChromatinDataConfiguration, ChromatinViewportToolType, ConfigurationActionKind } from "../../modules/storage/models/viewports";
import { useCustomCompareEffect, useDeepCompareEffect, useMouse, useMouseHovered, usePrevious } from "react-use";
import { ChromatinIntersection, ChromatinPart, ChromatinRepresentation, ContinuousTube, Sphere, Spheres, CullPlane, BinPosition } from "../../modules/graphics";
import { vec3, vec4 } from "gl-matrix";
import { BinPositionsData, Data, DataAction, DataID, DataState, isoDataID, Position3D, Positions3D, Sparse1DNumericData, Sparse1DTextData } from "../../modules/storage/models/data";
import { SelectionAction, SelectionActionKind, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration } from "../hooks";
import { useKey } from "rooks";
import * as chroma from "chroma-js";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { iso } from "newtype-ts";
import { quantile } from "simple-statistics";
import _, { identity } from "lodash";
import { Spline } from "../../modules/graphics/primitives/spline";

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

    const [isPrimaryModPressed, setPrimaryModPressed] = useState(false);
    const [isSecondaryModPressed, setSecondaryModPressed] = useState(false);


    // Input
    useKey(["Control", "Meta"], () => setPrimaryModPressed(true), { eventTypes: ["keydown"] });
    useKey(["Control", "Meta"], () => setPrimaryModPressed(false), { eventTypes: ["keyup"] });

    useKey(["Alt"], () => setSecondaryModPressed(true), { eventTypes: ["keydown"] });
    useKey(["Alt"], () => setSecondaryModPressed(false), { eventTypes: ["keyup"] });

    // 
    const [innerColors, setInnerColors] = useState<Array<Array<vec4>>>([]);
    const [borderColors, setBorderColors] = useState<Array<Array<vec4>>>([]);

    // Viewport Setup
    useEffect(() => {
        if (props.graphicsLibrary && canvasElement != null && canvasElement.current) {
            const newViewport = props.graphicsLibrary.createChromatinViewport(canvasElement.current);
            newViewport.cameraConfiguration = configuration.camera;
            setViewport(() => newViewport);

            // Draw the scene repeatedly
            const render = async (frametime: number) => {
                await newViewport.render(frametime);

                requestAnimationFrame(render);
            }
            const requestID = requestAnimationFrame(render);

            return function cleanup() {
                viewport?.deallocate();
                window.cancelAnimationFrame(requestID);
            };
        }
    }, [props.graphicsLibrary, props.configurationID, canvasElement]);

    // Camera Update
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

    // Disable camera if control is pressed
    useEffect(() => {
        if (!viewport || !viewport.camera) return;

        viewport.camera.ignoreEvents = isPrimaryModPressed;
    }, [isPrimaryModPressed]);

    // Establish 3D structure
    const configurePart = (part: ChromatinPart, configuration: IChromatinDataConfiguration) => {
        if (part.structure instanceof ContinuousTube) {
            part.structure.radius = configuration.radius;
        } else if (part.structure instanceof Spheres) {
            part.structure.setRadiusAll(configuration.radius);
        } else if (part.structure instanceof Spline) {
            console.log('ok?');
            part.structure.radius = configuration.radius;
        }
    };

    // remove data removed from data tab 
    // useEffect(() => {
    //     const dataWithoutGlobalyRemoved = configuration.data.filter(confD => data.data.find(globalD => confD.id == globalD.id) != undefined);
    //     updateConfiguration({
    //         ...configuration,
    //         data: dataWithoutGlobalyRemoved
    //     })

    // }, [data, globalSelections]);

    useEffect(() => {
        if (!viewport.canvas || !configuration.data) return;

        viewport.clearChromatin();

        const datumUntyped = data.data.find((d: Data) => configuration.data && d.id == configuration.data.id);

        if (!datumUntyped || datumUntyped.type != '3d-positions') return;

        const datum = datumUntyped as BinPositionsData;

        if (!previousConfiguration || (previousConfiguration && ((previousConfiguration.data && previousConfiguration.data.id != configuration.data.id) || !previousConfiguration.data))) {
            const values = datum.values;
            const distances = [];
            for (let i = 0; i < values.length - 1; i++) {
                distances.push(
                    vec3.distance(vec3.fromValues(values[i].x, values[i].y, values[i].z), vec3.fromValues(values[i + 1].x, values[i + 1].y, values[i + 1].z))
                );
            }

            const quantiles = quantile(distances, [0.05, 0.95]);

            updateConfiguration({
                ...configuration,
                data: {
                    ...configuration.data,
                    radius: quantiles[0] / 2.0
                },
                radiusRange: { min: 0.0, max: quantiles[1] / 2.0 }
            });
        }

        for (const [chromosomeIndex, chromosome] of configuration.chromosomes.entries()) {
            if (!chromosome) continue;

            const chromosomeInfo = datum.chromosomes[chromosomeIndex];
            const positions = datum.values.slice(chromosomeInfo.from, chromosomeInfo.to);

            const center = positions.reduce((l, r) => { return { x: l.x + r.x, y: l.y + r.y, z: l.z + r.z } });
            center.x = configuration.explodedViewScale * (center.x / positions.length);
            center.y = configuration.explodedViewScale * (center.y / positions.length);
            center.z = configuration.explodedViewScale * (center.z / positions.length);

            const explodedPositions = positions.map(v => {
                return {
                    x: v.x + center.x,
                    y: v.y + center.y,
                    z: v.z + center.z,
                }
            });

            const chromatinPart = viewport.addPart(chromosomeInfo.name, explodedPositions as Positions3D, true, isoDataID.unwrap(datum.id), chromosomeIndex, configuration.representation, false);
            configurePart(chromatinPart, configuration.data);
        }

        viewport.rebuild();
    }, [viewport, configuration.explodedViewScale, configuration.data, configuration.chromosomes, configuration.representation, data.data]);

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
        if (!closestIntersection || !configuration.showTooltip) {
            dispatchCoordinatePreview({
                visible: false
            })
            return;
        }

        const additionalInfo: Array<String> = [];
        const rulerInfo = makeRulerTooltipInfo(closestIntersection);
        if (rulerInfo) {
            additionalInfo.push(rulerInfo);
        }

        dispatchCoordinatePreview({
            visible: true,
            type: "bin-coordinates-single",
            dataId: iso<DataID>().wrap(closestIntersection.chromatinPart.dataId),
            additionalInfo: additionalInfo,
            mappingIds: configuration.tooltip.tooltipDataIDs,
            textAggregation: configuration.tooltip.tooltipTextAggregation,
            numericAggregation: configuration.tooltip.tooltipNumericAggregation,
            from: closestIntersection.binIndex,
            chromosomeName: closestIntersection.chromatinPart.name
        })
    }, [viewport, closestIntersection])

    // Calculate/Cache Inner Colors (centromeres, 1D data mapping)
    useEffect(() => {
        if (!viewport || !configuration.data) {
            return;
        }


        const datum = configuration.data;
        const data3D = data.data.find(d => d.id == datum.id) as BinPositionsData;
        const chromatineSlices = data3D.chromosomes;

        if (configuration.colorMappingMode == "none") {
            setInnerColors(() => []);
        }

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


    }, [viewport, configuration.colorMappingMode, configuration.mapValues, configuration.data, data.data, configuration.chromosomes, configuration.explodedViewScale]);

    // Calculate/Cache border colors (selections)
    useEffect(() => {
        if (!viewport || !configuration.data) return;

        const datum = configuration.data;
        const binPositions = data.data.filter(d => d.id == datum.id)[0] as BinPositionsData;
        const chromosomeSlices = binPositions.chromosomes;

        const selections = globalSelections.selections.filter(s => s.dataID == datum.id);
        if (selections.length <= 0) {
            return;
        }

        // Reset colors
        // Color by mapping & selection
        // console.time('colorBins::selections');
        const allBorderColors: Array<Array<vec4>> = new Array(binPositions.chromosomes.length).fill([]);
        for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
            const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);
            if (!chromatinPart) {
                continue;
            }

            const colors: Array<vec4> = [vec4.fromValues(1.0, 1.0, 1.0, 1.0)];
            const binsLength = chromatinPart.getBinsPositions().length;
            const finalColorIndices = new Uint16Array(binsLength);
            for (let selectionIndex = 0; selectionIndex < selections.length; selectionIndex++) {
                const selection = selections[selectionIndex];
                const associatedData = datum.selections.find(s => s.selectionID == selection.id) ?? getDefaultViewportSelectionOptions(selection.id);

                if (!associatedData.visible) {
                    continue;
                }

                colors.push(vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, selection.color.a));
                const colorIndex = colors.length - 1;

                for (let i = 0; i < binsLength; i++) {
                    const j = chromosomeSlices[chromosomeIndex].from + i;
                    finalColorIndices[i] = selection.bins[j] * colorIndex + (1 - selection.bins[j]) * finalColorIndices[i];
                }
            }

            const finalColors: Array<vec4> = new Array(binsLength);
            for (let i = 0; i < binsLength; i++) {
                finalColors[i] = colors[finalColorIndices[i]];
            }

            allBorderColors[chromosomeIndex] = chromatinPart.cacheColorArray(finalColors);
        }

        setBorderColors(allBorderColors);
        // console.timeEnd('colorBins::selections');
    }, [viewport, globalSelections.selections, configuration.data, data.data, configuration.chromosomes, configuration.explodedViewScale]);

    // Color bins
    useEffect(() => {
        if (!viewport || !viewport.canvas || !configuration.data) {
            return;
        }

        const datum = configuration.data;
        const binPositions = data.data.filter(d => d.id == datum.id)[0] as BinPositionsData;
        const chromosomeSlices = binPositions.chromosomes;

        for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
            const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);

            if (!chromatinPart) {
                continue;
            }

            if (chromatinPart.structure instanceof ContinuousTube) {
                if (chromosomeIndex < innerColors.length && innerColors[chromosomeIndex] && innerColors[chromosomeIndex].length != 0) {
                    chromatinPart.structure.setColorsCombined(innerColors[chromosomeIndex]);
                } else {
                    chromatinPart.structure.resetColors(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
                }

                if (chromosomeIndex < borderColors.length && borderColors[chromosomeIndex].length != 0) {
                    chromatinPart.structure.setBorderColorsCombined(borderColors[chromosomeIndex]);
                } else {
                    chromatinPart.structure.resetBorderColors(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
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
        if (tool.type != ChromatinViewportToolType.SphereSelection || closestIntersection == null) {
            viewport.removeStructureByName(SphereSelectionName);
        }

        const selection = globalSelections.selections.find(s => s.id == configuration.selectedSelectionID);
        if (!selection) {
            return;
        }

        if (closestIntersection != null && tool.type == ChromatinViewportToolType.PointSelection) {
            closestIntersection.chromatinPart.setBinColor(closestIntersection.binIndex, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
        } else if (closestIntersection != null && tool.type == ChromatinViewportToolType.SphereSelection && configuration.selectedSelectionID) {
            // Only find position in space where the ray intersects
            const intersectionExactPosition = vec3.add(vec3.create(), closestIntersection.ray.origin, vec3.scale(vec3.create(), closestIntersection.ray.direction, closestIntersection.distance));

            //~ Snapping into bins (ALT)
            //~ get ID of the intersected bin and the position of the intersected bin (not the tube but the point)
            const binIdx = closestIntersection.binIndex;
            const binPositions = closestIntersection.chromatinPart.getBinsPositions();
            const binPos = binPositions[binIdx];

            const sphereCenter = isSecondaryModPressed ? binPos : intersectionExactPosition; //~ if ALT is pressed, snapping onto bin positions

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
            for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);
                if (!chromatinPart || !configuration.chromosomes) continue;

                const binsPositions = chromatinPart.getBinsPositions();
                for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                    const binPosition = binsPositions[binIndex];

                    if (vec3.distance(binPosition, sphereCenter) < sphereRadius) {
                        chromatinPart.setBinColorVec4(binIndex, selectionColor);
                    }
                }
            }
        } else if (tool.type == ChromatinViewportToolType.JoinSelection && configuration.selectedSelectionID != null) {
            const selection = globalSelections.selections.find(s => s.id == configuration.selectedSelectionID);
            if (!selection) {
                return;
            }

            if (closestIntersection) {
                closestIntersection.chromatinPart.setBinColor(closestIntersection.binIndex, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
            }

            if (tool.from != null) {
                const fromChromosomeSliceIndex = chromosomeSlices.findIndex(c => c.from <= tool.from! && tool.from! < c.to);
                const fromChromosomePart = viewport.getChromatinPartByChromosomeIndex(fromChromosomeSliceIndex);

                fromChromosomePart?.setBinColor(tool.from, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
            }

            if (closestIntersection && tool.from != null) {
                const closestIntersectionChromosomeOffset = chromosomeSlices[closestIntersection.chromatinPart.chromosomeIndex].from;

                const startBinIndex = Math.min(closestIntersectionChromosomeOffset + closestIntersection.binIndex, tool.from);
                const endBinIndex = Math.max(closestIntersectionChromosomeOffset + closestIntersection.binIndex, tool.from);

                for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                    const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);
                    if (!chromatinPart) return;

                    const binsPositions = chromatinPart.getBinsPositions();
                    const binOffset = chromosomeSlices[chromosomeIndex].from;
                    for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                        if (startBinIndex <= (binOffset + binIndex) && (binOffset + binIndex) < endBinIndex) {
                            chromatinPart.setBinColor(binIndex, { r: selection.color.r, g: selection.color.g, b: selection.color.b, a: 1.0 });
                        }
                    }
                }
            }
        } else if (tool.type == ChromatinViewportToolType.Ruler) {
            // color bin where the ruler is from
            if (tool.from != null) {
                const from = tool.from;
                const fromChromosomeSliceIndex = chromosomeSlices.findIndex(c => c.name == from.chrom);

                const fromChromosomePart = viewport.getChromatinPartByChromosomeIndex(fromChromosomeSliceIndex);

                fromChromosomePart?.setBinColor(tool.from.bin, { r: 1.0, g: 0, b: 0, a: 1.0 });
            }
        }
        // console.timeEnd('colorBins::intersection');
        // console.timeEnd('colorBins');
    }, [viewport, configuration.data, configuration.selectedSelectionID, globalSelections, closestIntersection, configuration.tool, configuration.chromosomes, innerColors, borderColors]);

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

        let planeNormal;
        switch (configuration.cutaway.axis) {
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
        const planePoint = vec3.scale(vec3.create(), planeNormal, configuration.cutaway.length);

        viewport.deleteCullObjects();
        viewport.addCullObject(new CullPlane(planeNormal, planePoint));
        viewport.updateCullObjects();
    }, [viewport, configuration.cutaway.axis, configuration.cutaway.length]);

    function makeRulerTooltipInfo(closestIntersection: ChromatinIntersection): string | null {
        if (configuration.tool.type == 'ruler' && configuration.tool.from) {
            const measuringChromosomeName = configuration.tool.from.chrom;
            const datum = data.data.find((d: Data) => configuration.data && d.id == configuration.data.id) as BinPositionsData;
            const hoverChromosome = datum.chromosomes.find((c) => c.name == closestIntersection.chromatinPart.name);
            const measuringChromosome = datum.chromosomes.find((c) => c.name == measuringChromosomeName);
            if (hoverChromosome && measuringChromosome) {
                const from3D = datum.values[measuringChromosome.from + configuration.tool.from.bin];
                const to3D = datum.values[hoverChromosome.from + closestIntersection.binIndex];
                const distance = vec3.distance(vec3.fromValues(from3D.x, from3D.y, from3D.z), vec3.fromValues(to3D.x, to3D.y, to3D.z));
                return `Distance from bin #${configuration.tool.from.bin} on ${configuration.tool.from.chrom} is ${Math.round(distance * 1000) / 1000} units`;
            }
        }
        return null;
    }

    const onClick = () => {
        if (!viewport || !configuration.data || !closestIntersection || !isPrimaryModPressed || !configuration.tool || !configuration.selectedSelectionID) {
            return;
        }

        const tool = configuration.tool;
        const selectionId = configuration.selectedSelectionID;

        const selectedChromatinPart = viewport.getChromatinPartByChromosomeIndex(closestIntersection.chromatinPart.chromosomeIndex);
        if (!selectedChromatinPart) {
            return;
        }

        const selection = globalSelections.selections.find(s => s.id == selectionId);
        if (!selection) {
            throw "No global selection found with local selection ID " + selectionId;
        }

        const datum = configuration.data;
        const binPositions = data.data.filter(d => d.id == datum.id)[0] as BinPositionsData;
        const chromosomeSlices = binPositions.chromosomes;
        const selectedChromosomeIndex = selectedChromatinPart.chromosomeIndex;
        const selectedChromosomeOffset = binPositions.chromosomes[selectedChromosomeIndex].from;

        const newBins: Uint16Array = selection.bins.slice();
        if (tool.type == ChromatinViewportToolType.PointSelection) {
            newBins[selectedChromosomeOffset + closestIntersection.binIndex] = isSecondaryModPressed ? 0 : 1;
        } else if (tool.type == ChromatinViewportToolType.SphereSelection) {
            const sphereCenter = vec3.add(vec3.create(), closestIntersection.ray.origin, vec3.scale(vec3.create(), closestIntersection.ray.direction, closestIntersection.distance));
            const sphereRadius = tool.radius;
            const value = isSecondaryModPressed ? 0 : 1;

            for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);
                if (!chromatinPart || !configuration.chromosomes[chromosomeIndex]) continue;

                const binsPositions = chromatinPart.getBinsPositions();
                const offset = binPositions.chromosomes[chromosomeIndex].from;
                for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                    const binPosition = binsPositions[binIndex];

                    if (vec3.distance(binPosition, sphereCenter) < sphereRadius && !viewport.cullObjects[0].cullsPoint(binPosition)) {
                        newBins[offset + binIndex] = value;
                    }
                }
            }
        } else if (tool.type == ChromatinViewportToolType.JoinSelection) {
            if (tool.from == null) {
                updateConfiguration({
                    ...configuration,
                    tool: {
                        ...tool,
                        from: selectedChromosomeOffset + closestIntersection.binIndex
                    }
                });
            } else {
                const closestIntersectionChromosomeOffset = chromosomeSlices[closestIntersection.chromatinPart.chromosomeIndex].from;

                const startBinIndex = Math.min(closestIntersectionChromosomeOffset + closestIntersection.binIndex, tool.from);
                const endBinIndex = Math.max(closestIntersectionChromosomeOffset + closestIntersection.binIndex, tool.from);

                const value = isSecondaryModPressed ? 0 : 1;
                for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
                    const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);
                    if (!chromatinPart) continue;

                    const binsPositions = chromatinPart.getBinsPositions();
                    const binOffset = chromosomeSlices[chromosomeIndex].from;
                    for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                        if (startBinIndex <= (binOffset + binIndex) && (binOffset + binIndex) <= endBinIndex) {
                            newBins[binOffset + binIndex] = value;
                        }
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
        } else if (tool.type == ChromatinViewportToolType.Ruler) {
            const ruler = { ...tool };

            if (!isSecondaryModPressed) {
                ruler.from = {
                    bin: closestIntersection.binIndex,
                    chrom: closestIntersection.chromatinPart.name,
                };
            } else {
                ruler.from = null;
            }


            updateConfiguration({
                ...configuration,
                tool: ruler
            });
        }

        globalSelectionsDispatch({ type: SelectionActionKind.UPDATE, id: selectionId, name: null, color: null, bins: newBins });
    };

    return (
        <canvas data-tip data-for='tooltip' ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden' }} tabIndex={1} onClick={() => onClick()}></canvas>
    );


}
