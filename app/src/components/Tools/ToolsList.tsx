import { Dispatch } from "react";
import './Tools.scss';

import { ChromatinViewportTool, ChromatinViewportToolType, ConfigurationAction, ConfigurationState, ViewportConfiguration, ViewportConfigurationType, NoViewportTool, ToolConfiguration, DistanceViewportToolType } from '../../modules/storage/models/viewports';
import { useConfiguration } from "../hooks";

import { CursorClick24Regular, Lasso24Regular, Flow20Regular, Ruler24Regular } from '@fluentui/react-icons';

const chromatinToolsIcons: Array<{ type: ChromatinViewportToolType, icon: JSX.Element }> = [
    { type: ChromatinViewportToolType.PointSelection, icon: <CursorClick24Regular></CursorClick24Regular> },
    { type: ChromatinViewportToolType.SphereSelection, icon: <Lasso24Regular></Lasso24Regular> },
    { type: ChromatinViewportToolType.JoinSelection, icon: <Flow20Regular></Flow20Regular> },
    { type: ChromatinViewportToolType.Ruler, icon: <Ruler24Regular></Ruler24Regular> },
]

export function ToolsList(props: {
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
}): JSX.Element {
    const configurationReducer = useConfiguration<ViewportConfiguration>(props.configurationID, props.configurationsReducer);
    const [configuration, updateConfiguration] = configurationReducer;

    const selectTool = (type: ChromatinViewportToolType | DistanceViewportToolType) => {
        if (configuration.tool.type == type) {
            updateConfiguration({
                ...configuration,
                tool: { type: "no-tool" },
            });
            return;
        }

        switch (configuration.type) {
            case ViewportConfigurationType.Chromatin: {
                let tool: ChromatinViewportTool = { type: ChromatinViewportToolType.PointSelection };

                switch (type) {
                    case ChromatinViewportToolType.PointSelection: tool = { type: ChromatinViewportToolType.PointSelection }; break;
                    case ChromatinViewportToolType.SphereSelection: tool = { type: ChromatinViewportToolType.SphereSelection, radius: 0.25 }; break;
                    case ChromatinViewportToolType.JoinSelection: tool = { type: ChromatinViewportToolType.JoinSelection, from: null, to: null }; break;
                    case ChromatinViewportToolType.Ruler: tool = { type: ChromatinViewportToolType.Ruler, from: null }; break;
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
            {chromatinToolsIcons.map((tool) => {
                return <div key={tool.type} className={(configuration.tool.type == tool.type) ? "toolsPanel--icon selected" : "toolsPanel--icon"} onClick={() => selectTool(tool.type)}>{tool.icon}</div>;
            })}
        </div>
        default: return <div className="toolsPanel"></div>
    }
}
