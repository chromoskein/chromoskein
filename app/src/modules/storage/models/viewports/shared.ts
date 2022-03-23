import { getColorFromRGBA, IColor } from "@fluentui/react";
import { DataID } from "../data";
import { SelectionID } from "../selections";
import { ChromatinViewportConfiguration, ChromatinViewportTool } from "./chromatin";
import { D1ViewportConfiguration } from "./d1";
import { DistanceMapTool, DistanceViewportConfiguration } from "./distanceMap";
import { ForceGraphViewportConfiguration } from "./forceGraph";

export const blackBackground = getColorFromRGBA({ r: 0, g: 0, b: 0, a: 255 });

export type dataIndex = number;

export type ViewportConfiguration = ChromatinViewportConfiguration | D1ViewportConfiguration | DistanceViewportConfiguration | ForceGraphViewportConfiguration;

export enum ViewportConfigurationType {
  Chromatin,
  D1,
  TAD,
  ForceGraph
}

export type NoViewportTool = {
  type: "no-tool";
};

export interface IDataConfiguration { }

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

export type ToolConfiguration = ChromatinViewportTool | DistanceMapTool | NoViewportTool;

export interface IViewportConfiguration {
  type: ViewportConfigurationType,

  tabName: string,
  data: Array<IDataConfiguration> | IDataConfiguration | null,

  selectedSelectionID: SelectionID | null,

  backgroundColor: IColor,

  tool: ToolConfiguration,
}