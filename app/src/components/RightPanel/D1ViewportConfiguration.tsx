import './RightPanel.scss';

import { TextField, ComboBox, IComboBoxOption, IComboBox } from "@fluentui/react";
import FlexLayout, { Model, TabNode } from "flexlayout-react";
import React, { Dispatch } from "react";
import { produce } from 'immer';

import { ConfigurationAction, ConfigurationActionKind, ConfigurationState, D1ViewportConfiguration, ViewportConfigurationType } from '../../modules/storage/models/viewports';
import { DataAction, DataID, DataState, isoDataID } from "../../modules/storage/models/data";
import { SelectionAction, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration, useViewportName } from '../hooks';

export function D1ViewportConfiguration(props: {
    model: Model,
    node: TabNode,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}): JSX.Element {
    const configurationReducer = useConfiguration<D1ViewportConfiguration>(props.node.getConfig(), props.configurationsReducer);

    const [data, dataDispatch] = props.dataReducer;
    const [configuration, updateConfiguration] = configurationReducer;

    const [viewportName, setViewportName] = useViewportName(props.node, props.configurationsReducer);

    const dataOptions = data.data.filter(d => d.type == 'sparse-1d-data-text').map(d => {
        return {
            key: isoDataID.unwrap(d.id),
            text: d.name,
        } as IComboBoxOption;
    });

    const setData1D = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (option) {
            const selectedDataId: DataID = isoDataID.wrap(option.key as number);

            const newConfiguration = produce(configuration, (configuration: D1ViewportConfiguration) => {
                configuration.data[0].id = selectedDataId;
            });

            updateConfiguration(newConfiguration);
        }
    };

    return <div className="section">
        <TextField label="Name" value={viewportName} onChange={(e, v) => setViewportName(v)} />
        <ComboBox
            label="Data to visualize"
            allowFreeform={true}
            autoComplete={'on'}
            options={dataOptions}
            onChange={setData1D}
            defaultSelectedKey={configuration.data.length > 0 ? isoDataID.unwrap(configuration.data[0].id) : null}
        />
    </div>
}
