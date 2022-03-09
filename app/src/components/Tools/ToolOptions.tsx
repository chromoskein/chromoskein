import React, { Dispatch } from "react";
import './Tools.scss';

import { ChromatinViewportConfiguration, ChromatinViewportToolType, ConfigurationAction, ConfigurationState, ToolConfiguration, ViewportConfigurationType } from '../../modules/storage/models/viewports';
import { useConfigurationTypeless } from "../hooks";
import { Label, Separator, Slider, Stack } from "@fluentui/react";
import { Text } from '@fluentui/react/lib/Text';

export function ToolOptions(props: {
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
}): JSX.Element {
    const configurationReducer = useConfigurationTypeless(props.configurationID, props.configurationsReducer);
    const [configuration, updateConfiguration] = configurationReducer;
    const tool = configuration.tool;

    if (!tool) {
        return <div></div>
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


    const toolOptionsMenuFactory = (tool: ToolConfiguration | undefined): JSX.Element => {
        if (!tool) {
            return <></>
        }

        if (tool.type == ChromatinViewportToolType.PointSelection) {
            return <Stack.Item align="center">
                <Text nowrap variant='medium'>Hold <b>CONTROL</b> and click a pointed bin to the selection. Hold <b>CTRL + ALT</b> to remove a bin from the selection.</Text>
            </Stack.Item>
        }
        if (tool.type == ChromatinViewportToolType.SphereSelection) {
            return <>
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
                    <Text nowrap variant='medium'>Hold <b>CONTROL</b> and click to add all bins in the sphere to the selection. Hold <b>CTRL + ALT</b> to remove bins from the selection.</Text>
                </Stack.Item>
            </>
        }
        if (tool.type == ChromatinViewportToolType.JoinSelection) {
            return <>
                <Stack.Item align="center">
                    {tool.from == null && (<Text nowrap variant='medium'>Select a bin as starting point for a path.</Text>)}
                </Stack.Item>
                <Stack.Item align="center">{tool.from != null && (<Text nowrap variant='medium'># of starting bin is {tool.from}.</Text>)}</Stack.Item>
                <Stack.Item align="center">{tool.from != null && (<Text nowrap variant='medium'>Now select a bin to be the end point of a path.</Text>)}</Stack.Item>
                <Stack.Item align="center">
                    <Separator vertical></Separator>
                </Stack.Item>
                <Stack.Item align="center">
                    <Text nowrap variant='medium'>Hold <b>CONTROL</b> to select a path and add all bins on it to the selection. Hold <b>CTRL + ALT</b> to remove bins on the path from the selection.</Text>
                </Stack.Item>
            </>
        }

        return <></>

    }


    return <Stack horizontal styles={{ root: { height: '100%' } }} tokens={{ childrenGap: '8px', padding: '0px 8px' }} >
        {
            toolOptionsMenuFactory(tool)
        }
    </Stack>


}
