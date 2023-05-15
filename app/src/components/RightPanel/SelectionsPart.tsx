import { DistanceMapDataConfiguration, ChromatinViewportConfiguration, ViewportConfiguration, ViewportConfigurationType, ViewportSelectionOptions, IChromatinDataConfiguration } from "../../modules/storage/models/viewports";
import { DataAction, DataID, DataState, Positions3D } from "../../modules/storage/models/data";
import { isoSelectionID, SelectionAction, SelectionActionKind, SelectionID, Selection, SelectionState } from "../../modules/storage/models/selections";
import { ConfigurationReducer, ConfigurationsWithSelections } from "../hooks";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";

import { Dispatch, useState } from "react";
import { Text } from '@fluentui/react/lib/Text';
import { Delete16Regular, EyeShow16Regular, EyeOff16Regular, Rename16Regular } from '@fluentui/react-icons';
import { Callout, ColorPicker, DefaultButton, IColor, PrimaryButton, TextField } from "@fluentui/react";
import { useBoolean, useId } from '@fluentui/react-hooks';

export interface PropsSelectionsPart<T extends ViewportConfiguration> {
    selections: Array<[Selection, ViewportSelectionOptions]>,
    configurationReducer: ConfigurationReducer<T>,
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
    selectedDataIndex: number,
}

