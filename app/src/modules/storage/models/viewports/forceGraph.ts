import { DataID } from "../data";
import { IViewportConfiguration, ViewportConfigurationType, blackBackground, ViewportSelectionOptions, IDataConfiguration } from "./shared";

export interface IForceGraphDataConfiguration extends IDataConfiguration {
  id: DataID,
  selections: Array<ViewportSelectionOptions>,
}

export interface ForceGraphViewportConfiguration extends IViewportConfiguration {
    type: ViewportConfigurationType.ForceGraph,
    tag: "FG",

    data: Array<IForceGraphDataConfiguration>
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