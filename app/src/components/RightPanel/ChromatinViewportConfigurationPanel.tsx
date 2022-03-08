import { Callout, DefaultButton, TextField, ColorPicker, ComboBox, IComboBoxOption, IComboBox, Label, Slider, IColor, Dropdown, IDropdownOption, Stack, Separator, ChoiceGroup, IChoiceGroupOption } from "@fluentui/react";
import { Model, TabNode } from "flexlayout-react";
import React, { Dispatch, FormEvent, useEffect, useState } from "react";
import { toNumber } from "lodash";
import './RightPanel.scss';
import { Delete16Regular } from '@fluentui/react-icons';
import { ChromatinRepresentation } from "../../modules/graphics";
import { Text } from '@fluentui/react/lib/Text';

import { ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, ViewportConfigurationType } from '../../modules/storage/models/viewports';
import { DataAction, DataID, DataState, isoDataID } from "../../modules/storage/models/data";
import { SelectionAction, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration, useSelections, useViewportName } from "../hooks";
import { SelectionsPart } from "./SelectionsPart";

export function ChromatinViewportConfigurationPanel(props: {
    model: Model,
    node: TabNode,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}): JSX.Element {
    const configurationReducer = useConfiguration<ChromatinViewportConfiguration>(props.node.getConfig(), props.configurationsReducer);

    const [data, dataDispatch] = props.dataReducer;
    const [configuration, updateConfiguration] = configurationReducer;

    const [viewportName, setViewportName] = useViewportName(props.node, props.configurationsReducer);

    const viewportDataIDs: Array<DataID> = configuration.data.map(d => d.id);
    const data3DOptions = data.data
        .filter(d => d.type == '3d-positions')
        .filter(d => !viewportDataIDs.includes(d.id))
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            } as IComboBoxOption;
        });
    const data1DOptions = data.data
        .filter(d => d.type == '3d-positions')
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            } as IComboBoxOption;
        });

    const [isCalloutVisible, setIsCalloutVisible] = useState<boolean>(false);

    const selectedDataPartIndex: number | null = configuration.selectedDataIndex;
    const selections = useSelections(selectedDataPartIndex, [configuration, updateConfiguration], props.dataReducer, props.selectionsReducer);

    //#region Viewport Settings
    const setBackgroundColor = (event: React.SyntheticEvent<HTMLElement>, color: IColor): void => {
        if (!configuration) return;

        updateConfiguration({
            ...configuration,
            backgroundColor: color
        })

    };

    const setSSAORadius = (radius: number) => {
        if (!configuration) return;

        updateConfiguration({
            ...configuration,
            ssao: {
                ...configuration.ssao,
                radius: toNumber(radius)
            }
        });
    }

    const setSSAOBlurSize = (size: number) => {
        if (!configuration) return;

        updateConfiguration({
            ...configuration,
            ssao: {
                ...configuration.ssao,
                blurSize: toNumber(size)
            }

        });
    }
    //#endregion

    //#region Data Parts
    const addData3D = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (!configuration || !option) return;

        const selectedDataId: DataID = isoDataID.wrap(option.key as number);
        const updateSelectedDataPartIndex = configuration.data.length == 0 ? 0 : configuration.selectedDataIndex;

        updateConfiguration({
            ...configuration,
            data: [...configuration.data, {
                id: selectedDataId,
                representation: ChromatinRepresentation.ContinuousTube,
                normalizeToCenter: false,
                radius: 0.01,

                selections: [],

                mapValues: {
                    id: -1,
                }
            }],
            selectedDataIndex: updateSelectedDataPartIndex,
        });
    };

    const removeData3D = (index: number) => {
        if (!configuration) return;

        const newData = [...configuration.data];
        newData.splice(index, 1);

        updateConfiguration({
            ...configuration,
            selectedDataIndex: configuration.selectedDataIndex == index ? null : configuration.selectedDataIndex,
            data: newData,
        });
    };

    const setData1D = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (option) {
            const selectedDataId: number = option.key as number;

            // const data = [...configuration.data];
            // data[selectedDataPartIndex] = {
            //     ...data[selectedDataPartIndex],
            //     mapValues: {
            //         ...data[selectedDataPartIndex].mapValues,
            //         id: selectedDataId,
            //     },
            // };

            updateConfiguration({
                ...configuration,
                mapValues: {
                    ...configuration.mapValues,
                    id: selectedDataId,
                },
            });
        }
    };

    const setRepresentationAll = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
        if (configuration == null || option == undefined || typeof option.key == 'string') return;

        const newData = configuration.data;
        for (let i = 0; i < newData.length; i++) {
            newData[i].representation = option.key;
        }

        updateConfiguration({
            ...configuration,
            data: newData
        });
    }

    const setRadius = (radius: number, index: number) => {
        if (!configuration) return;

        const newData = [...configuration.data];
        newData[index].radius = radius;

        updateConfiguration({
            ...configuration,
            data: newData
        });
    }

    const setRadiusAll = (radius: number) => {
        if (!configuration) return;

        const newData = [...configuration.data];
        for (let i = 0; i < newData.length; i++) {
            newData[i] = {
                ...newData[i],
                radius: radius
            };
        }

        updateConfiguration({
            ...configuration,
            data: newData
        });
    }
    //#endregion

    const setCutawayAxis = (ev?: FormEvent<HTMLElement | HTMLInputElement> | undefined, option?: IChoiceGroupOption | undefined) => {
        if (!option) return;

        const key = option.key;

        if (key != 'X' && key != 'Y' && key != 'Z') return;

        updateConfiguration({
            ...configuration,
            cutaway: {
                ...configuration.cutaway,
                axis: key
            }
        });
    }

    const setCutawayLength = (length: number) => {
        updateConfiguration({
            ...configuration,
            cutaway: {
                ...configuration.cutaway,
                length: length
            }
        });
    }

    if (configuration == null || configuration == undefined || configuration.type != ViewportConfigurationType.Chromatin) {
        return <div></div>;
    }

    return <div className="section">
        <TextField label="Name" value={viewportName} onChange={(e, v) => setViewportName(v)} />


        <Text nowrap block variant='large' style={{ marginTop: '16px', }}>Visual Options</Text>
        <Stack tokens={{ childrenGap: '8px' }}>
            <Label>Background: </Label>
            <DefaultButton id="backgroundButton"
                text={String('#' + configuration.backgroundColor.hex)}
                onClick={() => setIsCalloutVisible(true)}
            />
            {isCalloutVisible && (
                <Callout
                    gapSpace={0}
                    target={'#backgroundButton'}
                    onDismiss={() => setIsCalloutVisible(false)}
                    setInitialFocus
                >
                    <ColorPicker
                        color={configuration.backgroundColor}
                        onChange={setBackgroundColor}
                        alphaType={'none'}
                        showPreview={true}
                        strings={{
                            hueAriaLabel: 'Hue',
                        }}
                    />
                </Callout>
            )}
            <Slider label="SSAO Radius" min={0.0} max={1.0} step={0.01} value={configuration.ssao.radius} showValue onChange={setSSAORadius} />
            <Slider label="SSAO Blur Size" min={2} max={32} step={1} value={configuration.ssao.blurSize} showValue onChange={setSSAOBlurSize} />
        </Stack>

        {/* List of 3D data */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Text nowrap block variant='large'>3D Data</Text>
        {configuration && configuration.data.map((part, index: number) =>
            <div style={{ paddingLeft: 8 }}
                className={index == selectedDataPartIndex ? "treeViewListItem selected" : "treeViewListItem"}
                key={index}
                onClick={() => {
                    if (!configuration) return;

                    updateConfiguration({
                        ...configuration,
                        selectedDataIndex: configuration.selectedDataIndex == index ? null : index,
                    });
                }}
            >
                <span style={{ display: 'block', width: '20px' }}></span>
                <span className='text'>{data.data.find(e => e.id == part.id)?.name}</span>
                <Delete16Regular primaryFill={'white'} className='icon iconHoverRed' onClick={(e) => { e.stopPropagation(); removeData3D(index); }}></Delete16Regular>
            </div>
        )}

        {data3DOptions.length <= 0 && ("No more data available.")}
        {data3DOptions.length > 0 && (<ComboBox
            label=""
            allowFreeform={false}
            autoComplete={'on'}
            options={data3DOptions}
            text="Type name of data item to add"
            onChange={addData3D}
            onItemClick={addData3D}
            style={{ marginTop: '8px', padding: '4px' }}
            shouldRestoreFocus={false}
        />)}

        {/* 3D DATA REPRESENTATION */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Text nowrap block variant='large' style={{ marginBottom: '5px' }}>3D Data Visualization</Text>
        <Stack tokens={{ childrenGap: '8px' }}>
            {configuration.data.length <= 0 && ("No data to configure")}

            {configuration.data.length > 0 && configuration.radiusRange && (
                <Slider
                    label="Radius"
                    min={(configuration.radiusRange.min / 2.0) / 100.0}
                    max={(configuration.radiusRange.min / 2.0)}
                    step={(configuration.radiusRange.min / 2.0) / 100.0}
                    value={toNumber(configuration.data[0].radius)}
                    showValue={false}
                    onChange={(value) => setRadiusAll(value)}
                />
            )}
            {configuration && configuration.data.length > 0 && (
                <Dropdown
                    placeholder=""
                    label="Representation"
                    options={[
                        { key: 0, text: 'Continuous Tube' },
                        { key: 1, text: 'Spheres' },
                    ]}
                    selectedKey={
                        configuration.data[0].representation
                    }
                    onChange={setRepresentationAll}
                />
            )}
            <ChoiceGroup
                defaultSelectedKey="X"
                styles={{ flexContainer: { display: "flex", gap: "16px" } }}
                options={[
                    { key: 'X', text: 'X' },
                    { key: 'Y', text: 'Y' },
                    { key: 'Z', text: 'Z' }]}
                label="Cutaway axis"
                onChange={setCutawayAxis}
                required={true} />
            <Slider
                label="Cutaway"
                min={-1.0}
                max={1.0}
                step={0.01}
                value={configuration.cutaway.length}
                onChange={value => setCutawayLength(value)}
            ></Slider>
        </Stack>

        {/*  */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Text nowrap block variant='large'>Map 1D data</Text>
        {data1DOptions.length <= 0 && ("No more data available.")}
        {data1DOptions.length > 0 && (<ComboBox
            label=""
            allowFreeform={false}
            autoComplete={'on'}
            options={data1DOptions}
            onChange={setData1D}
            onItemClick={setData1D}
            style={{ marginTop: '8px', padding: '4px' }}
            shouldRestoreFocus={false}
            selectedKey={
                (configuration.mapValues.id >= 0) ? configuration.mapValues.id : null
            }
        />)}

        {/* SELECTIONS */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <SelectionsPart
            selections={selections}
            configurationReducer={configurationReducer}
            dataReducer={props.dataReducer}
            selectionsReducer={props.selectionsReducer}
        ></SelectionsPart>
    </div >
}
