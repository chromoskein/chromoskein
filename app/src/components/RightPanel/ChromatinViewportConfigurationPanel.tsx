import { Callout, DefaultButton, TextField, ColorPicker, ComboBox, IComboBoxOption, IComboBox, Label, Slider, IColor, Dropdown, IDropdownOption, Stack, Separator, ChoiceGroup, IChoiceGroupOption, Checkbox, IButtonStyles, PrimaryButton, getColorFromRGBA } from "@fluentui/react";
import { Model, TabNode } from "flexlayout-react";
import React, { Dispatch, FormEvent, MouseEvent, useState } from "react";
import { toNumber } from "lodash";
import './RightPanel.scss';
import { ChromatinRepresentation, SmoothCamera, SmoothCameraConfiguration } from "../../modules/graphics";
import { Text } from '@fluentui/react/lib/Text';

import { ChromatinViewportAggregationFunction, ChromatinViewportColorMappingMode, ChromatinViewportConfiguration, ConfigurationAction, ConfigurationState, IChromatinDataConfiguration, LabelingDebugTexture, TooltipNumericAggregation, TooltipTextAggregation, ViewportConfigurationType } from '../../modules/storage/models/viewports';
import { BinPositionsData, DataAction, DataID, DataState, isoDataID } from "../../modules/storage/models/data";
import { SelectionAction, SelectionState } from "../../modules/storage/models/selections";
import { useConfiguration, useSelections, useViewportName } from "../hooks";
import { SelectionsPart } from "./SelectionsPart";
import { CutawaysPart } from "./CutawaysPart";
import { vec3 } from "gl-matrix";
import { Delete16Regular } from "@fluentui/react-icons";
import { quantile } from "simple-statistics";

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
            { key: 'single-color', id: 'none', text: 'Single color' },
            { key: 'selections', id: 'none', text: 'Selections' },
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

    const [selectedPrimaryDataID, setSelectedPimaryDataID] = useState<DataID | null>(null);
    const [selectedSecondaryDataID, setSelectedSecondaryDataID] = useState<DataID | null>(null);

    const selectedPrimaryData = selectedPrimaryDataID ? data.data.find(d => d.id == selectedPrimaryDataID) || null : null;
    const selectedSecondaryData = selectedSecondaryDataID ? data.data.find(d => d.id == selectedSecondaryDataID) || null : null;

    const showSecondaryData = selectedPrimaryDataID && selectedPrimaryData && selectedPrimaryData.type == 'bed-annotation';
    const enableAddDataButton = (selectedPrimaryData && selectedPrimaryData.type == '3d-positions') || (selectedSecondaryDataID != null);

    const onChangePrimaryData = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption<number> | undefined): void => {
        if (!option || !option.key || typeof option.key != "number") return;

        const id = option.key;
        if (typeof id === 'number') {
            setSelectedPimaryDataID(() => isoDataID.wrap(id));
        }
    };

    const onChangeSecondaryData = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption<number> | undefined): void => {
        if (!option || !option.key || typeof option.key != "number") return;

        const id = option.key;
        if (typeof id === 'number') {
            setSelectedSecondaryDataID(() => isoDataID.wrap(id));
        }
    };

    const dataOptions = data.data
        .filter(d => d.type == '3d-positions' || d.type == 'bed-annotation')
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            } as IDropdownOption;
        });

    const data3DOptions = data.data
        .filter(d => d.type == '3d-positions')
        .map(d => {
            return {
                key: isoDataID.unwrap(d.id),
                id: isoDataID.unwrap(d.id).toString(),
                text: d.name,
            } as IDropdownOption;
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

    const labelingDebugTextureOptions: Array<
        {
            key: LabelingDebugTexture,
            id: string,
            text: string
        }> = [
            { key: 'id', id: 'id', text: 'ID Buffer' },
            { key: 'contours', id: 'contours', text: 'Contours' },
            { key: 'dt', id: 'dt', text: 'Distance Transform' },
        ]


    const [isBackgroundColorCalloutVisible, setIsBackgroundColorCalloutVisible] = useState<boolean>(false);

    const selections = useSelections([configuration, updateConfiguration], props.dataReducer, props.selectionsReducer, configuration.selectedDatum);

    //#region Viewport Settings
    const setBackgroundColor = (event: React.SyntheticEvent<HTMLElement>, color: IColor): void => {
        if (!configuration) return;

        updateConfiguration({
            ...configuration,
            backgroundColor: color
        })

    };

    const setColorMappingMode = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (configuration.selectedDatum == null || !option) return;

        const data = [...configuration.data];
        data[configuration.selectedDatum] = {
            ...data[configuration.selectedDatum],
            colorMappingMode: option.key as ChromatinViewportColorMappingMode,
            mapValues: { ...data[configuration.selectedDatum].mapValues, id: -1 }
        };

        updateConfiguration({
            ...configuration,
            data
        })
    }
    // #endregion

    //#region Data Parts
    const removeData3D = (index: number) => {
        if (!configuration) return;

        const newData: IChromatinDataConfiguration[] = [...configuration.data];
        newData.splice(index, 1);

        updateConfiguration({
            ...configuration,
            selectedSelectionID: null,
            data: newData,
        });
    };

    const addData = () => {
        if (!configuration || !selectedPrimaryData) return;

        const newData = [...configuration.data];

        //#region Calculate radius range
        const positions = (selectedPrimaryData.type == '3d-positions' ? selectedPrimaryData as BinPositionsData : selectedSecondaryData as BinPositionsData).values.positions;
        const distances = [];
        for (let i = 0; i < positions.length - 1; i++) {
            distances.push(
                vec3.distance(vec3.fromValues(positions[i].x, positions[i].y, positions[i].z), vec3.fromValues(positions[i + 1].x, positions[i + 1].y, positions[i + 1].z))
            );
        }

        const quantiles = quantile(distances, [0.05, 0.95]);

        const radius = quantiles[0] / 4.0;
        const radiusRange = { min: 0.0, max: quantiles[0] / 2.0 };
        //#region Calculate radius range

        newData.push({
            id: selectedPrimaryData.id,
            secondaryID: selectedSecondaryDataID,

            chromosomes: [],

            representation: ChromatinRepresentation.Spheres,

            color: getColorFromRGBA({ r: 255, g: 255, b: 255, a: 100 }),

            radius,
            radiusRange,

            selectedSelectionID: null,
            selections: [],

            mapValues: {
                id: -1,
                aggregationFunction: 'mean'
            },
            tooltip: {
                tooltipDataIDs: [],
                tooltipTextAggregation: 'none',
                tooltipNumericAggregation: 'none',
            },
            showTooltip: true,

            colorMappingMode: 'single-color',

            labeling: {
                showDebugViewport: false,
                showLabelingOverlay: false,
                showLabelAnchors: false,
                useMaxDistCPU: false,
                shownDebugTexture: 'id',
            },

            sasa: {
                method: 'constant',
                probeSize: 0,
                accuracy: 100,
                individual: false
            },

            density: {
                probeSize: 0.1,
                individual: false
            }
        });

        updateConfiguration({
            ...configuration,
            data: newData,
        });
    };

    const setDataColor = (ev: React.SyntheticEvent<HTMLElement, Event>, color: IColor): void => {
        if (configuration.selectedDatum == null) return;

        const newData = [...configuration.data];
        newData[configuration.selectedDatum] = { ...newData[configuration.selectedDatum], color };

        updateConfiguration({
            ...configuration,
            data: newData
        });
    };

    const setSelectedDatum = (index: number) => {
        updateConfiguration({
            ...configuration,
            selectedDatum: index,
        });
    };

    const [isSingleColorCalloutVisible, setIsSingleColorCalloutVisible] = useState<boolean>(false);

    const setColorMappingData = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        // if (option) {
        //     const selectedDataId: number = option.key as number;

        //     updateConfiguration({
        //         ...configuration,
        //         mapValues: {
        //             ...configuration.mapValues,
        //             id: selectedDataId,
        //         },
        //     });
        // }
    };

    const setSasaConfiguration = (sasaConfiguration: { method: "constant" | "generated", probeSize: number, accuracy: number, individual: boolean }) => {
        updateConfiguration({
            ...configuration,
            sasa: sasaConfiguration
        })
    }

    const setDensityConfiguration = (densityConfiguration: { probeSize: number, individual: boolean }) => {
        updateConfiguration({
            ...configuration,
            density: densityConfiguration
        })
    }

    const setAggragationFunction = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        // if (option) {
        //     updateConfiguration({
        //         ...configuration,
        //         mapValues: {
        //             ...configuration.mapValues,
        //             aggregationFunction: String(option.key) as ChromatinViewportAggregationFunction,
        //         },
        //     });
        // }
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

    const setShownDebugTexture = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (option) {
            updateConfiguration({
                ...configuration,
                labeling: {
                    ...configuration.labeling,
                    shownDebugTexture: String(option.key) as LabelingDebugTexture,
                }
                // tooltip: {
                //     ...configuration.tooltip,
                //     tooltipTextAggregation: String(option.key) as TooltipTextAggregation,
                // },
            });
        }
    }

    const setRadius = (radius: number) => {
        if (configuration.selectedDatum == null) return;

        const data = [...configuration.data];
        data[configuration.selectedDatum] = { ...data[configuration.selectedDatum], radius };
        updateConfiguration({
            ...configuration,
            data
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
            labeling: {
                ...configuration.labeling,
                showDebugViewport: !configuration.labeling.showDebugViewport,
            }
        });
    }
    const handleShowLabelingOverlayChange = () => {
        updateConfiguration({
            ...configuration,
            labeling: {
                ...configuration.labeling,
                showLabelingOverlay: !configuration.labeling.showLabelingOverlay,
            }
        });
    }
    const handleUseMaxDistCPUChange = () => {
        updateConfiguration({
            ...configuration,
            labeling: {
                ...configuration.labeling,
                useMaxDistCPU: !configuration.labeling.useMaxDistCPU,
            }
        });
    }
    const handleShowLabelAnchorsChange = () => {
        updateConfiguration({
            ...configuration,
            labeling: {
                ...configuration.labeling,
                showLabelAnchors: !configuration.labeling.showLabelAnchors,
            }
        });
    }
    const representationDropdownOptions = [
        { key: 1, text: 'Spheres' },
        { key: 2, text: 'Continuous Tube' },
        { key: 3, text: 'Spline' },
    ];

    const representationChanged = (event: FormEvent<HTMLDivElement>, option: IDropdownOption<any> | undefined): void => {
        if (configuration.selectedDatum == null || !option || typeof option.key != 'number') return;

        const data = [...configuration.data];
        data[configuration.selectedDatum] = { ...data[configuration.selectedDatum], representation: option.key - 1 };

        updateConfiguration({
            ...configuration,
            data
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
        <Separator></Separator>
        <Text nowrap block variant='large'>3D Data</Text>
        <Dropdown
            label="Data"
            // eslint-disable-next-line react/jsx-no-bind
            placeholder="Select 3D data or bin positions"
            options={dataOptions}
            onChange={onChangePrimaryData}
        />
        {showSecondaryData && (<Dropdown
            label="Map bins on positions of"
            // eslint-disable-next-line react/jsx-no-bind
            placeholder="Select 3D data"
            options={data3DOptions}
            onChange={onChangeSecondaryData}
        />)}
        <DefaultButton text='Add Data' style={{ marginTop: '8px' }} disabled={!enableAddDataButton} onClick={addData} />

        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        {configuration.data.map((datum, index) =>
        (<div className={"treeViewListItem " + (configuration.selectedDatum == index ? 'selected' : '')} key={index} onClick={() => setSelectedDatum(index)}>
            <span style={{ display: 'block', width: '4px' }}></span>
            <Text className="text" nowrap>{data.data.find(d => d.id == datum.id)?.name || 'No Name (BUG)'}</Text>
            <Delete16Regular primaryFill={'white'} className='icon iconHoverRed' onClick={(e) => { e.stopPropagation(); removeData3D(index); }}></Delete16Regular>
        </div>)
        )}

        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Text nowrap block variant='large' style={{ marginBottom: '5px' }}>Data Visualization</Text>

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && (<Dropdown
            label="Representation"
            selectedKey={configuration.data[configuration.selectedDatum].representation + 1}
            // eslint-disable-next-line react/jsx-no-bind            
            placeholder="Select representation"
            options={representationDropdownOptions}
            onChange={representationChanged}
        />)}

        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && (<Slider
            label="Radius"
            min={configuration.data[configuration.selectedDatum].radiusRange.min}
            max={configuration.data[configuration.selectedDatum].radiusRange.max}
            step={(configuration.data[configuration.selectedDatum].radiusRange.max - configuration.data[configuration.selectedDatum].radiusRange.min) / 100.0}
            value={toNumber(configuration.data[configuration.selectedDatum].radius)}
            showValue={false}
            onChange={(value) => setRadius(value)}
        />
        )}

        {/* 3D DATA REPRESENTATION */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Stack tokens={{ childrenGap: '8px' }}>
            <CutawaysPart configurationReducer={configurationReducer}></CutawaysPart>
        </Stack>

        {/*  */}
        <div style={{ display: 'block', width: '100%', marginTop: '16px' }}></div>
        <Separator></Separator>
        <Text nowrap block variant='large'>Color by</Text>

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && <ComboBox
            style={{ marginTop: '8px', padding: '4px' }}
            options={colorMappingModes1D}
            onChange={setColorMappingMode}
            selectedKey={configuration.data[configuration.selectedDatum].colorMappingMode}
        />}

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && configuration.data[configuration.selectedDatum].colorMappingMode == 'single-color' && <>
            <div style={{ display: 'block', width: '100%', marginTop: '8px' }}></div>
            <DefaultButton id="singleColorButton" styles={{
                root: { width: 'calc(100% - 8px)', margin: '0px 4px 0px 4px' }
            }} key="singleColorButton" onClick={() => setIsSingleColorCalloutVisible(true)}>
                <span style={{ color: '#' + configuration.data[configuration.selectedDatum].color.hex }}>{configuration.data[configuration.selectedDatum].color.hex}</span>
            </DefaultButton>
            {isSingleColorCalloutVisible && (
                <Callout
                    gapSpace={0}
                    target={'#singleColorButton'}
                    onDismiss={() => setIsSingleColorCalloutVisible(false)}
                    setInitialFocus
                >
                    <ColorPicker
                        color={configuration.data[configuration.selectedDatum].color}
                        onChange={setDataColor}
                        alphaType={'none'}
                        showPreview={true}
                        strings={{
                            hueAriaLabel: 'Hue',
                        }}
                    />
                </Callout>
            )}
        </>}

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && configuration.data[configuration.selectedDatum].colorMappingMode == 'selections' && <>
            <div style={{ display: 'block', width: '100%', marginTop: '8px' }}></div>

            {configuration.selectedDatum != null && (
                <SelectionsPart
                    selections={selections}
                    configurationReducer={configurationReducer}
                    dataReducer={props.dataReducer}
                    selectionsReducer={props.selectionsReducer}
                    selectedDataIndex={configuration.selectedDatum}
                ></SelectionsPart>
            )}
        </>}

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && configuration.data[configuration.selectedDatum].colorMappingMode == 'centromers' && <>
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
                        (configuration.data[configuration.selectedDatum].mapValues.id >= 0) ? configuration.data[configuration.selectedDatum].mapValues.id : null
                    }
                />)
            }</>
        }

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && configuration.data[configuration.selectedDatum].colorMappingMode == 'sasa' && <>
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
                onChange={(e, o) => o && setSasaConfiguration({ ...configuration.sasa, method: o.id as 'generated' | 'constant' })}
                style={{ marginTop: '8px', padding: '4px' }}
                shouldRestoreFocus={false}
            />
            <Slider
                label="Probe Size"
                min={0}
                max={1}
                step={0.01}
                value={configuration.sasa.probeSize}
                showValue={true}
                onChange={(probeSize) => setSasaConfiguration({ ...configuration.sasa, probeSize })}
            />
            <Slider
                label="Accuracy"
                min={0}
                max={1000}
                step={1}
                value={configuration.sasa.accuracy}
                showValue={true}
                onChange={(accuracy) => setSasaConfiguration({ ...configuration.sasa, accuracy })}
            />
            <Checkbox
                label="Compute for each chromosome individually"
                checked={configuration.sasa.individual}
                onChange={(e, individual) => setSasaConfiguration({ ...configuration.sasa, individual: individual ?? false })} />

        </>
        }

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && configuration.data[configuration.selectedDatum].colorMappingMode == '3d-density' && configuration.data && <>
            <Slider
                label="Probe size"
                min={0} //minimum distance between any two bins (all will be white but two)
                max={1} //maximum distance between any two bins (all will be red)
                step={0.01}
                value={configuration.density.probeSize}
                showValue={true}
                onChange={(probeSize) => setDensityConfiguration({ ...configuration.density, probeSize })}
            />
            <Checkbox
                label="Compute for each chromosome individually"
                checked={configuration.density.individual}
                onChange={(e, individual) => setDensityConfiguration({ ...configuration.density, individual: individual ?? false })} />
        </>}

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && configuration.data[configuration.selectedDatum].colorMappingMode == '1d-density' && <>
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
                        (configuration.data[configuration.selectedDatum].mapValues.id >= 0) ? configuration.data[configuration.selectedDatum].mapValues.id : null
                    }
                />)
            }</>
        }

        {configuration.selectedDatum != null && configuration.data.length > configuration.selectedDatum && configuration.data[configuration.selectedDatum].colorMappingMode == '1d-numerical' && <>
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
                        (configuration.data[configuration.selectedDatum].mapValues.id >= 0) ? configuration.data[configuration.selectedDatum].mapValues.id : null
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
                        selectedKey={configuration.data[configuration.selectedDatum].mapValues.aggregationFunction}
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

        {/* <Separator></Separator>
        <Text nowrap block variant='large'>Labeling</Text>
        <Checkbox label="Show labels" checked={configuration.labeling.showLabelingOverlay} onChange={handleShowLabelingOverlayChange} />
        <Checkbox label="Max Dist on CPU" checked={configuration.labeling.useMaxDistCPU} onChange={handleUseMaxDistCPUChange} />

        <Separator></Separator>
        <Checkbox label="Show anchors" checked={configuration.labeling.showLabelAnchors} onChange={handleShowLabelAnchorsChange} />
        <Checkbox label="Show debug overlay" styles={{ root: { marginTop: '10px' } }} checked={configuration.labeling.showDebugViewport} onChange={handleShowDebugViewportChange} />
        <ComboBox label="Texture" options={labelingDebugTextureOptions} onChange={setShownDebugTexture} /> */}
    </div>
}
