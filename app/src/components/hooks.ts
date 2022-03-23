import { Actions, Model, TabNode } from "flexlayout-react";
import { Dispatch, useEffect, useState, useCallback } from "react";
import { useFreshTick } from "rooks";
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

export const useConfigurationTypeless = (id: number, configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>]) => useConfiguration<ViewportConfiguration>(id, configurationsReducer);

export function useSelections<T extends ConfigurationsWithSelections>(
    dataPartIndex: dataIndex | null,
    configurationReducer: ConfigurationReducer<T>,
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>]): Array<[Selection, ViewportSelectionOptions]> {
    const [configuration, updateConfiguration] = configurationReducer;
    const [globalSelections, dispatchGlobalSelections] = selectionsReducer;

    const [result, setResult] = useState<Array<[Selection, ViewportSelectionOptions]>>([]);

    useEffect(() => {
        if (!configuration.data) {
            setResult(() => []);
            return;
        }

        const dataPartID = configuration.data.id;
        const selections = dataPartID != null ? globalSelections.selections.filter(selection => selection.dataID === dataPartID) : [];
        const selectionsAssociatedData: Array<ViewportSelectionOptions> = (dataPartID != null && dataPartIndex != null) ? configuration.data.selections.map(s => { return { ...s } }) : [];

        if (dataPartIndex == null || dataPartID == null) return;

        const selectionsIDs = selections.map(s => s.id);
        const selectionsAssociatedDataIds = selectionsAssociatedData.map(s => s.selectionID);

        const toRemoveAssociatedDataIds = selectionsAssociatedDataIds.filter(s => !selectionsIDs.includes(s));
        const toAddAssociatedDataIds = selectionsIDs.filter(s => !selectionsAssociatedDataIds.includes(s));

        const newSelectionsAssociatedData = configuration.data.selections.filter(s => !toRemoveAssociatedDataIds.includes(s.selectionID)).map(s => { return { ...s } });

        for (const addID of toAddAssociatedDataIds) {
            newSelectionsAssociatedData.push({
                selectionID: addID,
                visible: true,
            });
        }

        if (toRemoveAssociatedDataIds.length > 0 || toAddAssociatedDataIds.length > 0) {
            const newData = {
                ...configuration.data,
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
    }, [configuration, configuration.data, globalSelections, dataPartIndex]);

    return result;
}



/**
 *
 * useResizeObserverRef hook
 *
 * Returns a resize observer for a React Ref and fires a callback
 * https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
 *
 * @param {ResizeObserverCallback} callback Function that needs to be fired on resize
 * @param {ResizeObserverOptions} options An options object allowing you to set options for the observation
 */

export type HTMLElementOrNull = HTMLElement | null;
export type CallbackRef = (node: HTMLElementOrNull) => any;
const config: ResizeObserverOptions = {
    box: "content-box",
};


function useResizeObserverRef(
    callback: ResizeObserverCallback,
    options: ResizeObserverOptions = config
): [CallbackRef] {
    const [node, setNode] = useState<HTMLElementOrNull>(null);
    const freshCallback = useFreshTick(callback);

    useEffect(() => {
        if (node) {
            // Create an observer instance linked to the callback function
            const observer = new ResizeObserver(callback);

            // Start observing the target node for resizes
            observer.observe(node, options);

            return () => {
                observer.disconnect();
            };
        }
    }, [node, freshCallback, options]);

    const ref: CallbackRef = useCallback((node: HTMLElementOrNull) => {
        setNode(node);
    }, []);

    return [ref];
}

export { useResizeObserverRef };