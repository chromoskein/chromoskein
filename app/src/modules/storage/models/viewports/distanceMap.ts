import { OrthoCameraConfiguration, CameraConfigurationType } from "../../../graphics";
import { DataID } from "../data";
import { SelectionID } from "../selections";
import { blackBackground, IDataConfiguration, IViewportConfiguration, NoViewportTool, ViewportConfigurationType, ViewportSelectionOptions } from "./shared";

export enum DistanceViewportToolType {
  PairSelection = 'pair-selection',
  SquareSelection = 'square-selection',
  TriangleSelection = 'triangle-selection',
}

export type DistancePointSelection = {
  type: DistanceViewportToolType.PairSelection,
}

export type DistanceSquareSelection = {
  type: DistanceViewportToolType.SquareSelection,
}

export type DistanceTriangleSelection = {
  type: DistanceViewportToolType.TriangleSelection,
}


export type DistanceMapTool = DistancePointSelection | DistanceSquareSelection | DistanceTriangleSelection;

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
  tag: "DIST",

  data: DistanceDataConfiguration | DistanceSelectionConfiguration | null,

  camera: OrthoCameraConfiguration,

  tool: DistanceMapTool | NoViewportTool,
}

export function defaultDistanceViewportConfiguration(): DistanceViewportConfiguration {
  return {
    type: ViewportConfigurationType.TAD,
    tag: "DIST",
    tabName: "Unnamed Distance Map",

    data: null,

    selectedDataIndex: 0,
    selectedSelectionID: null,

    backgroundColor: blackBackground,

    tool: { type: 'no-tool' },

    camera: {
      type: CameraConfigurationType.Ortho,

      maxZoom: 1.0,
      zoom: 1.0,
      translateX: 0.0,
      translateY: 0.0,
    } as OrthoCameraConfiguration
  } as DistanceViewportConfiguration;
}