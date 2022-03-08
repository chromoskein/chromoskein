import { Model, TabNode } from "flexlayout-react";
import React, { CSSProperties, Dispatch } from "react";
import './RightPanel.scss';
import { ChromatinViewportConfigurationPanel } from './ChromatinViewportConfigurationPanel';
import { D1ViewportConfiguration } from "./D1ViewportConfiguration";
import { TreeView } from "./TreeView";
import { Pivot, PivotItem } from "@fluentui/react";
import { TADMapViewportConfiguration } from "./TADMapViewportConfiguration";
import { ConfigurationAction, ConfigurationState } from "../../modules/storage/models/viewports";
import { DataAction, DataState } from "../../modules/storage/models/data";
import { SelectionAction, SelectionState } from "../../modules/storage/models/selections";
import { ForceGraphViewportConfigurationPanel } from "./ForceGraphViewportConfigurationPanel";

export function RightPanel(props: {
  model: Model,
  configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
  dataReducer: [DataState, Dispatch<DataAction>],
  selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}): JSX.Element {
  const currentNode = props.model.getActiveTabset()?.getSelectedNode() as TabNode;

  const pivoItemStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  return (<div className="rightPanel">
    <Pivot aria-label="Right Panel" style={pivoItemStyles} styles={{
      itemContainer: {
        flexGrow: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }
    }}>
      <PivotItem headerText="Data" style={{ height: '100%' }}>
        <TreeView dataReducer={props.dataReducer} selectionsReducer={props.selectionsReducer}></TreeView>
      </PivotItem>

      <PivotItem headerText="Viewport Options" style={pivoItemStyles}>
        {currentNode && currentNode.getComponent() === 'ChromatinViewport' &&
          (<ChromatinViewportConfigurationPanel
            model={props.model}
            node={currentNode}
            configurationsReducer={props.configurationsReducer}
            dataReducer={props.dataReducer}
            selectionsReducer={props.selectionsReducer}
          ></ChromatinViewportConfigurationPanel>)
        }
        {currentNode && currentNode.getComponent() === 'D1Viewport' &&
          (<D1ViewportConfiguration
            model={props.model}
            node={currentNode}
            configurationsReducer={props.configurationsReducer}
            dataReducer={props.dataReducer}
            selectionsReducer={props.selectionsReducer}
          ></D1ViewportConfiguration>)
        }
        {currentNode && currentNode.getComponent() === 'TADMapViewport' &&
          (<TADMapViewportConfiguration
            model={props.model}
            node={currentNode}
            configurationsReducer={props.configurationsReducer}
            dataReducer={props.dataReducer}
            selectionsReducer={props.selectionsReducer}
          ></TADMapViewportConfiguration>)
        }
        {currentNode && currentNode.getComponent() === "ForceGraphViewport" &&
          (
            <ForceGraphViewportConfigurationPanel
              model={props.model}
              node={currentNode}
              configurationsReducer={props.configurationsReducer}
              dataReducer={props.dataReducer}
              selectionsReducer={props.selectionsReducer}
            />
          )}
      </PivotItem>
    </Pivot>
  </div>
  );
}
