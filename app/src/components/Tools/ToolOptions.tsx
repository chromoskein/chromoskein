import React, { Dispatch } from "react";
import './Tools.scss';

import { ChromatinViewportConfiguration, ChromatinViewportToolType, ConfigurationAction, ConfigurationState, ToolConfiguration, ViewportConfigurationType } from '../../modules/storage/models/viewports';
import { useConfigurationTypeless } from "../hooks";
import { Label, Separator, Slider, Stack } from "@fluentui/react";
import { Text } from '@fluentui/react/lib/Text';
import { UAParser } from "ua-parser-js";


export function ToolOptions(props: {
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
}): JSX.Element {
    const configurationReducer = useConfigurationTypeless(props.configurationID, props.configurationsReducer);
    const [configuration, updateConfiguration] = configurationReducer;
    const tool = configuration.tool;
    const isMac = new UAParser().getOS().name == 'Mac OS';
    const hasSelectedSelection = configuration.selectedSelectionID != null;


    const enforceSelectedSelection = (element: JSX.Element): JSX.Element => {
        if (hasSelectedSelection) {
            return element;
        }
        return <Stack.Item align="center">
            <Text nowrap variant='medium'>Ensure a selection is chosen in the Viewport Options</Text>
        </Stack.Item>;
    }

    const setSphereSelectionRadius = (radius: number) => {
        updateConfiguration({
            ...configuration,
            tool: {
                type: ChromatinViewportToolType.SphereSelection,
                radius: radius,
            }
        } as ChromatinViewportConfiguration);
    }


    const primaryClick = <strong>{isMac ? "command + click" : "Ctrl + click"}</strong>;
    const secondaryClick = <strong>{isMac ? "command + option + click" : "Ctrl + Alt + click"}</strong>;

    const toolOptionsMenuFactory = (tool: ToolConfiguration): JSX.Element => {
        if (tool.type == 'no-tool') {
            if (configuration.type == ViewportConfigurationType.Chromatin) {
                return <Stack.Item align="center">
                    <Text nowrap variant='medium'><strong>Left-click & drag</strong>: rotate
                        | <strong>{isMac ? "Middle-click (option + Left-click) & drag" : "Middle-click (Alt + Left-click) & drag"}</strong>: pan
                        | <strong>Scroll</strong>: zoom</Text>
                </Stack.Item>
            }
            if (configuration.type == ViewportConfigurationType.TAD) {
                return <Stack.Item align="center">
                    <Text nowrap variant='medium'><strong>Left-click & drag</strong>: pan
                        | <strong>Scroll</strong>: zoom</Text>
                </Stack.Item>
            }
            return <></>
        }

        if (tool.type == ChromatinViewportToolType.PointSelection) {
            return enforceSelectedSelection(<Stack.Item align="center">
                <Text nowrap variant='medium'>{primaryClick}: add to selection | {secondaryClick}: remove from selection.</Text>
            </Stack.Item>)
        }
        if (tool.type == ChromatinViewportToolType.SphereSelection) {
            return enforceSelectedSelection(<>
                <Stack.Item align="center">
                    <Label>Spherical Selection</Label>
                </Stack.Item>
                <Stack.Item align="center">
                    <Separator vertical></Separator>
                </Stack.Item>
                <Stack.Item align="center">
                    <Label>Radius</Label>
                </Stack.Item>
                <Stack.Item align="center" styles={{ root: { width: '200px' } }}>
                    <Slider label="" min={0.0} max={1.0} step={0.01} showValue snapToStep value={tool.radius} onChange={(value) => setSphereSelectionRadius(value)} />
                </Stack.Item>
                <Stack.Item align="center">
                    <Separator vertical></Separator>
                </Stack.Item>
                <Stack.Item align="center">
                    <Text nowrap variant='medium'>{primaryClick}: add to selection | {secondaryClick}: remove from selection.</Text>
                </Stack.Item>
            </>)
        }
        if (tool.type == ChromatinViewportToolType.JoinSelection) {
            return enforceSelectedSelection(<>
                <Stack.Item align="center">
                    {tool.from == null && (<Text nowrap variant='medium'>Select a bin as starting point for a path.</Text>)}
                </Stack.Item>
                <Stack.Item align="center">{tool.from != null && (<Text nowrap variant='medium'># of starting bin is {tool.from}.</Text>)}</Stack.Item>
                <Stack.Item align="center">
                    <Separator vertical></Separator>
                </Stack.Item>
                <Stack.Item align="center">
                    {tool.from == null
                        ? <Text nowrap variant='medium'>{primaryClick}: start adding to selection | {secondaryClick}: start removing from selection.</Text>
                        : <Text nowrap variant='medium'>{primaryClick}: end adding to selection | {secondaryClick}: end removing from selection.</Text>}
                </Stack.Item>
            </>)
        }

        if (tool.type == ChromatinViewportToolType.Ruler) {
            return <Stack.Item align="center">
                {tool.from == null && <Text nowrap variant='medium'>{primaryClick}: choose first bin</Text>}
                {tool.from != null && <Text nowrap variant='medium'>Measuring distance from bin #{tool.from.bin} on chromosome {tool.from.chrom}. {primaryClick}: choose other first bin | {secondaryClick}: reset chosen bins</Text>}
            </Stack.Item>
        }

        return <></>

    }


    return <Stack horizontal styles={{ root: { height: '100%' } }} tokens={{ childrenGap: '8px', padding: '0px 8px' }} >
        {
            toolOptionsMenuFactory(tool)
        }
    </Stack>


}
