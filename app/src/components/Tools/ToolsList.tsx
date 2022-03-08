import React, { Dispatch } from "react";
import './Tools.scss';

import { ChromatinViewportTool, ChromatinViewportToolType, ConfigurationAction, ConfigurationState, ViewportConfigurationType } from '../../modules/storage/models/viewports';
import { useConfigurationTypeless } from "../hooks";

import { CursorClick24Regular, Lasso24Regular, Flow20Regular } from '@fluentui/react-icons';

const chromatinToolsIcons = [
    { icon: <CursorClick24Regular></CursorClick24Regular> },
    { icon: <Lasso24Regular></Lasso24Regular> },
    { icon: <Flow20Regular></Flow20Regular> },
];

export function ToolsList(props: {
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
}): JSX.Element {
    const configurationReducer = useConfigurationTypeless(props.configurationID, props.configurationsReducer);
    const [configuration, updateConfiguration] = configurationReducer;

    const selectTool = (index: number) => {
        if (configuration.tool && configuration.tool.type == index) {
            updateConfiguration({                
                ...configuration,
                tool: undefined,
            });

            return;
        }

        switch (configuration.type) {
            case ViewportConfigurationType.Chromatin: {
                let tool: ChromatinViewportTool = { type: ChromatinViewportToolType.PointSelection };

                switch (index) {
                    case 0: tool = { type: ChromatinViewportToolType.PointSelection }; break;
                    case 1: tool = { type: ChromatinViewportToolType.SphereSelection, radius: 0.05 }; break;
                    case 2: tool = { type: ChromatinViewportToolType.JoinSelection, from: null, to: null }; break;
                }

                updateConfiguration({
                    ...configuration,
                    tool,
                });
            }
                break;
        }
    }

    switch (configuration.type) {
        case ViewportConfigurationType.Chromatin: return <div className="toolsPanel">
            {chromatinToolsIcons.map((t, index) => {
                return <div key={index} className={(configuration.tool && configuration.tool.type == index) ? "toolsPanel--icon selected" : "toolsPanel--icon"} onClick={() => selectTool(index)}>{t.icon}</div>;
            })}
        </div>
        default: return <div className="toolsPanel"></div>
    }
}
