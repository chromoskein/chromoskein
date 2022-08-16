import './RightPanel.scss';

import { TextField, ComboBox, IComboBoxOption, IComboBox, Separator, SelectableOptionMenuItemType } from "@fluentui/react";
import FlexLayout, { Model, TabNode } from "flexlayout-react";
import React, { Dispatch } from "react";

import { ConfigurationAction, ConfigurationState, DistanceDataConfiguration, DistanceMapDataConfiguration, DistanceSelectionConfiguration, DistanceViewportConfiguration } from '../../modules/storage/models/viewports';
import { DataAction, DataID, DataState, isoDataID } from "../../modules/storage/models/data";
import { isoSelectionID, SelectionAction, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration, useSelections, useViewportName } from '../hooks';
import { SelectionsPart } from './SelectionsPart';

export function TADMapViewportConfiguration(props: {
    model: Model,
    node: TabNode,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}): JSX.Element {
    const configurationReducer = useConfiguration<DistanceViewportConfiguration>(props.node.getConfig(), props.configurationsReducer);

    const [data, dataDispatch] = props.dataReducer;
    const [configuration, updateConfiguration] = configurationReducer;
    const allSelections = props.selectionsReducer[0].selections;

    const [viewportName, setViewportName] = useViewportName(props.node, props.configurationsReducer);

    const selections = useSelections([configuration, updateConfiguration], props.dataReducer, props.selectionsReducer, 0);

    const dataList = data.data.filter(d => d.type == 'sparse-distance-matrix' || d.type == '3d-positions').map(d => {
        return {
            key: "data_" + isoDataID.unwrap(d.id),
            text: d.name,
        } as IComboBoxOption;
    });
    const selectionsList = allSelections.map(s => {
        return {
            key: "selection_" + isoSelectionID.unwrap(s.id),
            text: s.name,
        } as IComboBoxOption;
    });
    const comboBoxList = [
        { key: 'data', text: 'Data', itemType: SelectableOptionMenuItemType.Header },
        ...dataList,
        { key: 'selections', text: 'Selections', itemType: SelectableOptionMenuItemType.Header },
        ...selectionsList
    ];

    const setData = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (!configuration) return;

        if (option) {
            const key = option.key as string;
            const [type, id] = key.split('_');

            if (type == 'data') {
                const selectedDataID = isoDataID.wrap(parseInt(id));
                const selectedData = data.data.filter(d => d.id == selectedDataID);

                if (selectedData.length == 1) {
                    updateConfiguration({
                        ...configuration,
                        data: !configuration.data ? {
                            type: DistanceMapDataConfiguration.Data,
                            id: selectedDataID,
                            selections: []
                        } as DistanceDataConfiguration : {
                            ...configuration.data,
                            type: DistanceMapDataConfiguration.Data,
                            id: selectedDataID
                        } as DistanceDataConfiguration
                    });
                }
            } else if (type == 'selection') {
                const selectedSelectionID = isoSelectionID.wrap(parseInt(id));
                const selectedSelection = allSelections.filter(s => s.id == selectedSelectionID);

                if (selectedSelection.length == 1) {
                    updateConfiguration({
                        ...configuration,
                        data: !configuration.data ? {
                            type: DistanceMapDataConfiguration.Selection,
                            id: selectedSelectionID,
                            selections: []
                        } : {
                            ...configuration.data,
                            type: DistanceMapDataConfiguration.Selection,
                            id: selectedSelectionID
                        }
                    });
                }
            }
        }
    };

    if (!configuration) {
        return <div></div>;
    }

    let listSelectedID = null;
    if (configuration.data && configuration.data.id) {
        if (configuration.data.type === DistanceMapDataConfiguration.Data) {
            listSelectedID = "data_" + isoDataID.unwrap(configuration.data.id);
        }

        if (configuration.data.type === DistanceMapDataConfiguration.Selection) {
            listSelectedID = "selection_" + isoSelectionID.unwrap(configuration.data.id);
        }
    }

    return <div className="section">
        <TextField label="Name" value={viewportName} onChange={(e, v) => setViewportName(v)} />
        <ComboBox
            label="Data to visualize"
            allowFreeform={true}
            autoComplete={'on'}
            options={comboBoxList}
            onChange={setData}
            defaultSelectedKey={listSelectedID}
        />
        <div style={{ display: 'block', width: '100%', marginTop: '32px' }}></div>
        <Separator></Separator>
        <SelectionsPart
            selections={selections}
            configurationReducer={configurationReducer}
            dataReducer={props.dataReducer}
            selectionsReducer={props.selectionsReducer}
            selectedDataIndex={0}
        ></SelectionsPart>
    </div>
}
