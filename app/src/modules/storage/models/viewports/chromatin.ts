import { IColor } from "@fluentui/react";
import { vec3 } from "gl-matrix";
import { ChromatinRepresentation, OrbitCameraConfiguration, SmoothCameraConfiguration } from "../../../graphics";
import { DataID } from "../data";
import { SelectionID } from "../selections";
import { IDataConfiguration, IViewportConfiguration, ViewportConfigurationType, ViewportSelectionOptions, blackBackground, NoViewportTool } from "./shared";

export enum ChromatinViewportToolType {
    PointSelection = "point-selection",
    SphereSelection = "sphere-selection",
    JoinSelection = "join-selection",
    Ruler = "ruler",
}

export type ChromatinPointSelection = {
    type: ChromatinViewportToolType.PointSelection,
}

export type ChromatinSphereSelection = {
    type: ChromatinViewportToolType.SphereSelection,

    radius: number;
}

export type ChromatinJoinSelection = {
    type: ChromatinViewportToolType.JoinSelection,

    from: number | null;
    to: number | null;
}

export type ChromatinRuler = {
    type: ChromatinViewportToolType.Ruler,

    from: {
        bin: number;
        chrom: string;
    } | null;
}

export type ChromatinViewportTool = ChromatinPointSelection | ChromatinSphereSelection | ChromatinJoinSelection | ChromatinRuler;

export interface IChromatinDataConfiguration extends IDataConfiguration {
    id: DataID,
    secondaryID: DataID | null,

    chromosomes: Array<boolean>,

    color: IColor,

    representation: ChromatinRepresentation,
    
    radius: number,
    radiusRange: {
        min: number,
        max: number,
    },

    selectedSelectionID: SelectionID | null,
    selections: Array<ViewportSelectionOptions>,

    mapValues: {
        id: number;
        aggregationFunction: ChromatinViewportAggregationFunction;
    },

    showTooltip: boolean;
    tooltip: {
        tooltipDataIDs: Array<DataID>,
        tooltipTextAggregation: TooltipTextAggregation,
        tooltipNumericAggregation: TooltipNumericAggregation,
    }

    colorMappingMode: ChromatinViewportColorMappingMode;

    labeling: {
        showDebugViewport: boolean;
        showLabelingOverlay: boolean;
        showLabelAnchors: boolean;
        useMaxDistCPU: boolean;
        shownDebugTexture: LabelingDebugTexture,
    }

    sasa: {
        method: 'constant' | 'generated';
        probeSize: number;
        accuracy: number;
        individual: boolean
    }

    density: {
        probeSize: number;
        individual: boolean;
    }
}

export type ChromatinViewportAggregationFunction = "min" | "max" | "median" | "mean" | 'sum';
export type ChromatinViewportColorMappingMode = 'single-color' | 'selections' | 'centromers' | '1d-numerical' | '1d-density' | 'linear-order' | 'sasa' | '3d-density';
export type TooltipTextAggregation = 'none' | 'count';
export type TooltipNumericAggregation = 'none' | 'min' | 'max' | 'median' | 'mean' | 'sum';
export type LabelingDebugTexture = 'id' | 'contours' | 'dt';

export type Cutaway = {
    name: string,
    axis: 'X' | 'Y' | 'Z' | vec3,
    length: number,
}

export interface ChromatinViewportConfiguration extends IViewportConfiguration {
    type: ViewportConfigurationType.Chromatin,
    tag: "3D",

    camera: OrbitCameraConfiguration | SmoothCameraConfiguration,

    chromosomes: Array<boolean>,

    selectedDatum: number | null;
    data: Array<IChromatinDataConfiguration>;    

    tooltip: {
        tooltipDataIDs: Array<DataID>,
        tooltipTextAggregation: TooltipTextAggregation,
        tooltipNumericAggregation: TooltipNumericAggregation,
    }
    showTooltip: boolean;
    ssao: {
        radius: number;
    },

    selectedCutaway: number,
    cutaways: Array<Cutaway>,

    sectionCuts: {
        showDebugPlanes: boolean;
        showDebugBins: boolean;
        showDebugIntersections: boolean;
    }

    explodedViewScale: number;
    labeling: {
        showDebugViewport: boolean;
        showLabelingOverlay: boolean;
        showLabelAnchors: boolean;
        useMaxDistCPU: boolean;
        shownDebugTexture: LabelingDebugTexture,
    }

    sasa: {
        method: 'constant' | 'generated';
        probeSize: number;
        accuracy: number;
        individual: boolean
    }

    density: {
        probeSize: number;
        individual: boolean;
    }
}

export function chromatinDataConfigurationEqual(d1: IChromatinDataConfiguration, d2: IChromatinDataConfiguration): boolean {
    return d1.id === d2.id && d1.representation === d2.representation && d1.radius === d2.radius;
}

export function defaultChromatinViewportConfiguration(): ChromatinViewportConfiguration {
    return {
        type: ViewportConfigurationType.Chromatin,
        tabName: "Unnamed 3D Viewport",
        tag: "3D",

        selectedDatum: 0,

        data: [],
        chromosomes: [],

        selectedSelectionID: null,

        backgroundColor: blackBackground,

        camera: {
            rotX: 0.0,
            rotY: 0.0,
            distance: 100.0,
            lookAtPosition: { x: 0.0, y: 0.0, z: 0.0 }
        } as OrbitCameraConfiguration,

        tooltip: {
            tooltipDataIDs: [],
            tooltipTextAggregation: 'none',
            tooltipNumericAggregation: 'none',
        },
        showTooltip: true,
        ssao: {
            radius: 0.25,
            blurSize: 2,
        },

        selectedCutaway: 0,
        cutaways: [],

        sectionCuts: {
            showDebugPlanes: false,
            showDebugBins: false,
            showDebugIntersections: false,
        },

        tool: {
            type: 'no-tool',
        },

        explodedViewScale: 0.0,
        labeling: {
            showDebugViewport: false,
            showLabelingOverlay: false,
            showLabelAnchors: false,
            useMaxDistCPU: false,
            shownDebugTexture: 'id',
        },

        sasa: {
            method: 'constant',
            constant: 0.1,
            probeSize: 0.01,
            accuracy: 100,
            individual: false
        },

        density: {
            probeSize: 0.1,
            individual: false
        }

    } as ChromatinViewportConfiguration;
}