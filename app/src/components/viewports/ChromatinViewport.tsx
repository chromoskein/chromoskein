import { useEffect, useRef, useState, Dispatch } from "react";
import * as GraphicsModule from "../../modules/graphics";
import { ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, chromatinDataConfigurationEqual, getDefaultViewportSelectionOptions, IChromatinDataConfiguration, ChromatinViewportToolType, ConfigurationActionKind } from "../../modules/storage/models/viewports";
import { useCustomCompareEffect, useDeepCompareEffect, useMouse, usePrevious } from "react-use";
import { ChromatinIntersection, ChromatinPart, ChromatinRepresentation, ContinuousTube, Sphere, Spheres, CullPlane, BinPosition } from "../../modules/graphics";
import { vec3, vec4 } from "gl-matrix";
import { BinPositionsData, Data, DataAction, DataID, DataState, isoDataID, Position3D, Positions3D } from "../../modules/storage/models/data";
import { SelectionAction, SelectionActionKind, SelectionState } from "../../modules/storage/models/selections";
import produce from "immer";
import { useConfiguration } from "../hooks";
import { useKey } from "rooks";
import * as Chroma from "chroma-js";
import { CoordinatePreviewAction, CoordinatePreviewState } from "../../modules/storage/models/coordinatePreview";
import { iso } from "newtype-ts";

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
    const canvasElement = useRef(null);
    const [viewport, setViewport] = useState<GraphicsModule.ChromatinViewport>(() => props.graphicsLibrary.createChromatinViewport(null));

    const previousViewport = usePrevious(viewport);
    const previousConfiguration = usePrevious(configuration);

    const mousePosition = useMouse(canvasElement);

    const [closestIntersection, setClosestIntersection] = useState<ChromatinIntersection | null>(null);
    const [radiusRange, setRadiusRange] = useState([0.0, 1.0]);

    const [isControlPressed, setControlPressed] = useState(false);
    const [isAltPressed, setAltPressed] = useState(false);

    // Input
    useKey(["ControlLeft"], () => setControlPressed(true), { eventTypes: ["keydown"] });
    useKey(["ControlLeft"], () => setControlPressed(false), { eventTypes: ["keyup"] });

    useKey(["AltLeft"], () => setAltPressed(true), { eventTypes: ["keydown"] });
    useKey(["AltLeft"], () => setAltPressed(false), { eventTypes: ["keyup"] });

    // 
    const [mappedValues, setMappedValues] = useState<Array<Array<vec4>>>([]);

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

        viewport.camera.ignoreEvents = isControlPressed;
    }, [isControlPressed]);

    // Establish 3D structure
    const configurePart = (part: ChromatinPart, configuration: IChromatinDataConfiguration) => {
        if (part.structure instanceof ContinuousTube) {
            part.structure.radius = configuration.radius;
        } else if (part.structure instanceof Spheres) {
            part.structure.setRadiusAll(configuration.radius);
        }
    };

    // remove data removed from data tab 
    useEffect(() => {
        const dataWithoutGlobalyRemoved = configuration.data.filter(confD => data.data.find(globalD => confD.id == globalD.id) != undefined);
        updateConfiguration({
            ...configuration,
            data: dataWithoutGlobalyRemoved
        })

    }, [data, globalSelections]);

    useEffect(() => {
        if (viewport.canvas == null) {
            return;
        }

        if (previousConfiguration && previousViewport == viewport) {
            const previousIds = previousConfiguration.data.map(e => e.id);
            const currentIds = configuration.data.map(e => e.id);

            // First remove parts from the viewport that are no longer in the current configuration
            const toRemoveDataIds = previousIds.filter(x => !currentIds.includes(x));
            for (const removeDataId of toRemoveDataIds) {
                viewport.removeChromatinPartByDataId(isoDataID.unwrap(removeDataId), false);
            }

            // Add to viewport newly added parts
            const toAddIds = currentIds.filter(x => !previousIds.includes(x));
            for (const addDataId of toAddIds) {
                const currentDataConfiguration = configuration.data.find(e => e.id == addDataId);

                if (!currentDataConfiguration) {
                    throw "Data with ID " + addDataId + " could not be found.";
                }

                const positions: Data = data.data.filter(d => d.id == addDataId)[0];

                if (positions && positions.type == '3d-positions') {
                    const chromatinPart = viewport.addPart(positions.values as Positions3D, true, isoDataID.unwrap(addDataId), currentDataConfiguration.representation, false);

                    configurePart(chromatinPart, currentDataConfiguration);
                }
            }

            // Compare & Change (if necessary) those data that are in the current configuration and can be found in the old one
            const intersectionIds = previousIds.filter(x => currentIds.includes(x));
            let representationChanged = false;
            let configurationChanged = false;
            for (const id of intersectionIds) {
                const chromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(id));

                if (!chromatinPart) {
                    throw "Chromatin part with data ID " + id + " could not be found.";
                }

                const previousDataConfiguration = previousConfiguration.data.find(e => e.id == id);
                const currentDataConfiguration = configuration.data.find(e => e.id == id);

                if (!previousDataConfiguration || !currentDataConfiguration) {
                    throw "Data with ID " + id + " could not be found.";
                }

                // Mismatch of representation 
                if ((chromatinPart.structure instanceof ContinuousTube && currentDataConfiguration.representation != ChromatinRepresentation.ContinuousTube) ||
                    (chromatinPart.structure instanceof Spheres && currentDataConfiguration.representation != ChromatinRepresentation.Spheres)) {
                    const positions: Data = data.data.filter(d => d.id == currentDataConfiguration.id)[0];

                    viewport.removeChromatinPartByDataId(isoDataID.unwrap(id), false);

                    if (positions && positions.type == '3d-positions') {
                        representationChanged = true;

                        const chromatinPart = viewport.addPart(positions.values as Positions3D, true, isoDataID.unwrap(id), currentDataConfiguration.representation, false);
                        configurePart(chromatinPart, currentDataConfiguration);
                    }
                } else {
                    if (!chromatinDataConfigurationEqual(previousDataConfiguration, currentDataConfiguration)) {
                        configurationChanged = true;
                        configurePart(chromatinPart, currentDataConfiguration);
                    }
                }
            }

            if (toRemoveDataIds.length > 0 || toAddIds.length > 0 || representationChanged || configurationChanged) {
                const parts = viewport.getChromatinParts();

                const quantiles = [0.0, 1.0];

                for (const part of parts) {
                    const quantile = part.quantiles;

                    quantiles[0] = Math.min(quantile[0]);
                    quantiles[1] = Math.max(quantile[1]);
                }

                if ((configuration.radiusRange.min - quantiles[0]) >= 0.01 || (configuration.radiusRange.max - quantiles[1]) >= 0.01) {
                    const min = (configuration.radiusRange.min / 2.0) / 100.0;
                    const step = (configuration.radiusRange.min / 2.0) / 100.0;

                    const newData = [...configuration.data];
                    for (let i = 0; i < newData.length; i++) {
                        newData[i] = {
                            ...newData[i],
                            radius: min + step * 25.0,
                        };
                    }

                    setRadiusRange([quantiles[0], quantiles[1]]);
                    updateConfiguration({
                        ...configuration,
                        data: newData,
                        radiusRange: { min: radiusRange[0], max: radiusRange[1] }
                    });
                }
            }

            if (toRemoveDataIds.length > 0 || toAddIds.length > 0 || representationChanged || configurationChanged) {
                viewport.rebuild();
            } else {
                viewport.buildBVH();
            }
        } else {
            for (const part of configuration.data) {
                const positions: Data = data.data.filter(d => d.id == part.id)[0];

                if (positions && positions.type == '3d-positions') {
                    const chromatinPart = viewport.addPart(positions.values as Positions3D, true, isoDataID.unwrap(part.id), part.representation, false);
                    configurePart(chromatinPart, part);
                }
            }

            if (configuration.data.length > 0) {
                viewport.rebuild();
            }
        }
    }, [viewport, configuration.data]);

    useEffect(() => {
        const newConfiguration = produce(configuration, (configuration: ChromatinViewportConfiguration) => {
            if (!configuration.radiusRange) return;

            const min = (configuration.radiusRange.min / 2.0) / 100.0;
            const max = (configuration.radiusRange.min / 2.0);
            const step = (configuration.radiusRange.min / 2.0) / 100.0;
            for (const data of configuration.data) {
                if (data.radius < min || data.radius > max) {
                    data.radius = min + step * 50.0;
                }
            }
        });

        if (newConfiguration) {
            updateConfiguration(newConfiguration);
        }
    }, [configuration.radiusRange.min, configuration.radiusRange.max]);

    // Find closest intersection
    useEffect(() => {
        setClosestIntersection(() => viewport.closestIntersectionBin({ x: mousePosition.elX * window.devicePixelRatio, y: mousePosition.elY * window.devicePixelRatio }));
    }, [viewport, mousePosition]);


    useEffect(() => {
        if (!closestIntersection) {
            dispatchCoordinatePreview({
                visible: false
            })
            return;
        }

        dispatchCoordinatePreview({
            visible: true,
            type: "bin-coordinates-single",
            dataId: iso<DataID>().wrap(closestIntersection.chromatinPart.dataId),
            from: closestIntersection.binIndex
        })
    }, [viewport, closestIntersection])

    // Calculate 1D Mapping
    useEffect(() => {
        const idData1D = configuration.mapValues.id;
        const datum = configuration.data[0];

        if (datum == null) {
            return;
        }
        let mapData1D = data.data.find(d => d.id == isoDataID.wrap(idData1D ?? -1))?.values as Positions3D;

        if (mapData1D == null) {
            setMappedValues([]);
            return
        }


        const centromereBins = new Array(mapData1D.length);

        const data3D = data.data.find(d => d.id == datum.id) as BinPositionsData;

        // Normalize centromeres to current bounding box
        const normalizeCenter = data3D.normalizeCenter;
        const normalizeScale = data3D.normalizeScale;
        const centromeres: Array<vec3> = [];
        for (const c of mapData1D!) {
            let centromere = vec3.fromValues(c.x, c.y, c.z);

            centromere = vec3.sub(vec3.create(), centromere, normalizeCenter);
            centromere = vec3.scale(vec3.create(), centromere, normalizeScale);

            centromeres.push(centromere);
        }

        // Map centromere 3D position to 1D bin index
        let binsOffset = 0;
        for (let centromereIndex = 0; centromereIndex < centromereBins.length; centromereIndex++) {
            let minDistance = 1.0;
            let minIndex = -1;

            binsOffset = 0;
            for (let dataIndex = 0; dataIndex < configuration.data.length; dataIndex++) {
                const datum = configuration.data[dataIndex];
                const chromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(datum.id));

                if (!chromatinPart) {
                    break;
                }

                const binsPositions = chromatinPart.getBinsPositions();
                for (let i = 0; i < binsPositions.length; i++) {
                    const bin1DPosition = binsOffset + i;

                    const diff = vec3.sub(vec3.create(), centromeres[centromereIndex], binsPositions[i]);
                    const distance = vec3.dot(diff, diff);

                    if (distance < minDistance) {
                        minDistance = distance;
                        minIndex = bin1DPosition;
                    }
                }

                binsOffset += binsPositions.length;
            }

            centromereBins[centromereIndex] = minIndex;
        }

        // Map bin to distance
        binsOffset = 0;
        let distances = [];
        for (let dataIndex = 0; dataIndex < configuration.data.length; dataIndex++) {
            const datum = configuration.data[dataIndex];
            const chromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(datum.id));

            if (!chromatinPart) {
                break;
            }

            const binsPositions = chromatinPart.getBinsPositions();
            for (let i = 0; i < binsPositions.length; i++) {
                const bin1DPosition = binsOffset + i;
                const distance = Math.min(...centromereBins.map((v) => Math.abs(v - bin1DPosition)));

                distances.push(distance);
            }

            binsOffset += binsPositions.length;
        }

        // Color inside with mapping
        const ratio = Math.max(...distances);
        distances = distances.map(v => v / ratio);
        const colorScale = Chroma.scale('YlGnBu');

        binsOffset = 0;
        const allColors = [];
        for (let dataIndex = 0; dataIndex < configuration.data.length; dataIndex++) {
            const datum = configuration.data[dataIndex];
            const chromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(datum.id));

            if (!chromatinPart) {
                // throw "Could not find chromatin part associated with data ID " + datum.id;
                continue;
            }

            const binsLength = chromatinPart.getBinsPositions().length;
            const colors = distances.slice(binsOffset, binsOffset + binsLength).map(v => {
                const c = colorScale(v).gl();
                return vec3.fromValues(c[0], c[1], c[2]);
            });

            // console.log(localDistances);

            const finalColorsArray = new Array(2 * binsLength + 2);
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
            allColors.push(finalColorsArray);

            binsOffset += binsLength;


            setMappedValues(allColors);
        }
    }, [viewport, configuration.mapValues, configuration.data, data.data]);

    // Color bins
    useEffect(() => {
        if (viewport.canvas == null) {
            return;
        }

        // console.time('colorBins');
        // Reset colors
        // Color by mappign & selection
        // console.time('colorBins::selections');
        for (let dataIndex = 0; dataIndex < configuration.data.length; dataIndex++) {
            const datum = configuration.data[dataIndex];
            const chromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(datum.id));

            if (!chromatinPart) {
                // throw "Could not find chromatin part associated with data ID " + datum.id;
                continue;
            }

            if (dataIndex < mappedValues.length) {
                if (chromatinPart.structure instanceof ContinuousTube) {
                    chromatinPart.structure.setColorsCombined(mappedValues[dataIndex]);
                }
            } else {
                chromatinPart.resetColor({ r: 1.0, g: 1.0, b: 1.0, a: 1.0 });
            }


            const selections = globalSelections.selections.filter(s => s.dataID == datum.id);
            if (selections.length <= 0) {
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
                    finalColorIndices[i] = selection.bins[i] * colorIndex + (1 - selection.bins[i]) * finalColorIndices[i];
                }
            }

            const finalColorsArray = new Array(2 * binsLength + 2);
            if (chromatinPart.structure instanceof ContinuousTube) for (let i = 0; i < binsLength; i++) {
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

            // chromatinPart.setBinColorVec4(binIndex, selectionColor);            
            if (chromatinPart.structure instanceof ContinuousTube) chromatinPart.structure.setBorderColorsCombined(finalColorsArray);
        }
        // console.timeEnd('colorBins::selections');

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
            const chromatinParts = viewport.getChromatinParts();
            const selectionColor = vec4.fromValues(selection.color.r, selection.color.g, selection.color.b, selection.color.a);
            for (let chromatinPartIndex = 0; chromatinPartIndex < chromatinParts.length; chromatinPartIndex++) {
                const chromatinPart = chromatinParts[chromatinPartIndex];

                const binsPositions = chromatinPart.getBinsPositions();
                for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                    const binPosition = binsPositions[binIndex];

                    if (vec3.distance(binPosition, sphereCenter) < sphereRadius) {
                        chromatinPart.setBinColorVec4(binIndex, selectionColor);
                    }
                }
            }
        } else if (tool.type == ChromatinViewportToolType.JoinSelection && configuration.selectedDataIndex != null && configuration.selectedSelectionID != null) {
            const datum = configuration.data[configuration.selectedDataIndex];
            const selectedChromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(datum.id));
            const selection = globalSelections.selections.find(s => s.id == configuration.selectedSelectionID);

            if (!selection || !selectedChromatinPart) {
                return;
            }

            if (closestIntersection) {
                closestIntersection.chromatinPart.setBinColor(closestIntersection.binIndex, { r: 1.0, g: 0.0, b: 0.0, a: 1.0 });
            }

            if (tool.from != null) {
                selectedChromatinPart.setBinColor(tool.from, { r: 1.0, g: 0.0, b: 0.0, a: 1.0 });
            }

            if (closestIntersection && tool.from != null) {
                const startBinIndex = Math.min(closestIntersection.binIndex, tool.from);
                const endBinIndex = Math.max(closestIntersection.binIndex, tool.from);

                for (let i = startBinIndex; i <= endBinIndex; i++) {
                    closestIntersection.chromatinPart.setBinColor(i, { r: 1.0, g: 0.0, b: 0.0, a: 1.0 });
                }
            }
        }
        // console.timeEnd('colorBins::intersection');
        // console.timeEnd('colorBins');
    }, [viewport, configuration.data, configuration.selectedSelectionID, globalSelections, closestIntersection, configuration.tool]);

    // useEffect(() => {
    //     if (viewport && configuration.dataMap1DId) {
    //         const d: Data = data.filter(d => d.id == configuration.dataMap1DId)[0];
    //         if (d && d.type == 'sparse-1d-data') {
    //             const values = d.values as Sparse1DData;

    //             const minValue = Math.min(...values.map(v => v.value));
    //             const maxValue = Math.max(...values.map(v => v.value));
    //             const normalizedValues = values.map(e => (e.value - minValue) / (maxValue - minValue));

    //             const stops = [
    //                 [0.0, srgb(0.011739032090271167, 0.47782361053538075, 0.48874621895870424, 1.0)],
    //                 [0.14285714285714285, srgb(0.06423534932055358, 0.5467522703238552, 0.5201230986266105, 1.0)],
    //                 [0.2857142857142857, srgb(0.14449179480517682, 0.6144260168813129, 0.5605855896574974, 1.0)],
    //                 [0.4285714285714285, srgb(0.24391015056316484, 0.6627643840063882, 0.6390474792530672, 1.0)],
    //                 [0.5714285714285714, srgb(0.3342426131506636, 0.6952073456801019, 0.7111028656305052, 1.0)],
    //                 [0.7142857142857142, srgb(0.4491830118608238, 0.7307955090652776, 0.7594410421791323, 1.0)],
    //                 [0.8571428571428571, srgb(0.562185263948661, 0.8271154472360531, 0.8135492996679684, 1.0)],
    //                 [1.0, srgb(0.7108972211752501, 0.8947260953223849, 0.894788409546123, 1.0)],
    //             ];

    //             const lerp = (start: number, end: number, amt: number) => {
    //                 return (1 - amt) * start + amt * end
    //             }

    //             const mappedColors = normalizedValues.map(val => {
    //                 let i = 0;

    //                 for (; i < stops.length; i++) {
    //                     if (stops[i][0] <= val && val <= stops[i + 1][0]) {
    //                         break;
    //                     }
    //                 }

    //                 const color0 = stops[i][1] as SRGB;
    //                 const color1 = stops[i + 1][1] as SRGB;

    //                 return {
    //                     r: lerp(color0.buf[0], color1.buf[0], val) * 255,
    //                     g: lerp(color0.buf[1], color1.buf[1], val) * 255,
    //                     b: lerp(color0.buf[2], color1.buf[2], val) * 255,
    //                     a: 255
    //                 };
    //             });

    //             // const gradient = multiColorGradient({
    //             //     num: points.length,
    //             //     stops,
    //             // }).map(e => { return { r: e.buf[0] * 255, g: e.buf[1] * 255, b: e.buf[2] * 255, a: e.buf[3] * 255 }; });

    //             for (let i = 0; i < values.length - 1; i++) {
    //                 viewport.setGradient(i, mappedColors.slice(i, i + 2), "linear");
    //             }
    //         }
    //     }
    // }, [viewport, data, configuration.dataMap1DId]);

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
        if (configuration.ssao.radius == 0) {
            viewport.shadowMethod = "Flat";
        } else {
            viewport.shadowMethod = "SSAO";
        }
        viewport.ssaoKernelRadius = configuration.ssao.radius;
    }, [viewport, configuration.ssao.radius]);

    useEffect(() => {
        viewport.ssaoBlurSize = configuration.ssao.blurSize;
    }, [viewport, configuration.ssao.blurSize]);


    useEffect(() => {
        viewport.showDebugPlanes = configuration.sectionCuts.showDebugPlanes;
    }, [viewport, configuration.sectionCuts.showDebugPlanes]);

    useEffect(() => {
        viewport.showDebugBins = configuration.sectionCuts.showDebugBins;
    }, [viewport, configuration.sectionCuts.showDebugBins]);

    useEffect(() => {
        viewport.showDebugIntersections = configuration.sectionCuts.showDebugIntersections;
    }, [viewport, configuration.sectionCuts.showDebugIntersections]);

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
        if (!viewport
            || !mousePosition
            || configuration.selectedDataIndex == null
            || configuration.selectedSelectionID == null
            || viewport.cullObjects.length == 0
            || !(viewport.cullObjects[0] instanceof CullPlane)
            || !configuration.tool) {
            return;
        }

        const tool = configuration.tool;

        const intersection = viewport.closestIntersectionBin({ x: mousePosition.elX * window.devicePixelRatio, y: mousePosition.elY * window.devicePixelRatio });

        const datum = configuration.data[configuration.selectedDataIndex];

        const selectedDataId = datum.id;
        const selectedChromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(selectedDataId));

        if (!selectedChromatinPart) {
            throw "No chromatin part associated with selected ID " + selectedDataId;
        }

        if (isControlPressed && intersection && intersection.highLevelID == selectedChromatinPart.highLevelID) {
            const selectionId = configuration.selectedSelectionID;
            const selection = globalSelections.selections.find(s => s.id == selectionId);

            if (!selection) {
                throw "No global selection found with local selection ID " + selectionId;
            }

            const newBins: Uint16Array = selection.bins.slice();
            if (tool.type == ChromatinViewportToolType.PointSelection) {
                newBins[intersection.binIndex] = isAltPressed ? 0 : 1;
            } else if (tool.type == ChromatinViewportToolType.SphereSelection) {
                const sphereCenter = vec3.add(vec3.create(), intersection.ray.origin, vec3.scale(vec3.create(), intersection.ray.direction, intersection.distance));
                const sphereRadius = tool.radius; // TODO: variable

                // Highlight all the bins inside the sphere
                const binsPositions = selectedChromatinPart.getBinsPositions();
                const value = isAltPressed ? 0 : 1;
                for (let binIndex = 0; binIndex < binsPositions.length; binIndex++) {
                    const binPosition = binsPositions[binIndex];

                    if (vec3.distance(binPosition, sphereCenter) < sphereRadius && !viewport.cullObjects[0].cullsPoint(binPosition)) {
                        newBins[binIndex] = value;
                    }
                }
            } else if (tool.type == ChromatinViewportToolType.JoinSelection) {
                if (tool.from == null) {
                    updateConfiguration({
                        ...configuration,
                        tool: {
                            ...tool,
                            from: intersection.binIndex
                        }
                    });
                } else {
                    const startBinIndex = Math.min(intersection.binIndex, tool.from);
                    const endBinIndex = Math.max(intersection.binIndex, tool.from);

                    const value = isAltPressed ? 0 : 1;
                    for (let i = startBinIndex; i <= endBinIndex; i++) {
                        newBins[i] = value;
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
        }
    };

    return (
        <canvas ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden' }} tabIndex={1} onClick={() => onClick()}></canvas>
    );
}
