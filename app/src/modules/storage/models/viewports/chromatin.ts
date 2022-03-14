import { ChromatinRepresentation, OrbitCameraConfiguration, SmoothCameraConfiguration } from "../../../graphics";
import { DataID } from "../data";
import { IDataConfiguration, IViewportConfiguration, ViewportConfigurationType, ViewportSelectionOptions, blackBackground } from "./shared";

export enum ChromatinViewportToolType {
    PointSelection = 0,
    SphereSelection = 1,
    JoinSelection = 2,
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

export type ChromatinViewportTool = ChromatinPointSelection | ChromatinSphereSelection | ChromatinJoinSelection;

export interface IChromatinDataConfiguration extends IDataConfiguration {
    id: DataID,

    selections: Array<ViewportSelectionOptions>,
    representation: ChromatinRepresentation,
    radius: number,
}

export interface ChromatinViewportConfiguration extends IViewportConfiguration {
    type: ViewportConfigurationType.Chromatin,
    tag: "3D",

    camera: OrbitCameraConfiguration | SmoothCameraConfiguration,

    data: IChromatinDataConfiguration | null,
    chromosomes: Array<boolean>,

    mapValues: {
        id: number;
        aggregationFunction: string;
    },

    tooltipData: Array<DataID>,
    showTooltip: boolean;
    ssao: {
        radius: number;
    },

    radiusRange: {
        min: number,
        max: number,
    },

    cutaway: {
        axis: 'X' | 'Y' | 'Z',
        length: number,
    },

    sectionCuts: {
        showDebugPlanes: boolean;
        showDebugBins: boolean;
        showDebugIntersections: boolean;
    }

    colorMappingMode: 'none' | 'centromers' | '1d-numerical' | '1d-density'

    tool?: ChromatinViewportTool;
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

        tooltipData: [],
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

        sectionCuts: {
            showDebugPlanes: false,
            showDebugBins: false,
            showDebugIntersections: false,
        },
        colorMappingMode: 'none',

        tool: {} as ChromatinPointSelection,
    } as ChromatinViewportConfiguration;
}