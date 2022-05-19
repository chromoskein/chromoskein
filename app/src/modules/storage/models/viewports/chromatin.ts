import { vec3 } from "gl-matrix";
import { ChromatinRepresentation, OrbitCameraConfiguration, SmoothCameraConfiguration } from "../../../graphics";
import { DataID } from "../data";
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

    selections: Array<ViewportSelectionOptions>,
    representation: ChromatinRepresentation,
    radius: number | null,
}

export type ChromatinViewportAggregationFunction = "min" | "max" | "median" | "mean" | 'sum';
export type ChromatinViewportColorMappingMode = 'none' | 'centromers' | '1d-numerical' | '1d-density' | 'linear-order' | 'sasa' | '3d-density';
export type TooltipTextAggregation = 'none' | 'count';
export type TooltipNumericAggregation = 'none' | 'min' | 'max' | 'median' | 'mean' | 'sum';

export type Cutaway = {
    name: string,
    axis: 'X' | 'Y' | 'Z' | vec3,
    length: number,
}

export interface ChromatinViewportConfiguration extends IViewportConfiguration {
    type: ViewportConfigurationType.Chromatin,
    tag: "3D",

    camera: OrbitCameraConfiguration | SmoothCameraConfiguration,

    data: IChromatinDataConfiguration | null,
    chromosomes: Array<boolean>,

    representation: ChromatinRepresentation,

    mapValues: {
        id: number;
        aggregationFunction: ChromatinViewportAggregationFunction;
    },

    tooltip: {
        tooltipDataIDs: Array<DataID>,
        tooltipTextAggregation: TooltipTextAggregation,
        tooltipNumericAggregation: TooltipNumericAggregation,
    }
    showTooltip: boolean;
    ssao: {
        radius: number;
    },

    radiusRange: {
        min: number,
        max: number,
    },

    cutaway: {
        axis: 'X' | 'Y' | 'Z' | vec3,
        length: number,
    },

    selectedCutaway: number,
    cutaways: Array<Cutaway>,

    sectionCuts: {
        showDebugPlanes: boolean;
        showDebugBins: boolean;
        showDebugIntersections: boolean;
    }

    colorMappingMode: ChromatinViewportColorMappingMode;

    tool: ChromatinViewportTool | NoViewportTool;

    explodedViewScale: number;
    showDebugViewport: boolean;
}

export function chromatinDataConfigurationEqual(d1: IChromatinDataConfiguration, d2: IChromatinDataConfiguration): boolean {
    return d1.id === d2.id && d1.representation === d2.representation && d1.radius === d2.radius;
}

export function defaultChromatinViewportConfiguration(): ChromatinViewportConfiguration {
    return {
        type: ViewportConfigurationType.Chromatin,
        tabName: "Unnamed 3D Viewport",
        tag: "3D",

        data: null,
        chromosomes: [],

        representation: ChromatinRepresentation.ContinuousTube,

        selectedSelectionID: null,

        backgroundColor: blackBackground,

        camera: {
            rotX: 0.0,
            rotY: 0.0,
            distance: 100.0,
            lookAtPosition: { x: 0.0, y: 0.0, z: 0.0 }
        } as OrbitCameraConfiguration,

        mapValues: {
            id: -1,
            aggregationFunction: 'mean'
        },
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

        radiusRange: {
            min: 0.0,
            max: 1.0,
        },

        cutaway: {
            axis: 'X',
            length: -1.0,
        },

        selectedCutaway: 0,
        cutaways: [],

        sectionCuts: {
            showDebugPlanes: false,
            showDebugBins: false,
            showDebugIntersections: false,
        },
        colorMappingMode: 'none',

        tool: {
            type: 'no-tool',
        },

        explodedViewScale: 0.0,
        showDebugViewport: true,
    } as ChromatinViewportConfiguration;
}