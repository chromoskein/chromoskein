import { getColorFromRGBA, IColor } from '@fluentui/react';
import { CameraConfigurationType, ChromatinRepresentation, OrbitCameraConfiguration, OrthoCameraConfiguration, SmoothCameraConfiguration } from '../../graphics';
import { DataID } from './data';
import { SelectionID } from './selections';

const blackBackground = getColorFromRGBA({ r: 0, g: 0, b: 0, a: 255 });

export type dataIndex = number;

export type ViewportConfiguration = ChromatinViewportConfiguration | D1ViewportConfiguration | TADViewportConfiguration | ForceGraphViewportConfiguration;

export enum ViewportConfigurationType {
  Chromatin,
  D1,
  TAD,
  ForceGraph
}

export interface IDataConfiguration {
  id: DataID,
  selections: Array<ViewportSelectionOptions>,
}

export interface IViewportConfiguration {
  type: ViewportConfigurationType,

  tabName: string,
  data: Array<IDataConfiguration>,
  selectedDataIndex: dataIndex | null,
  selectedSelectionID: SelectionID | null,

  backgroundColor: IColor,
}

//#region ChromatinViewportConfiguration
export type ViewportSelectionOptions = {
  selectionID: SelectionID,
  visible: boolean,
}

export function getDefaultViewportSelectionOptions(selectionID: SelectionID): ViewportSelectionOptions {
  return {
    selectionID,
    visible: true,
  };
}

export interface ChromatinDataConfiguration extends IDataConfiguration {
  selections: Array<ViewportSelectionOptions>,

  representation: ChromatinRepresentation,
  normalizeToCenter: boolean,
  radius: number,

  mapValues: {
    id: number
  }
}

export interface ChromatinViewportConfiguration extends IViewportConfiguration {
  type: ViewportConfigurationType.Chromatin,
  tag: "3D",

  camera: OrbitCameraConfiguration | SmoothCameraConfiguration,

  data: Array<ChromatinDataConfiguration>,

  ssao: {
    radius: number;
    blurSize: number;
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
}

export function chromatinDataConfigurationEqual(d1: ChromatinDataConfiguration, d2: ChromatinDataConfiguration): boolean {
  return d1.id === d2.id && d1.representation === d2.representation && d1.radius === d2.radius && d1.normalizeToCenter && d2.normalizeToCenter;
}

export function defaultChromatinViewportConfiguration(): ChromatinViewportConfiguration {
  return {
    type: ViewportConfigurationType.Chromatin,
    tabName: "Unnamed 3D Viewport",
    tag: "3D",

    data: [],
    selectedDataIndex: null,
    selectedSelectionID: null,

    backgroundColor: blackBackground,

    camera: {
      rotX: 0.0,
      rotY: 0.0,
      distance: 100.0,
      lookAtPosition: { x: 0.0, y: 0.0, z: 0.0 }
    } as OrbitCameraConfiguration,

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
    }
  } as ChromatinViewportConfiguration;
}
//#endregion

export interface D1ViewportConfiguration extends IViewportConfiguration {
  type: ViewportConfigurationType.D1,
  tag: "1D",

  color: { r: number, g: number, b: number, a: number }
}

export function defaultD1ViewportConfiguration(): D1ViewportConfiguration {
  return {
    type: ViewportConfigurationType.D1,
    tag: "1D",
    tabName: "Unnamed 1D Data",

    data: [],
    selectedDataIndex: null,
    selectedSelectionID: null,

    backgroundColor: blackBackground,

    color: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }
  } as D1ViewportConfiguration;
}

export interface TADViewportConfiguration extends IViewportConfiguration {
  type: ViewportConfigurationType.TAD,
  tag: "TAD",

  camera: OrthoCameraConfiguration,
}

export function defaultTADViewportConfiguration(): TADViewportConfiguration {
  return {
    type: ViewportConfigurationType.TAD,
    tag: "TAD",
    tabName: "Unnamed TAD",

    data: [],
    selectedDataIndex: 0,
    selectedSelectionID: null,

    backgroundColor: blackBackground,

    camera: {
      type: CameraConfigurationType.Ortho,

      maxZoom: 1.0,
      zoom: 1.0,
      translateX: 0.0,
      translateY: 0.0,
    } as OrthoCameraConfiguration
  } as TADViewportConfiguration;
}

export interface ForceGraphViewportConfiguration extends IViewportConfiguration {
  type: ViewportConfigurationType.ForceGraph,
  tag: "FG",
}

export function defaultForceGraphViewportConfiguration(): ForceGraphViewportConfiguration {
  return {
    type: ViewportConfigurationType.ForceGraph,
    tag: "FG",
    tabName: "Unnamed Force Graph",

    data: [],
    selectedDataIndex: null,
    selectedSelectionID: null,

    backgroundColor: blackBackground,
  }
}

//#region State
type Configuration = {
  id: number;
  viewportConfiguration: ViewportConfiguration;
}

export type ConfigurationState = {
  maxId: number;
  configurations: Array<Configuration>;
}
//#endregion

//#region Reducer
export enum ConfigurationActionKind {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  UPDATE_SELECTIONS = 'UPDATE_SELECTIONS',
  SET = 'SET',
}

export type ConfigurationActionAdd = {
  type: ConfigurationActionKind.ADD;

  viewportConfiguration: ViewportConfiguration;
}

export type ConfigurationActionUpdate = {
  type: ConfigurationActionKind.UPDATE;

  id: number;
  viewportConfiguration: ViewportConfiguration;
};

export type ConfigurationActionUpdateSelections = {
  type: ConfigurationActionKind.UPDATE_SELECTIONS;

  id: number;
  selections: Array<ViewportSelectionOptions>;
};

export type ConfigurationActionSet = {
  type: ConfigurationActionKind.SET;

  state: ConfigurationState
};

export type ConfigurationAction = ConfigurationActionAdd | ConfigurationActionUpdate | ConfigurationActionSet;

export function configurationReducer(state: ConfigurationState, action: ConfigurationAction): ConfigurationState {
  switch (action.type) {
    case ConfigurationActionKind.ADD: {
      const maxId = state.maxId + 1;

      return {
        ...state,
        maxId,
        configurations: [...state.configurations, { id: maxId, viewportConfiguration: action.viewportConfiguration }]
      };
    }
    case ConfigurationActionKind.UPDATE: {
      const configurationIndex: number = state.configurations.findIndex(e => e.id == action.id);

      if (configurationIndex < 0) {
        return state;
      }

      const newConfigurations = [...state.configurations];
      newConfigurations[configurationIndex] = { id: action.id, viewportConfiguration: action.viewportConfiguration };

      return {
        ...state,
        configurations: newConfigurations
      }
    }
    case ConfigurationActionKind.SET: {
      return action.state;
    }
    default: return state;
  }
}
//#endregion
