import { DistanceMapDataConfiguration, ViewportConfiguration, ViewportConfigurationType, ViewportSelectionOptions } from "../../modules/storage/models/viewports";
import { DataAction, DataID, DataState } from "../../modules/storage/models/data";
import { isoSelectionID, SelectionAction, SelectionActionKind, SelectionID, Selection, SelectionState } from "../../modules/storage/models/selections";
import { ConfigurationReducer, ConfigurationsWithSelections } from "../hooks";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";

import { Dispatch, useState } from "react";
import { Text } from '@fluentui/react/lib/Text';
import { Delete16Regular, EyeShow16Regular, EyeOff16Regular, Rename16Regular } from '@fluentui/react-icons';
import { Callout, ColorPicker, DefaultButton, IColor, PrimaryButton, TextField } from "@fluentui/react";

export interface PropsSelectionsPart<T extends ViewportConfiguration> {
    selections: Array<[Selection, ViewportSelectionOptions]>,
    configurationReducer: ConfigurationReducer<T>,
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}

export function SelectionsPart<T extends ConfigurationsWithSelections>(props: PropsSelectionsPart<T>): JSX.Element {
    const [data, dataDispatch] = props.dataReducer;
    const [globalSelections, globalSelectionsDispatch] = props.selectionsReducer;
    const [configuration, updateConfiguration] = props.configurationReducer;

    const selectedDataPartID: DataID | SelectionID | null = configuration.data ? configuration.data.id : null;

    const selections = props.selections;
    const [renaming, setRenaming] = useState<{ id: SelectionID, newName: string } | null>(null);
    const [isColorCalloutVisible, setIsColorCalloutVisible] = useState<boolean>(false);


    if (!configuration.data) return <div></div>;

    if (configuration.type == ViewportConfigurationType.TAD && configuration.data.type == DistanceMapDataConfiguration.Selection) {
        return <div></div>;
    }

    const addSelection = () => {
        if (selectedDataPartID) {
            const dataSize = data.data.find(d => d.id == selectedDataPartID)?.values?.length;

            if (dataSize) {
                globalSelectionsDispatch({ type: SelectionActionKind.ADD, dataID: selectedDataPartID as DataID, dataSize });
            }
        }
    }

    const selectSelection = (selectionID: SelectionID) => {
        updateConfiguration({
            ...configuration,
            selectedSelectionID: selectionID,
        });
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

    const setSelectionVisiblity = (selectionID: SelectionID, visible: boolean) => {
        if (!configuration.data) return;

        const associatedSelectionIndex = configuration.data.selections.findIndex(s => s.selectionID == selectionID);
        const newData = {
            ...configuration.data,
            selections: configuration.data.selections.map((s: ViewportSelectionOptions) => { return { selectionID: s.selectionID, visible: s.visible } }),
        };

        newData.selections[associatedSelectionIndex].visible = visible;

        updateConfiguration({
            ...configuration,
            data: newData,
        });
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
        console.log(color);

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
                                        className={selection.id == configuration.selectedSelectionID ? "treeViewListItem selected" : "treeViewListItem"}
                                        onClick={() => selectSelection(selection.id)}>
                                        <DefaultButton id="selectionColorButton"
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
                                            onClick={() => setIsColorCalloutVisible(true)}
                                        />
                                        {isColorCalloutVisible && (
                                            <Callout
                                                gapSpace={0}
                                                target={'#selectionColorButton'}
                                                onDismiss={() => setIsColorCalloutVisible(false)}
                                                setInitialFocus
                                            >
                                                <ColorPicker
                                                    color={configuration.backgroundColor}
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