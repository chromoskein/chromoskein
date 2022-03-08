import { Actions, Model, TabNode } from "flexlayout-react";
import { Dispatch, useEffect, useState } from "react";
import { ChromatinViewportConfiguration, ConfigurationAction, ConfigurationActionKind, ConfigurationState, dataIndex, DistanceViewportConfiguration, ForceGraphViewportConfiguration, IViewportConfiguration, ViewportConfiguration, ViewportSelectionOptions } from "../modules/storage/models/viewports";
import { DataAction, DataState } from "../modules/storage/models/data";
import { SelectionAction, Selection, SelectionState } from "../modules/storage/models/selections";

// Only configurations that have selections can use this part
export type ConfigurationsWithSelections = ChromatinViewportConfiguration | DistanceViewportConfiguration | ForceGraphViewportConfiguration;

type ViewportNameReducer = [string, (name: string | undefined) => void]
export function useViewportName(node: TabNode, configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>]): ViewportNameReducer {

    const [viewportName, setViewportName] = useState(node.getName());

    const [configuration, setConfiguration] = useConfiguration<ViewportConfiguration>(node.getConfig(), configurationsReducer)


    useEffect(() => {
        const viewportNameRepresentation = viewportName === "" ? "Untitled" : viewportName
        setConfiguration({
            ...configuration,
            tabName: viewportNameRepresentation
        });
        node.getModel().doAction(Actions.renameTab(node.getId(), viewportNameRepresentation));

    }, [viewportName])

    useEffect(() => {
        setViewportName(configuration.tabName)
    }, [node.getId()])


    function setViewportNameSafe(name: string | undefined) {
        if (name) {
            setViewportName(name)
        } else {
            setViewportName("")
        }
    }

    return [viewportName, setViewportNameSafe]
}

export type ConfigurationReducer<T extends ViewportConfiguration> = [T, (newConfiguration: T) => void]
export function useConfiguration<T extends ViewportConfiguration>(id: number, configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>]): ConfigurationReducer<T> {
    const [configurations, setConfigurations] = configurationsReducer;
    const configuration = configurations.configurations.find(e => e.id == id);

    // todo: can't easily dynamically check for type - this assumes the type is correct
    if (!configuration) {
        throw Error("Can not find viewport configuration.")
    }
    const viewportConfiguration = configuration.viewportConfiguration as T;

    function updateViewportConfiguration(newConfiguration: T, previousConfiguration: { id: number }) {
        setConfigurations({
            type: ConfigurationActionKind.UPDATE,
            id: previousConfiguration.id,
            viewportConfiguration: newConfiguration
        })
    }

    return [viewportConfiguration, ((newConfiuration) => updateViewportConfiguration(newConfiuration, configuration))]
}

export function useConfigurationTypeless(id: number, configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>]): [ViewportConfiguration, (newConfiguration: ViewportConfiguration) => void] {
    const [configurations, setConfigurations] = configurationsReducer;
    const configuration = configurations.configurations.find(e => e.id == id);

    // todo: can't easily dynamically check for type - this assumes the type is correct
    if (!configuration) {
        throw Error("Can not find viewport configuration.")
    }
    const viewportConfiguration = configuration.viewportConfiguration;

    function updateViewportConfiguration(newConfiguration: ViewportConfiguration, previousConfiguration: { id: number }) {
        setConfigurations({
            type: ConfigurationActionKind.UPDATE,
            id: previousConfiguration.id,
            viewportConfiguration: newConfiguration
        })
    }

    return [viewportConfiguration, ((newConfiuration) => updateViewportConfiguration(newConfiuration, configuration))]
}

export function useSelections<T extends ConfigurationsWithSelections>(
    dataPartIndex: dataIndex | null,
    configurationReducer: ConfigurationReducer<T>,
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>]): Array<[Selection, ViewportSelectionOptions]> {
    const [configuration, updateConfiguration] = configurationReducer;
    const [globalSelections, dispatchGlobalSelections] = selectionsReducer;

    const [result, setResult] = useState<Array<[Selection, ViewportSelectionOptions]>>([]);

    useEffect(() => {
        const dataPartID = (dataPartIndex != null && configuration.data.length > dataPartIndex) ? configuration.data[dataPartIndex].id : null;
        const selections = dataPartID != null ? globalSelections.selections.filter(selection => selection.dataID === dataPartID) : [];
        const selectionsAssociatedData: Array<ViewportSelectionOptions> = (dataPartID != null && dataPartIndex != null) ? configuration.data[dataPartIndex].selections.map(s => { return { ...s } }) : [];

        if (dataPartIndex == null || dataPartID == null) return;

        const selectionsIDs = selections.map(s => s.id);
        const selectionsAssociatedDataIds = selectionsAssociatedData.map(s => s.selectionID);

        const toRemoveAssociatedDataIds = selectionsAssociatedDataIds.filter(s => !selectionsIDs.includes(s));
        const toAddAssociatedDataIds = selectionsIDs.filter(s => !selectionsAssociatedDataIds.includes(s));

        const newSelectionsAssociatedData = configuration.data[dataPartIndex].selections.filter(s => !toRemoveAssociatedDataIds.includes(s.selectionID)).map(s => { return { ...s } });

        for (const addID of toAddAssociatedDataIds) {
            newSelectionsAssociatedData.push({
                selectionID: addID,
                visible: true,
            });
        }

        if (toRemoveAssociatedDataIds.length > 0 || toAddAssociatedDataIds.length > 0) {
            const newData = [...configuration.data];
            newData[dataPartIndex] = {
                ...configuration.data[dataPartIndex],
                selections: newSelectionsAssociatedData
            }

            updateConfiguration({
                ...configuration,
                data: newData
            });
        }

        const newResult: Array<[Selection, ViewportSelectionOptions]> = [];
        for (const selection of selections) {
            const associatedSelection: ViewportSelectionOptions | undefined = selectionsAssociatedData.filter(s => s.selectionID == selection.id).at(0);

            if (associatedSelection) {
                newResult.push([selection, associatedSelection]);
            }
        }
        setResult(() => newResult);
    }, [configuration, configuration.data, configuration.selectedDataIndex, globalSelections, dataPartIndex]);

    return result;
}