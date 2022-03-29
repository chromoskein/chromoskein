import { Dispatch } from "react";
import './Tools.scss';

import { ChromatinViewportTool, ChromatinViewportToolType, ConfigurationAction, ConfigurationState, ViewportConfiguration, ViewportConfigurationType, NoViewportTool, ToolConfiguration, DistanceViewportToolType, DistanceMapTool } from '../../modules/storage/models/viewports';
import { useConfiguration } from "../hooks";

import {
    CursorClick24Regular, Lasso24Regular, Flow20Regular, Ruler24Regular, ChevronUp24Regular, CaretUp24Filled, Square32Filled
} from '@fluentui/react-icons';

type ToolDescription = {
    type: ChromatinViewportToolType | DistanceViewportToolType | NoViewportTool;
    icon: JSX.Element;
    default: ToolConfiguration;
}


const chromatinViewportTools: Array<ToolDescription & { type: ChromatinViewportToolType, default: ChromatinViewportTool }> = [
    {
        type: ChromatinViewportToolType.PointSelection,
        icon: <CursorClick24Regular></CursorClick24Regular>,
        default: { type: ChromatinViewportToolType.PointSelection },
    },
    {
        type: ChromatinViewportToolType.SphereSelection,
        icon: <Lasso24Regular></Lasso24Regular>,
        default: { type: ChromatinViewportToolType.SphereSelection, radius: 0.25 }
    },
    {
        type: ChromatinViewportToolType.JoinSelection,
        icon: <Flow20Regular></Flow20Regular>,
        default: { type: ChromatinViewportToolType.JoinSelection, from: null, to: null }

    },
    {
        type: ChromatinViewportToolType.Ruler,
        icon: <Ruler24Regular></Ruler24Regular>,
        default: { type: ChromatinViewportToolType.Ruler, from: null }
    },
]

const tadViewportTools: Array<ToolDescription & { type: DistanceViewportToolType, default: DistanceMapTool }> = [
    {
        type: DistanceViewportToolType.PairSelection,
        icon: <ChevronUp24Regular style={{ transform: "scale(1.4)" }} ></ChevronUp24Regular>,
        default: { type: DistanceViewportToolType.PairSelection }
    },
    {
        type: DistanceViewportToolType.TriangleSelection,
        icon: <CaretUp24Filled style={{ transform: "scale(1.6)" }}></CaretUp24Filled>,
        default: { type: DistanceViewportToolType.TriangleSelection }
    },
    {
        type: DistanceViewportToolType.SquareSelection,
        icon: <Square32Filled style={{ transform: "scale(0.6) rotate(45deg)" }}></Square32Filled>,
        default: { type: DistanceViewportToolType.SquareSelection }
    },
]


export function ToolsList(props: {
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
}): JSX.Element {
    const configurationReducer = useConfiguration<ViewportConfiguration>(props.configurationID, props.configurationsReducer);
    const [configuration, updateConfiguration] = configurationReducer;

    function selectTool(tool: ToolDescription): void {
        if (configuration.tool.type == tool.type) {
            updateConfiguration({
                ...configuration,
                tool: { type: "no-tool" },
            });
            return;
        }

        if (configuration.type == ViewportConfigurationType.Chromatin) {
            updateConfiguration({
                ...configuration,
                tool: tool.default as ChromatinViewportTool
            })
        }
        if (configuration.type == ViewportConfigurationType.TAD) {
            updateConfiguration({
                ...configuration,
                tool: tool.default as DistanceMapTool
            })
        }
    }

    function renderSelectableToolIcons(tools: Array<ToolDescription>) {
        return tools.map(tool => <div
            className={`tool ${(configuration.tool.type == tool.type) ? "toolsPanel--icon selected" : "toolsPanel--icon"}`}
            key={`${tool.type}`}
            onClick={() => selectTool(tool)}
        >
            {tool.icon}
        </div>)
    }

    return <div className="toolsPanel">
        {configuration.type == ViewportConfigurationType.Chromatin && renderSelectableToolIcons(chromatinViewportTools)}
        {configuration.type == ViewportConfigurationType.TAD && renderSelectableToolIcons(tadViewportTools)}
    </div>
}
