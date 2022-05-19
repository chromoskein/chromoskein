import { Callout, DefaultButton, TextField, ColorPicker, ComboBox, IComboBoxOption, IComboBox, Label, Slider, IColor, Dropdown, IDropdownOption, Stack, Separator, ChoiceGroup, IChoiceGroupOption, Checkbox, IButtonStyles } from "@fluentui/react";
import { Model, TabNode } from "flexlayout-react";
import React, { Dispatch, FormEvent, MouseEvent, useState } from "react";
import { toNumber } from "lodash";
import './RightPanel.scss';
import { ChromatinRepresentation, SmoothCamera, SmoothCameraConfiguration } from "../../modules/graphics";
import { Text } from '@fluentui/react/lib/Text';

import { ChromatinViewportAggregationFunction, ChromatinViewportColorMappingMode, ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, TooltipNumericAggregation, TooltipTextAggregation, ViewportConfigurationType } from '../../modules/storage/models/viewports';
import { BinPositionsData, DataAction, DataID, DataState, isoDataID } from "../../modules/storage/models/data";
import { SelectionAction, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration, useSelections, useViewportName } from "../hooks";
import { SelectionsPart } from "./SelectionsPart";
import { CutawaysPart } from "./CutawaysPart";
import { vec3 } from "gl-matrix";

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

    const colorMappingModes1D: Array<
        {
            key: ChromatinViewportColorMappingMode,
            id: string,
            text: string
        }

    > = [
            { key: 'none', id: 'none', text: 'None' },
            {
                key: 'centromers',
                id: 'centromers',
                text: 'Proximity from 3D postions'
            },
            {
                key: '1d-numerical',
                id: '1d-numerical',
                text: 'Signals'
            },
            {
                key: 'linear-order',
                id: 'linear-order',
                text: 'Linear order'
            },
            {
                key: '1d-density',
                id: '1d-density',
                text: 'Denisity of annotations'
            },
            {
                key: '3d-density',
                id: '3d-density',
                text: 'Density of bins'
            },
            {
                key: 'sasa',
                id: 'sasa',
                text: 'Solvent Accesibility Surface Area'
            },
        ]
    const data3DOptions = data.data
        .filter(d => d.type == '3d-positions')
        // .filter(d => configuration.data ? !viewportDataIDs.includes(configuration.data.id) : true)
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            } as IComboBoxOption;
        });
    const centromerDataOptions = data.data
        .filter(d => d.type == '3d-positions')
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            } as IComboBoxOption;
        });

    const densityDataOptions = data.data
        .filter(d => d.type == "sparse-1d-data-text" || d.type == "sparse-1d-data-numerical")
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            }
        })

    const numericDataOptions = data.data
        .filter(d => d.type == "sparse-1d-data-numerical")
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            }
        })

    const tooltipDataOptions = data.data
        .filter(d => d.type == "sparse-1d-data-text" || d.type == "sparse-1d-data-numerical")
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            }
        })

    const aggregationFunctionOptions: Array<
        {
            key: ChromatinViewportAggregationFunction,
            id: string,
            text: string
        }> = [
            { key: 'sum', id: 'sum', text: 'Sum' },
            { key: 'mean', id: 'mean', text: 'Mean' },
            { key: 'median', id: 'median', text: 'Median' },
            { key: 'max', id: 'max', text: 'Maximum' },
            { key: 'min', id: 'min', text: 'Minimum' },

        ]

    const tooltipNumericalAggregationFunctionOptions: Array<
        {
            key: TooltipNumericAggregation,
            id: string,
            text: string
        }> = [
            { key: 'mean', id: 'mean', text: 'Mean' },
            { key: 'median', id: 'median', text: 'Median' },
            { key: 'max', id: 'max', text: 'Maximum' },
            { key: 'min', id: 'min', text: 'Minimum' },
            { key: 'none', id: 'none', text: 'None' },
            { key: 'sum', id: 'sum', text: 'Sum' }
        ]

    const tooltipTextAggregationFunctionOptions: Array<
        {
            key: TooltipTextAggregation,
            id: string,
            text: string
        }> = [
            { key: 'none', id: 'none', text: 'None' },
            { key: 'count', id: 'count', text: 'Count' },
        ]


    const [isBackgroundColorCalloutVisible, setIsBackgroundColorCalloutVisible] = useState<boolean>(false);

    const selections = useSelections(0, [configuration, updateConfiguration], props.dataReducer, props.selectionsReducer);

    //#region Viewport Settings
    const setBackgroundColor = (event: React.SyntheticEvent<HTMLElement>, color: IColor): void => {
        if (!configuration) return;

        updateConfiguration({
            ...configuration,
            backgroundColor: color
        })

    };

    const setColorMappingMode = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (!configuration || !option) return;
        updateConfiguration({
            ...configuration,
            colorMappingMode: option.key as ChromatinViewportColorMappingMode,
            mapValues: {
                ...configuration.mapValues,
                id: -1,
            },
        })
    }
    //#endregion

    //#region Data Parts
    // const removeData3D = (index: number) => {
    //     if (!configuration) return;

    //     const newData = [...configuration.data];
    //     newData.splice(index, 1);

    //     updateConfiguration({
    //         ...configuration,
    //         selectedDataIndex: configuration.selectedDataIndex == index ? null : configuration.selectedDataIndex,
    //         data: newData,
    //     });
    // };

    const setData3D = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (!configuration || !option) return;

        const selectedDataId: DataID = isoDataID.wrap(option.key as number);
        const selectedData = data.data.filter(d => d.id == selectedDataId)[0] as BinPositionsData;

        updateConfiguration({
            ...configuration,
            data: {
                ...configuration.data,

                id: selectedDataId,

                representation: ChromatinRepresentation.ContinuousTube,
                radius: 0.0,

                selections: [],
            },
            chromosomes: new Array(selectedData.chromosomes.length).fill(true),
            mapValues: {
                id: -1,
                aggregationFunction: 'mean'
            }
        });
    };

    const setColorMappingData = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (option) {
            const selectedDataId: number = option.key as number;

            updateConfiguration({
                ...configuration,
                mapValues: {
                    ...configuration.mapValues,
                    id: selectedDataId,
                },
            });
        }
    };

    const setAggragationFunction = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (option) {
            updateConfiguration({
                ...configuration,
                mapValues: {
                    ...configuration.mapValues,
                    aggregationFunction: String(option.key) as ChromatinViewportAggregationFunction,
                },
            });
        }
    };

    const setTooltipData = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {

        const selected = option?.selected;
        if (option) {
            updateConfiguration({
                ...configuration,
                tooltip: {
                    ...configuration.tooltip,
                    tooltipDataIDs: selected
                        ? [...configuration.tooltip.tooltipDataIDs, isoDataID.wrap(Number(option!.key))]
                        : configuration.tooltip.tooltipDataIDs.filter(id => id != isoDataID.wrap(Number(option!.key)))
                }
            });
        }
    }

    const setTooltipNumericalAggregationFunction = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (option) {
            updateConfiguration({
                ...configuration,
                tooltip: {
                    ...configuration.tooltip,
                    tooltipNumericAggregation: String(option.key) as TooltipNumericAggregation,
                },
            });
        }
    }


    const setTooltipTextAggregationFunction = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (option) {
            updateConfiguration({
                ...configuration,
                tooltip: {
                    ...configuration.tooltip,
                    tooltipTextAggregation: String(option.key) as TooltipTextAggregation,
                },
            });
        }
    }

    const setRadius = (radius: number) => {
        if (!configuration.data) return;

        updateConfiguration({
            ...configuration,
            data: {
                ...configuration.data,
                radius
            }
        });
    }

    const setExplodedViewScale = (scale: number) => {
        updateConfiguration({
            ...configuration,
            explodedViewScale: scale,
        });
    }
    //#endregion

    const handleChromosomeMouseEvent = (event: MouseEvent<HTMLDivElement>, index: number) => {
        if (event.buttons != 1) {
            return;
        }

        const newChromosomes = [...configuration.chromosomes];
        newChromosomes[index] = !newChromosomes[index];
        updateConfiguration({
            ...configuration,
            chromosomes: newChromosomes
        });
    }

    const handleShowTooltipChange = () => {
        updateConfiguration({
            ...configuration,
            showTooltip: !configuration.showTooltip
        });
    }

    const handleShowDebugViewportChange = () => {
        updateConfiguration({
            ...configuration,
            showDebugViewport: !configuration.showDebugViewport
        });
    }
    const representationDropdownOptions = [
        { key: 1, text: 'Spheres' },
        { key: 2, text: 'Continuous Tube' },
        { key: 3, text: 'Spline' },
    ];

    const representationChanged = (event: FormEvent<HTMLDivElement>, option: IDropdownOption<any> | undefined, index: number | undefined): void => {
        if (!option || typeof option.key != 'number') return;

        updateConfiguration({
            ...configuration,
            representation: option.key - 1,
        });
    };

    if (configuration == null || configuration == undefined || configuration.type != ViewportConfigurationType.Chromatin) {
        return <div></div>;
    }

    const colorPickerButtonStyles: IButtonStyles = {
        root: {
            padding: 0,
            minWidth: 0,
        },
    };

    return <div className="section">
        <Label>Name</Label>
        <Stack horizontal tokens={{ childrenGap: '8px' }}>
            <Stack.Item grow={3}>
                <TextField value={viewportName} onChange={(e, v) => setViewportName(v)} />
            </Stack.Item>
            <Stack.Item>
                <DefaultButton id="backgroundButton" styles={colorPickerButtonStyles}
                    onRenderText={() => <div style={{
                        width: '1.2rem',
                        height: '1.2rem',
                        margin: '0px 4px',
                        backgroundColor: `#${configuration.backgroundColor.hex}`
                    }}
                        key="backgroundButton"
                    ></div>}
                    onClick={() => setIsBackgroundColorCalloutVisible(true)}
                />
                {isBackgroundColorCalloutVisible && (
                    <Callout
                        gapSpace={0}
                        target={'#backgroundButton'}
                        onDismiss={() => setIsBackgroundColorCalloutVisible(false)}
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
            </Stack.Item>

        </Stack>

        {/* List of 3D data */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Text nowrap block variant='large'>3D Data</Text>

        <ComboBox
            label=""
            allowFreeform={false}
            autoComplete={'on'}
            options={data3DOptions}
            onChange={setData3D}
            onItemClick={setData3D}
            selectedKey={configuration.data ? isoDataID.unwrap(configuration.data.id) : null}
            style={{ marginTop: '8px', padding: '4px' }}
            shouldRestoreFocus={false}
        />

        <Dropdown
            label="Representation"
            selectedKey={configuration.representation + 1}
            // eslint-disable-next-line react/jsx-no-bind
            onChange={representationChanged}
            placeholder="Select representation"
            options={representationDropdownOptions}
        />

        {configuration.data != null && configuration.chromosomes.length != 0 && (
            <Stack styles={{ root: { padding: 4 } }}>
                {configuration.chromosomes.map((v, i) => {
                    return <div
                        style={{ width: "max-content" }}
                        draggable={false}
                        key={i}
                        onMouseDown={(e) => handleChromosomeMouseEvent(e, i)}
                        onMouseEnter={(e) => handleChromosomeMouseEvent(e, i)}>
                        <Checkbox
                            label={(data.data.filter(d => d.id == configuration.data?.id)[0] as BinPositionsData).chromosomes[i].name}
                            checked={v}
                        />
                    </div>

                })}
            </Stack>
        )
        }

        <Slider
            label="Exploded view scale"
            min={0.0}
            max={2.0}
            step={0.01}
            value={configuration.explodedViewScale}
            showValue={false}
            onChange={(value) => setExplodedViewScale(value)}
        />

        {/* 3D DATA REPRESENTATION */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Text nowrap block variant='large' style={{ marginBottom: '5px' }}>3D Data Visualization</Text>
        <Stack tokens={{ childrenGap: '8px' }}>
            {configuration.data && (<Slider
                label="Radius"
                min={configuration.radiusRange.min}
                max={configuration.radiusRange.max}
                step={(configuration.radiusRange.max - configuration.radiusRange.min) / 100.0}
                value={toNumber(configuration.data.radius)}
                showValue={false}
                onChange={(value) => setRadius(value)}
            />
            )}
            <CutawaysPart configurationReducer={configurationReducer}></CutawaysPart>
        </Stack>

        {/*  */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Text nowrap block variant='large'>Color by</Text>

        <ComboBox
            style={{ marginTop: '8px', padding: '4px' }}
            options={colorMappingModes1D}
            onChange={setColorMappingMode}
            selectedKey={configuration.colorMappingMode}
        />


        {configuration.colorMappingMode == 'centromers' && <>
            {centromerDataOptions.length <= 0 && ("No more data available.")}
            {
                centromerDataOptions.length > 0 && (<ComboBox
                    label="Data"
                    allowFreeform={false}
                    autoComplete={'on'}
                    options={centromerDataOptions}
                    onChange={setColorMappingData}
                    style={{ marginTop: '8px', padding: '4px' }}
                    shouldRestoreFocus={false}
                    selectedKey={
                        (configuration.mapValues.id >= 0) ? configuration.mapValues.id : null
                    }
                />)
            }</>
        }

        {configuration.colorMappingMode == 'sasa' && <>
            <ComboBox
                label="Method"
                allowFreeform={false}
                autoComplete={'on'}
                options={[{
                    key: 'generated',
                    id: 'generated',
                    text: 'Generated radii'
                },
                {
                    key: 'constant',
                    id: 'constant',
                    text: 'Constant radii',
                }
                ]}
                // onChange={setColorMappingData}
                style={{ marginTop: '8px', padding: '4px' }}
                shouldRestoreFocus={false}
            />
        </>
        }

        {configuration.colorMappingMode == '3d-density' && configuration.data &&
            <Slider
                label="Probe size"
                min={0} //minimum distance between any two bins (all will be white but two)
                max={10} //maximum distance between any two bins (all will be red)
                step={0.1}
            // value={toNumber(configuration.data.threed_density_radius)}
            // showValue={false}
            // onChange={(value) => setRadius(value)}
            />
        }

        {configuration.colorMappingMode == '1d-density' && <>
            {densityDataOptions.length <= 0 && ("No more data available.")}
            {
                densityDataOptions.length > 0 && (<ComboBox
                    label="Data"
                    allowFreeform={false}
                    autoComplete={'on'}
                    options={densityDataOptions}
                    onChange={setColorMappingData}
                    style={{ marginTop: '8px', padding: '4px' }}
                    shouldRestoreFocus={false}
                    selectedKey={
                        (configuration.mapValues.id >= 0) ? configuration.mapValues.id : null
                    }
                />)
            }</>
        }

        {configuration.colorMappingMode == '1d-numerical' && <>
            {numericDataOptions.length <= 0 && ("No more data available.")}
            {
                numericDataOptions.length > 0 && (<><ComboBox
                    label="Data"
                    allowFreeform={false}
                    autoComplete={'on'}
                    options={numericDataOptions}
                    onChange={setColorMappingData}
                    style={{ marginTop: '8px', padding: '4px' }}
                    shouldRestoreFocus={false}
                    selectedKey={
                        (configuration.mapValues.id >= 0) ? configuration.mapValues.id : null
                    }
                />
                    <ComboBox
                        label="Aggregation function"
                        allowFreeform={false}
                        autoComplete={'on'}
                        options={aggregationFunctionOptions}
                        onChange={setAggragationFunction}
                        style={{ marginTop: '8px', padding: '4px' }}
                        shouldRestoreFocus={false}
                        selectedKey={configuration.mapValues.aggregationFunction}
                    />
                </>)
            }</>

        }
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>

        <Text nowrap block variant='large'>Tooltip</Text>
        <Checkbox label="Show tooltip" checked={configuration.showTooltip} onChange={handleShowTooltipChange} />
        {configuration.showTooltip && <>
            {tooltipDataOptions.length <= 0 && ("No more data available.")}
            {
                tooltipDataOptions.length > 0 && (<ComboBox
                    label="Data"
                    allowFreeform={false}
                    autoComplete={'on'}
                    multiSelect
                    options={tooltipDataOptions}
                    onChange={setTooltipData}
                    style={{ marginTop: '8px', padding: '4px' }}
                    shouldRestoreFocus={false}
                    selectedKey={
                        configuration.tooltip.tooltipDataIDs.map(k => isoDataID.unwrap(k))
                    }
                />)
            }
            {
                <ComboBox
                    label="Aggregate numerical data by"
                    allowFreeform={false}
                    autoComplete={'on'}
                    options={tooltipNumericalAggregationFunctionOptions}
                    onChange={setTooltipNumericalAggregationFunction}
                    style={{ marginTop: '8px', padding: '4px' }}
                    shouldRestoreFocus={false}
                    selectedKey={configuration.tooltip.tooltipNumericAggregation}
                />
            }
            {
                <ComboBox
                    label="Aggregate text data by"
                    allowFreeform={false}
                    autoComplete={'on'}
                    options={tooltipTextAggregationFunctionOptions}
                    onChange={setTooltipTextAggregationFunction}
                    style={{ marginTop: '8px', padding: '4px' }}
                    shouldRestoreFocus={false}
                    selectedKey={configuration.tooltip.tooltipTextAggregation}
                />
            }
        </>}

        {/* SELECTIONS */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <SelectionsPart
            selections={selections}
            configurationReducer={configurationReducer}
            dataReducer={props.dataReducer}
            selectionsReducer={props.selectionsReducer}
        ></SelectionsPart>

        <Separator></Separator>
        <Text nowrap block variant='large'>Debug Viewport</Text>
        <Checkbox label="Show" checked={configuration.showDebugViewport} onChange={handleShowDebugViewportChange} />
    </div>
}
