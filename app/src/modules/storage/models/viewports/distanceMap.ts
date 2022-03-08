import { OrthoCameraConfiguration, CameraConfigurationType } from "../../../graphics";
import { DataID } from "../data";
import { SelectionID } from "../selections";
import { blackBackground, IDataConfiguration, IViewportConfiguration, ViewportConfigurationType, ViewportSelectionOptions } from "./shared";

export enum DistanceViewportToolType {
  PointSelection = 0,
  SquareSelection = 1,
  TriangleSelection = 2,
  TADSelection = 3,
}

export type DistancePointSelection = {
  type: DistanceViewportToolType.PointSelection,
}

export type DistanceSquareSelection = {
  type: DistanceViewportToolType.SquareSelection,
}

export type DistanceTriangleSelection = {
  type: DistanceViewportToolType.TriangleSelection,
}

export type DistanceTADSelection = {
  type: DistanceViewportToolType.TADSelection,
}

export type DistanceMapTool = DistancePointSelection | DistanceSquareSelection | DistanceTriangleSelection | DistanceTADSelection;

export enum DistanceMapDataConfiguration { Data, Selection }

export class DistanceDataConfiguration implements IDataConfiguration {
  type: DistanceMapDataConfiguration.Data = DistanceMapDataConfiguration.Data;
  id: DataID | null = null;
  selections: Array<ViewportSelectionOptions> = [];
}

export class DistanceSelectionConfiguration implements IDataConfiguration {
  type: DistanceMapDataConfiguration.Selection = DistanceMapDataConfiguration.Selection;
  id: SelectionID | null = null;
  selections: Array<ViewportSelectionOptions> = [];
}

export interface DistanceViewportConfiguration extends IViewportConfiguration {
    type: ViewportConfigurationType.TAD,
    tag: "TAD",

    data: Array<DistanceDataConfiguration | DistanceSelectionConfiguration>,
  
    camera: OrthoCameraConfiguration,

    tool?: DistanceMapTool,
  }
  
  export function defaultDistanceViewportConfiguration(): DistanceViewportConfiguration {
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
    } as DistanceViewportConfiguration;
  }