export function SelectionsPart<T extends ConfigurationsWithSelections>(props: PropsSelectionsPart<T>): JSX.Element {
    const [data, dataDispatch] = props.dataReducer;
    const [globalSelections, globalSelectionsDispatch] = props.selectionsReducer;
    const [configuration, updateConfiguration] = props.configurationReducer;

    let selectedDataPartID: DataID | SelectionID | null = null;
    if (configuration.data) {
        if (Array.isArray(configuration.data) && configuration.data[props.selectedDataIndex]) {
            selectedDataPartID = configuration.data[props.selectedDataIndex].id;
        }
        
        if (!Array.isArray(configuration.data)) {
            selectedDataPartID = configuration.data.id;
        }
    }

    const selections = props.selections;
    const [renaming, setRenaming] = useState<{ id: SelectionID, newName: string } | null>(null);
    const [isCalloutVisible, { toggle: toggleIsCalloutVisible }] = useBoolean(false);

    if (!configuration.data) return <div></div>;

    if (configuration.type == ViewportConfigurationType.TAD && configuration.data.type == DistanceMapDataConfiguration.Selection) {
        return <div></div>;
    }

    const addSelection = () => {
        if (selectedDataPartID) {
            const dataSize = (data.data.find(d => d.id == selectedDataPartID)?.values as Positions3D | undefined)?.positions.length;

            if (dataSize) {
                globalSelectionsDispatch({ type: SelectionActionKind.ADD, dataID: selectedDataPartID as DataID, dataSize });
            }
        }
    }

    const selectSelection = (selectionID: SelectionID) => {
        if (configuration.type === ViewportConfigurationType.Chromatin && props.selectedDataIndex != null) {
            const newData = [...configuration.data];
            newData[props.selectedDataIndex] = {
                ...newData[props.selectedDataIndex],
                selectedSelectionID: selectionID,
            };

            updateConfiguration({
                ...configuration,
                data: newData                
            });
        } else {
            updateConfiguration({
                ...configuration,
                selectedSelectionID: selectionID,
            });
        }
    }

    const handleRenameStart = (selection: Selection) => setRenaming({ id: selection.id, newName: selection.name })
    const handleRenameChange = (newName: string | undefined) => setRenaming({ ...renaming!, newName: newName ?? "" })
    const handleRenameEnd = () => {
        const selection = globalSelections.selections.find((s) => s.id === renaming!.id);
        if (selection == null) {
            throw "Selection to rename no longer exists."
        }
        globalSelectionsDispatch({
            type: SelectionActionKind.UPDATE,
            ...selection,
            name: renaming!.newName.length == 0 ? "unnamed" : renaming!.newName
        })
        setRenaming(null);
    }

    const setSelectionCullVisiblity = (selectionID: SelectionID, cullable: boolean, dataIndex = 0) => {
        if (!configuration.data || ((Array.isArray(configuration.data) && configuration.data.length == 0))) {
            return;
        }

        if (Array.isArray(configuration.data)) {
            const associatedSelectionIndex = configuration.data[props.selectedDataIndex].selections.findIndex(s => s.selectionID == selectionID);

            const newData = [...configuration.data];
            newData[props.selectedDataIndex] = {
                ...newData[props.selectedDataIndex],
                selections: [...configuration.data[dataIndex].selections]
            };
    
            newData[props.selectedDataIndex].selections[associatedSelectionIndex] = {
                ...newData[props.selectedDataIndex].selections[associatedSelectionIndex],
                cullable,
            };
    
            updateConfiguration({
                ...configuration,
                data: newData,
            });
        } else {
            const associatedSelectionIndex = configuration.data.selections.findIndex(s => s.selectionID == selectionID);
            const newData = {
                ...configuration.data,
                selections: configuration.data.selections.map((s: ViewportSelectionOptions) => { return { selectionID: s.selectionID, visible: s.visible, cullable: s.cullable } }),
            };
    
            newData.selections[associatedSelectionIndex].cullable = cullable;
    
            updateConfiguration({
                ...configuration,
                data: newData,
            });
        }
    }

    const setSelectionVisiblity = (selectionID: SelectionID, visible: boolean, dataIndex = 0) => {
        if (!configuration.data || ((Array.isArray(configuration.data) && configuration.data.length == 0))) {
            return;
        }

        if (Array.isArray(configuration.data)) {
            const associatedSelectionIndex = configuration.data[props.selectedDataIndex].selections.findIndex(s => s.selectionID == selectionID);

            const newData: IChromatinDataConfiguration[] = [...configuration.data];
            newData[props.selectedDataIndex] = {
                ...newData[props.selectedDataIndex],
                selections: configuration.data[dataIndex].selections.map((s: ViewportSelectionOptions) => { return { selectionID: s.selectionID, visible: s.visible, cullable: s.cullable } }),
            };
    
            newData[props.selectedDataIndex].selections[associatedSelectionIndex].visible = visible;
    
            updateConfiguration({
                ...configuration,
                data: newData,
            });
        } else {
            const associatedSelectionIndex = configuration.data.selections.findIndex(s => s.selectionID == selectionID);
            const newData = {
                ...configuration.data,
                selections: configuration.data.selections.map((s: ViewportSelectionOptions) => { return { selectionID: s.selectionID, visible: s.visible, cullable: s.cullable } }),
            };
    
            newData.selections[associatedSelectionIndex].visible = visible;
    
            updateConfiguration({
                ...configuration,
                data: newData,
            });
        }
    }

    const removeSelection = (selectionID: SelectionID) => {
        if (!configuration) return;

        globalSelectionsDispatch({
            type: SelectionActionKind.REMOVE,
            id: selectionID,
        });
    }

    function handleDragEnd(result: DropResult) {
        if (!result.destination) {
            return;
        }

        globalSelectionsDispatch({
            type: SelectionActionKind.REORDER,
            sourceIndex: result.source.index,
            targetIndex: result.destination.index,
        });
    }

    function changeSelectionColor(selectionID: SelectionID, color: IColor) {
        globalSelectionsDispatch({
            type: SelectionActionKind.UPDATE,
            id: selectionID,
            color: {
                r: color.r / 255,
                g: color.g / 255,
                b: color.b / 255,
                a: color.a != undefined ? (color.a / 255) : 1
            },
        });
    }

    const isSelected = (id: SelectionID) => {
        if (configuration.type === ViewportConfigurationType.Chromatin) {
            return configuration.data[props.selectedDataIndex].selectedSelectionID == id;
        } else {
            return configuration.selectedSelectionID == id;
        }
    }

    const buttonId = useId('callout-button');    

    return <>
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="selections">
                {(provided, snapshot) => <>
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                        {selections.map(([selection, options], index) =>
                            <Draggable
                                key={isoSelectionID.unwrap(selection.id)}
                                draggableId={`${isoSelectionID.unwrap(selection.id)}`}
                                index={index}>
                                {(provided, snapshot) => (
                                    <div ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={isSelected(selection.id) ? "treeViewListItem selected" : "treeViewListItem"}
                                        onClick={() => selectSelection(selection.id)}>
                                        <DefaultButton id={buttonId}
                                            style={{
                                                padding: 0,
                                                minWidth: "0px",
                                            }}
                                            onRenderText={(p) => <div
                                                style={{
                                                    width: '1.2rem',
                                                    height: '1.2rem',
                                                    margin: '0px 4px',
                                                    backgroundColor: `rgb(${selection.color.r * 255}, ${selection.color.g * 255}, ${selection.color.b * 255})`,
                                                }}
                                                key={`${isoSelectionID.unwrap(selection.id)}-color-button`}
                                            ></div>}
                                            onClick={toggleIsCalloutVisible}
                                        />
                                        {isCalloutVisible && (
                                            <Callout
                                                gapSpace={0}
                                                target={`#${buttonId}`}
                                                setInitialFocus
                                                onDismiss={toggleIsCalloutVisible}
                                            >
                                                <ColorPicker
                                                    color={`rgb(${selection.color.r * 255}, ${selection.color.g * 255}, ${selection.color.b * 255})`}
                                                    onChange={(_, color) => changeSelectionColor(selection.id, color)}
                                                    alphaType={'none'}
                                                    showPreview={true}
                                                    strings={{
                                                        hueAriaLabel: 'Hue',
                                                    }}
                                                />
                                            </Callout>
                                        )}
                                        <span style={{ display: 'block', width: '4px' }}></span>
                                        {renaming && renaming.id === selection.id && <>
                                            <TextField className="text" defaultValue={selection.name} onChange={(_e, newName) => handleRenameChange(newName)} onKeyDown={(e) => e.key === 'Enter' && handleRenameEnd()}></TextField>
                                            <Rename16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={handleRenameEnd}></Rename16Regular>
                                        </>}
                                        {(!renaming || renaming.id !== selection.id) && <>
                                            <Text className="text" nowrap>{selection.name}</Text>
                                            <Rename16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={() => handleRenameStart(selection)}></Rename16Regular>
                                        </>}

                                        {(options.cullable) && (<EyeShow16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={(e) => { e.stopPropagation(); setSelectionCullVisiblity(selection.id, false) }}></EyeShow16Regular>)}
                                        {(!options.cullable) && (<EyeOff16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={(e) => { e.stopPropagation(); setSelectionCullVisiblity(selection.id, true) }}></EyeOff16Regular>)}

                                        {(options.visible) && (<EyeShow16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={(e) => { e.stopPropagation(); setSelectionVisiblity(selection.id, false) }}></EyeShow16Regular>)}
                                        {(!options.visible) && (<EyeOff16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={(e) => { e.stopPropagation(); setSelectionVisiblity(selection.id, true) }}></EyeOff16Regular>)}

                                        <Delete16Regular primaryFill={'white'} className='icon iconHoverRed' onClick={(e) => { e.stopPropagation(); removeSelection(selection.id) }}></Delete16Regular>
                                    </div>
                                )}
                            </Draggable>)}
                    </div>
                    {provided.placeholder}
                </>}
            </Droppable>
        </DragDropContext>
        {(selectedDataPartID != null) && (<PrimaryButton text='Add selection' style={{ marginTop: '8px' }} onClick={() => addSelection()} />)}
    </>
}