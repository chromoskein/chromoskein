import { useEffect, useRef, useState, Dispatch } from "react";
import * as GraphicsModule from "../../modules/graphics";
import { ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, chromatinDataConfigurationEqual, getDefaultViewportSelectionOptions, IChromatinDataConfiguration, ChromatinViewportToolType, ConfigurationActionKind } from "../../modules/storage/models/viewports";
import { useCustomCompareEffect, useDeepCompareEffect, useMouse, useMouseHovered, usePrevious } from "react-use";
import { ChromatinIntersection, ChromatinPart, ChromatinRepresentation, ContinuousTube, Sphere, Spheres, CullPlane, BinPosition } from "../../modules/graphics";
import { vec3, vec4 } from "gl-matrix";
import { BinPositionsData, Data, DataAction, DataID, DataState, isoDataID, Position3D, Positions3D } from "../../modules/storage/models/data";
import { SelectionAction, SelectionActionKind, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration } from "../hooks";
import { useKey } from "rooks";
import * as Chroma from "chroma-js";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { iso } from "newtype-ts";
import { quantile } from "simple-statistics";

const SphereSelectionName = 'SPHERE_SELECTION';

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
                radiusRange: { min: quantiles[0] / 2.0, max: quantiles[1] / 2.0 }
            });
        }

        for (const [chromosomeIndex, chromosome] of configuration.chromosomes.entries()) {
            if (!chromosome) continue;

            const slice = datum.chromosomes[chromosomeIndex];
            const positions = datum.values.slice(slice.from, slice.to);

            const chromatinPart = viewport.addPart(positions as Positions3D, true, isoDataID.unwrap(datum.id), chromosomeIndex, ChromatinRepresentation.ContinuousTube, false);
            configurePart(chromatinPart, configuration.data);
        }

        viewport.rebuild();
    }, [viewport, configuration.data, configuration.chromosomes, data.data]);

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

        dispatchCoordinatePreview({
            visible: true,
            type: "bin-coordinates-single",
            dataId: iso<DataID>().wrap(closestIntersection.chromatinPart.dataId),
            mappingIds: configuration.otherMapValues,
            from: closestIntersection.binIndex
        })
    }, [viewport, closestIntersection])

    // Calculate/Cache Inner Colors (centromeres, 1D data mapping)
    useEffect(() => {
        if (!viewport || !configuration.data || !configuration.mapValues || configuration.mapValues.id < 0) return;

        const datum = configuration.data;
        const data3D = data.data.find(d => d.id == datum.id) as BinPositionsData;
        const mapData1D: Positions3D | null = data.data.find(d => d.id == isoDataID.wrap(configuration.mapValues.id))?.values as Positions3D;
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
        let binsOffset = 0;
        let distances = [];
        for (let valueIndex = 0; valueIndex < data3D.values.length; valueIndex++) {
            const distance = Math.min(...centromereBins.map((v) => Math.abs(v - valueIndex)));
            distances.push(distance);
        }

        // Color inside with mapping
        const ratio = Math.max(...distances);
        distances = distances.map(v => v / ratio);
        const colorScale = Chroma.scale('YlGnBu');

        binsOffset = 0;
        const allColors: Array<Array<vec4>> = new Array(data3D.chromosomes.length);
        for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
            const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);

            if (!chromatinPart) {
                continue;
            }

            const binsLength = chromatinPart.getBinsPositions().length;
            const colors = distances.slice(binsOffset, binsOffset + binsLength).map(v => {
                const c = colorScale(v).gl();
                return vec4.fromValues(c[0], c[1], c[2], 1.0);
            });

            const finalColorsArray: Array<vec4> = new Array(2 * binsLength + 2);
            if (chromatinPart.structure instanceof ContinuousTube) for (let i = 0; i < binsLength; i++) {
                if (i == 0) {
                    finalColorsArray[0] = colors[0];
                    finalColorsArray[1] = colors[0];
                    finalColorsArray[2] = colors[0];
                } else if (i == binsLength - 1) {
                    finalColorsArray[2 * i + 1] = colors[i];
                    finalColorsArray[2 * i + 2] = colors[i];
                    finalColorsArray[2 * i + 3] = colors[i];
                }
                else {
                    finalColorsArray[2 * i + 1] = colors[i];
                    finalColorsArray[2 * i + 2] = colors[i];
                }
            }
            allColors[chromosomeIndex] = finalColorsArray;

            binsOffset += binsLength;
        }

        setInnerColors(() => allColors);
    }, [viewport, configuration.mapValues, configuration.data, data.data, configuration.chromosomes]);

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
        const allBorderColors: Array<Array<vec4>> = new Array(binPositions.chromosomes.length);
        for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
            const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);

            if (!chromatinPart) {
                continue;
            }

            const colors = [vec4.fromValues(1.0, 1.0, 1.0, 1.0)];
            const binsLength = selections[0].bins.length;
            const finalColorIndices = new Uint16Array(binsLength);
            for (let selectionIndex = 0; selectionIndex < selections.length; selectionIndex++) {
                const selection = selections[selectionIndex];
                const associatedData = datum.selections.find(s => s.selectionID == selection.id) ?? getDefaultViewportSelectionOptions(selection.id);

                if (!associatedData.visible) {
                    continue;
                }

                colors.push(vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, selection.color.a));
                const colorIndex = colors.length - 1;

                for (let i = 0; i < selection.bins.length; i++) {
                    const j = chromosomeSlices[chromosomeIndex].from + i;
                    finalColorIndices[i] = selection.bins[j] * colorIndex + (1 - selection.bins[j]) * finalColorIndices[j];
                }
            }

            const finalColorsArray: Array<vec4> = new Array(2 * binsLength + 2);
            if (chromatinPart.structure instanceof ContinuousTube) {
                for (let i = 0; i < binsLength; i++) {
                    if (i == 0) {
                        finalColorsArray[0] = colors[finalColorIndices[0]];
                        finalColorsArray[1] = colors[finalColorIndices[0]];
                        finalColorsArray[2] = colors[finalColorIndices[0]];
                    } else if (i == binsLength - 1) {
                        finalColorsArray[2 * i + 1] = colors[finalColorIndices[i]];
                        finalColorsArray[2 * i + 2] = colors[finalColorIndices[i]];
                        finalColorsArray[2 * i + 3] = colors[finalColorIndices[i]];
                    }
                    else {
                        finalColorsArray[2 * i + 1] = colors[finalColorIndices[i]];
                        finalColorsArray[2 * i + 2] = colors[finalColorIndices[i]];
                    }
                }
            }
            allBorderColors[chromosomeIndex] = finalColorsArray;
        }

        setBorderColors(allBorderColors);
        // console.timeEnd('colorBins::selections');
    }, [viewport, globalSelections.selections, configuration.data, data.data, configuration.chromosomes]);

    // Color bins
    useEffect(() => {
        if (!viewport.canvas || !configuration.data) {
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
                if (innerColors[chromosomeIndex]) {
                    chromatinPart.structure.setColorsCombined(innerColors[chromosomeIndex]);
                } else {
                    chromatinPart.structure.resetColor(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
                    chromatinPart.structure.resetColor2(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
                }

                if (borderColors[chromosomeIndex]) {
                    chromatinPart.structure.setBorderColorsCombined(borderColors[chromosomeIndex]);
                } else {
                    chromatinPart.structure.resetBorderColors(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
                    chromatinPart.structure.resetBorderColors2(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
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

        if (closestIntersection != null && tool.type == ChromatinViewportToolType.PointSelection) {
            closestIntersection.chromatinPart.setBinColor(closestIntersection.binIndex, { r: 1.0, g: 0.0, b: 0.0, a: 1.0 });
        } else if (closestIntersection != null && tool.type == ChromatinViewportToolType.SphereSelection && configuration.selectedSelectionID) {
            const selection = globalSelections.selections.find(s => s.id == configuration.selectedSelectionID);

            if (!selection) {
                return;
            }

            // Only find position in space where the ray intersects
            const sphereCenter = vec3.add(vec3.create(), closestIntersection.ray.origin, vec3.scale(vec3.create(), closestIntersection.ray.direction, closestIntersection.distance));

            // // Update (create if not already created) the configuration of selection sphere
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
                if (!chromatinPart) return;

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
                closestIntersection.chromatinPart.setBinColor(closestIntersection.binIndex, { r: 1.0, g: 0.0, b: 0.0, a: 1.0 });
            }

            if (tool.from != null) {
                const fromChromosomeSliceIndex = chromosomeSlices.findIndex(c => c.from <= tool.from! && tool.from! < c.to);
                const fromChromosomeSlice = chromosomeSlices[fromChromosomeSliceIndex];
                const fromChromosomePart = viewport.getChromatinPartByChromosomeIndex(fromChromosomeSliceIndex);

                fromChromosomePart?.setBinColor(tool.from, { r: 1.0, g: 0.0, b: 0.0, a: 1.0 });
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
                            chromatinPart.setBinColor(binIndex, { r: 1.0, g: 0.0, b: 0.0, a: 1.0 });
                        }
                    }
                }
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
        viewport.ssaoKernelRadius = configuration.ssao.radius;
    }, [viewport, configuration.ssao.radius]);

    useEffect(() => {
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
                if (!chromatinPart || !configuration.chromosomes[chromosomeIndex]) return;

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
                    if (!chromatinPart) return;

                    const binsPositions = chromatinPart.getBinsPositions();
                    const binOffset = chromosomeSlices[chromosomeIndex].from;
                    for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                        if (startBinIndex <= (binOffset + binIndex) && (binOffset + binIndex) < endBinIndex) {
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
        }

        globalSelectionsDispatch({ type: SelectionActionKind.UPDATE, id: selectionId, name: null, color: null, bins: newBins });
    };

    return (
        <canvas ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden' }} tabIndex={1} onClick={() => onClick()}></canvas>
    );
}
