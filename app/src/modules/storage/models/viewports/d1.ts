import { DataID } from "../data";
import { IViewportConfiguration, ViewportConfigurationType, blackBackground, IDataConfiguration } from "./shared";

export interface ID1DataConfiguration extends IDataConfiguration {
  id: DataID,
}

export interface D1ViewportConfiguration extends IViewportConfiguration {
  type: ViewportConfigurationType.D1,
  tag: "1D",

  data: Array<ID1DataConfiguration>,

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

    color: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
    tool: { type: 'no-tool' }
  } as D1ViewportConfiguration;
}