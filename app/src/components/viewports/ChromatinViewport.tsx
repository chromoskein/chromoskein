import { useEffect, useRef, useState, Dispatch } from "react";
import * as GraphicsModule from "../../modules/graphics";
import { ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, chromatinDataConfigurationEqual, getDefaultViewportSelectionOptions, IChromatinDataConfiguration, ChromatinViewportToolType, ConfigurationActionKind } from "../../modules/storage/models/viewports";
import { useCustomCompareEffect, useDeepCompareEffect, useMouse, usePrevious } from "react-use";
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
    const canvasElement = useRef(null);
    const [viewport, setViewport] = useState<GraphicsModule.ChromatinViewport>(() => props.graphicsLibrary.createChromatinViewport(null));

    const previousConfiguration = usePrevious(configuration);

    const mousePosition = useMouse(canvasElement);

    const [closestIntersection, setClosestIntersection] = useState<ChromatinIntersection | null>(null);

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
    }, [viewport, configuration.data, configuration.chromosomes]);

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
    // useEffect(() => {
    //     const distances = [];

    //     let mapData1D: Positions3D | null = null;
    //     if (configuration.mapValues.id >= 0) {
    //         mapData1D = data.data.find(d => d.id == isoDataID.wrap(configuration.mapValues.id))?.values as Positions3D;
    //     }

    //     if (mapData1D) {
    //         const centromereBins = new Array(mapData1D.length);

    //         const datum = configuration.data[0];
    //         const data3D = data.data.find(d => d.id == datum.id) as BinPositionsData;

    //         // Normalize centromeres to current bounding box
    //         const normalizeCenter = data3D.normalizeCenter;
    //         const normalizeScale = data3D.normalizeScale;
    //         const centromeres: Array<vec3> = [];
    //         for (const c of mapData1D!) {
    //             let centromere = vec3.fromValues(c.x, c.y, c.z);

    //             centromere = vec3.sub(vec3.create(), centromere, normalizeCenter);
    //             centromere = vec3.scale(vec3.create(), centromere, normalizeScale);

    //             centromeres.push(centromere);
    //         }

    //         // Map centromere 3D position to 1D bin index
    //         let binsOffset = 0;
    //         for (let centromereIndex = 0; centromereIndex < centromereBins.length; centromereIndex++) {
    //             let minDistance = 1.0;
    //             let minIndex = -1;

    //             binsOffset = 0;
    //             for (let dataIndex = 0; dataIndex < configuration.data.length; dataIndex++) {
    //                 const datum = configuration.data[dataIndex];
    //                 const chromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(datum.id));

    //                 if (!chromatinPart) {
    //                     break;
    //                 }

    //                 const binsPositions = chromatinPart.getBinsPositions();
    //                 for(let i = 0; i < binsPositions.length; i++) {
    //                     const bin1DPosition = binsOffset + i;

    //                     const diff = vec3.sub(vec3.create(), centromeres[centromereIndex], binsPositions[i]);
    //                     const distance = vec3.dot(diff, diff);

    //                     if (distance < minDistance) {
    //                         minDistance = distance;
    //                         minIndex = bin1DPosition;
    //                     }
    //                 }

    //                 binsOffset += binsPositions.length;
    //             }

    //             centromereBins[centromereIndex] = minIndex;
    //         }

    //         // Map bin to distance
    //         binsOffset = 0;
    //         let distances = [];
    //         for (let dataIndex = 0; dataIndex < configuration.data.length; dataIndex++) {
    //             const datum = configuration.data[dataIndex];
    //             const chromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(datum.id));

    //             if (!chromatinPart) {
    //                 break;
    //             }

    //             const binsPositions = chromatinPart.getBinsPositions();
    //             for(let i = 0; i < binsPositions.length; i++) {
    //                 const bin1DPosition = binsOffset + i;
    //                 const distance = Math.min(...centromereBins.map((v) => Math.abs(v - bin1DPosition)));

    //                 distances.push(distance);
    //             }

    //             binsOffset += binsPositions.length;
    //         }

    //         // Color inside with mapping
    //         const ratio = Math.max(...distances);
    //         distances = distances.map(v => v / ratio);
    //         const colorScale = Chroma.scale('YlGnBu');

    //         binsOffset = 0;
    //         const allColors = [];
    //         for (let dataIndex = 0; dataIndex < configuration.data.length; dataIndex++) {
    //             const datum = configuration.data[dataIndex];
    //             const chromatinPart = viewport.getChromatinPartByDataId(isoDataID.unwrap(datum.id));

    //             if (!chromatinPart) {
    //                 // throw "Could not find chromatin part associated with data ID " + datum.id;
    //                 continue;
    //             }

    //             const binsLength = chromatinPart.getBinsPositions().length;
    //             const colors = distances.slice(binsOffset, binsOffset + binsLength).map(v => { 
    //                 const c = colorScale(v).gl();
    //                 return vec3.fromValues(c[0], c[1], c[2]);
    //             });

    //             const finalColorsArray = new Array(2 * binsLength + 2);
    //             if (chromatinPart.structure instanceof ContinuousTube) for (let i = 0; i < binsLength; i++) {
    //                 if (i == 0) {
    //                     finalColorsArray[0] = colors[0];
    //                     finalColorsArray[1] = colors[0];
    //                     finalColorsArray[2] = colors[0];
    //                 } else if (i == binsLength - 1) {
    //                     finalColorsArray[2 * i + 1] = colors[i];
    //                     finalColorsArray[2 * i + 2] = colors[i];
    //                     finalColorsArray[2 * i + 3] = colors[i];
    //                 }
    //                 else {
    //                     finalColorsArray[2 * i + 1] = colors[i];
    //                     finalColorsArray[2 * i + 2] = colors[i];
    //                 }
    //             }                
    //             allColors.push(finalColorsArray);

    //             binsOffset += binsLength;
    //         }

    //         setMappedValues(allColors);
    //     } else {
    //         setMappedValues([]);
    //     }
    // }, [viewport, configuration.mapValues, configuration.data, data.data]);

    // Color bins
    useEffect(() => {
        if (!viewport.canvas || !configuration.data) {
            return;
        }

        const datum = configuration.data;
        const binPositions = data.data.filter(d => d.id == datum.id)[0] as BinPositionsData;
        const chromosomeSlices = binPositions.chromosomes;

        // console.time('colorBins');
        // Reset colors
        // Color by mapping & selection
        // console.time('colorBins::selections');
        for (let chromosomeIndex = 0; chromosomeIndex < configuration.chromosomes.length; chromosomeIndex++) {
            const chromatinPart = viewport.getChromatinPartByChromosomeIndex(chromosomeIndex);

            if (!chromatinPart) {
                continue;
            }

            if (chromosomeIndex < mappedValues.length) {
                if (chromatinPart.structure instanceof ContinuousTube) {
                    chromatinPart.structure.setColorsCombined(mappedValues[chromosomeIndex]);
                    chromatinPart.structure.resetBorderColors(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
                    chromatinPart.structure.resetBorderColors2(vec4.fromValues(1.0, 1.0, 1.0, 1.0));
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
                    finalColorIndices[i] = selection.bins[chromosomeSlices[chromosomeIndex].from + i] * colorIndex + (1 - selection.bins[chromosomeSlices[chromosomeIndex].from + i]) * finalColorIndices[chromosomeSlices[chromosomeIndex].from + i];
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
        } else if (tool.type == ChromatinViewportToolType.JoinSelection && configuration.selectedSelectionID != null) {
            /*const datum = configuration.data[configuration.selectedDataIndex];
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
            }*/
        }
        // console.timeEnd('colorBins::intersection');
        // console.timeEnd('colorBins');
    }, [viewport, configuration.data, configuration.selectedSelectionID, globalSelections, closestIntersection, configuration.tool, configuration.chromosomes, mappedValues]);

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
        if (!viewport || !configuration.data || !closestIntersection || !isControlPressed || !configuration.tool || !configuration.selectedSelectionID) {
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
        const selectedChromosomeIndex = selectedChromatinPart.chromosomeIndex;
        const selectedChromosomeOffset = binPositions.chromosomes[selectedChromosomeIndex].from;

        const newBins: Uint16Array = selection.bins.slice();
        if (tool.type == ChromatinViewportToolType.PointSelection) {
            newBins[selectedChromosomeOffset + closestIntersection.binIndex] = isAltPressed ? 0 : 1;
        } else if (tool.type == ChromatinViewportToolType.SphereSelection) {
            const sphereCenter = vec3.add(vec3.create(), closestIntersection.ray.origin, vec3.scale(vec3.create(), closestIntersection.ray.direction, closestIntersection.distance));
            const sphereRadius = tool.radius; 

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
            // if (tool.from == null) {
            //     updateConfiguration({
            //         ...configuration,
            //         tool: {
            //             ...tool,
            //             from: intersection.binIndex
            //         }
            //     });
            // } else {
            //     const startBinIndex = Math.min(intersection.binIndex, tool.from);
            //     const endBinIndex = Math.max(intersection.binIndex, tool.from);

            //     const value = isAltPressed ? 0 : 1;
            //     for (let i = startBinIndex; i <= endBinIndex; i++) {
            //         newBins[i] = value;
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
        }

        globalSelectionsDispatch({ type: SelectionActionKind.UPDATE, id: selectionId, name: null, color: null, bins: newBins });
    };

    return (
        <canvas ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden' }} tabIndex={1} onClick={() => onClick()}></canvas>
    );
}
