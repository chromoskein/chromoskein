import './RightPanel.scss';

import { TextField, ComboBox, IComboBoxOption, IComboBox, Separator } from "@fluentui/react";
import FlexLayout, { Model, TabNode } from "flexlayout-react";
import React, { Dispatch } from "react";

import { ConfigurationAction, ConfigurationActionKind, ConfigurationState, ForceGraphViewportConfiguration, DistanceViewportConfiguration, ViewportConfigurationType, getDefaultViewportSelectionOptions, ViewportSelectionOptions } from '../../modules/storage/models/viewports';
import { DataAction, DataID, DataState, isoDataID } from "../../modules/storage/models/data";
import { SelectionAction, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration, useSelections, useViewportName } from '../hooks';
import { SelectionsPart } from './SelectionsPart';



export function ForceGraphViewportConfigurationPanel(props: {
    model: Model,
    node: TabNode,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}): JSX.Element {


    // const [configurations, configurationsDispatch] = props.configurationsReducer;
    // const [data, dataDispatch] = props.dataReducer;
    // const [viewportName, setViewportName] = useViewportName(props.node, props.configurationsReducer)
    // const [configuration, setConfiguration] = useConfiguration<ForceGraphViewportConfiguration>(props.node.getConfig(), props.configurationsReducer)
    // const [globalSelections, globalSelectionsDispatch] = props.selectionsReducer;

    // const selections = useSelections(0, [configuration, setConfiguration], props.dataReducer, props.selectionsReducer);


    // const dataOptions = data.data.filter(d => d.type == 'sparse-distance-matrix' || d.type == '3d-positions').map(d => {
    //     return {
    //         key: isoDataID.unwrap(d.id),
    //         text: d.name,
    //     } as IComboBoxOption;
    // });


    // const setData = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
    //     if (!configuration) return;

    //     // if (option) {
    //     //     const selectedDataId: DataID = isoDataID.wrap(option.key as number);

    //     //     const selectedData = data.data.filter(d => d.id == selectedDataId);
    //     //     const selectedDataSelections = globalSelections.selections.filter(s => s.dataId == selectedDataId);

    //     //     const newSelectionsAssociatedData: Array<ViewportSelectionOptions> = [];
    //     //     for (let i = 0; i < selectedDataSelections.length; i++) {
    //     //         newSelectionsAssociatedData.push(getDefaultViewportSelectionOptions(selectedDataSelections[i].id));
    //     //     }

    //     //     if (selectedData && selectedDataSelections) {
    //     //         setConfiguration({
    //     //             ...configuration,
    //     //             selectedDataIndex: 0,
    //     //             data: [configuration.data.length == 0 ? {
    //     //                 id: selectedDataId,
    //     //                 selections: newSelectionsAssociatedData
    //     //             } : {
    //     //                 ...configuration.data[0],
    //     //                 id: selectedDataId
    //     //             }]
    //     //         });
    //     //     }
    //     // }
    // };



    // // const setData = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
    // //     if (!configuration) return;

    // //     if (option) {
    // //         const selectedDataId: number = option.key as number;

    // //         setConfiguration(
    // //             { ...configuration, : selectedDataId }
    // //         );
    // //     }
    // // };



    return <div className="section">
        {/* <TextField label="Name" value={viewportName} onChange={(e, v) => setViewportName(v)} />
        <ComboBox
            label="Data to visualize"
            allowFreeform={true}
            autoComplete={'on'}
            options={dataOptions}
            onChange={setData}
            defaultSelectedKey={configuration.data.length > 0 ? isoDataID.unwrap(configuration.data[0].id) : null}
        />
        <Separator></Separator>
        <SelectionsPart
            selections={selections}
            configurationReducer={[configuration, setConfiguration]}
            dataReducer={props.dataReducer}
            selectionsReducer={props.selectionsReducer}
        ></SelectionsPart> */}
    </div>
}