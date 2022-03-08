import { NodeModel, Tree } from "@minoru/react-dnd-treeview";
import React, { Dispatch, useState } from "react";
import './RightPanel.scss';
import { Delete16Regular, Rename16Regular, ChevronDown20Regular, ChevronRight20Regular } from '@fluentui/react-icons';
import { Data, DataAction, DataActionKind, DataID, DataState, isoDataID } from "../../modules/storage/models/data";
import { TextField } from "@fluentui/react";
import { Selection, SelectionAction, SelectionActionKind, SelectionState, SelectionColor, SelectionID } from "../../modules/storage/models/selections";

type NodeData = {
    id: SelectionID | DataID,
    hasSelections: boolean
    nodeType: NodeType
    color?: SelectionColor
}

enum NodeType {
    Selection = 'selection',
    Data = 'data'
}


function TreeOpenCloseArrow(props: {
    node: NodeModel<NodeData>,
    isOpen: boolean,
    onToggle: () => void

}) {
    if (props.node.data == null) {
        throw "Can't have NodeModel without any data"
    }
    const nodeData = props.node.data
    return <>
        {nodeData.hasSelections && (
            <div className="compensateLeft" onClick={props.onToggle}>
                {props.isOpen
                    ? <ChevronDown20Regular primaryFill={'white'} className='icon iconHoverBlue'></ChevronDown20Regular>
                    : <ChevronRight20Regular primaryFill={'white'} className='icon iconHoverBlue'></ChevronRight20Regular>
                }
            </div>
        )}
        {/* {!props.node.droppable && (
            <span style={{ display: 'block', width: '20px' }}>
            </span>
        )} */}
    </>
}

export function TreeView(props: {
    dataReducer: [DataState, Dispatch<DataAction>]
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>]
}): JSX.Element {
    const [data, dispatchData] = props.dataReducer;
    const [selections, dispatchSelection] = props.selectionsReducer;
    const [renaming, setRenaming] = useState<{ id: SelectionID | DataID, newName: string, type: NodeType } | null>(null);
    const handleRenameChange = (_e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, changedName: string | undefined) => {
        if (renaming == null) {
            throw "Renaming object must be created first";
        }
        setRenaming({ ...renaming, newName: changedName ?? "" })
    }

    const handleRenameStart = (node: NodeModel<NodeData>) => {
        setRenaming({
            id: node.data!.id,
            newName: node.text,
            type: node.data!.nodeType
        });
    }

    const handleRenameEnd = () => {
        if (renaming == null) {
            return;
        }
        if (renaming.type == NodeType.Data) {
            const datapoint = data.data.find((d) => d.id === renaming.id);
            if (datapoint == null) {
                throw "Datapoint to rename no longer exists."
            }
            dispatchData({
                type: DataActionKind.UPDATE, id: renaming.id as DataID, modifiedDatapoint: {
                    ...datapoint,
                    name: renaming.newName.length == 0 ? "unnamed" : renaming.newName
                }
            })

        } else if (renaming.type == NodeType.Selection) {
            const selection = selections.selections.find((s) => s.id === renaming.id);
            if (selection == null) {
                throw "Selection to rename no longer exists."
            }
            dispatchSelection({
                type: SelectionActionKind.UPDATE,
                ...selection,
                name: renaming.newName.length == 0 ? "unnamed" : renaming.newName
            })
        }
        setRenaming(null);



    }
    const handleDelete = (node: NodeModel<NodeData>) => {
        if (node.data?.nodeType == NodeType.Data) {
            const selectionsToRemove = selections.selections.filter(s => s.dataID == node.data?.id);
            for (const s of selectionsToRemove) {
                dispatchSelection(
                    {
                        type: SelectionActionKind.REMOVE,
                        id: s.id
                    }
                )
            }
            dispatchData(
                {
                    type: DataActionKind.REMOVE,
                    id: node.data.id as DataID
                }
            )
        } else if (node.data?.nodeType == NodeType.Selection) {
            dispatchSelection(
                {
                    type: SelectionActionKind.REMOVE,
                    id: node.data.id as SelectionID
                }
            )
        }

    }

    function makeTree(data: Array<Data>, selections: Array<Selection>): NodeModel<NodeData>[] {
        const tree: NodeModel<NodeData>[] = []
        let maxId = 1;

        for (const d of data) {
            const dataSelections = selections.filter(s => s.dataID == d.id);
            const dataId = maxId;
            tree.push(
                {
                    id: dataId,
                    parent: 0,
                    text: d.name,
                    data: {
                        id: d.id,
                        hasSelections: dataSelections.length > 0,
                        nodeType: NodeType.Data,
                    } as NodeData
                }
            );
            maxId++;
            for (const s of dataSelections) {
                tree.push({
                    id: maxId,
                    parent: dataId,
                    text: s.name,
                    data: {
                        id: s.id,
                        hasSelections: false,
                        nodeType: NodeType.Selection,
                        color: s.color
                    } as NodeData
                })
                maxId++;
            }
        }
        return tree;

    }

    // const addTimeseries = () => {
    //     dispatch(dataSlice.actions.addTimeseries({ name: 'New Timeseries' }));
    // };

    return <div className="treeViewPanel">
        {/* <Stack style={{ padding: '10px' }}>
            <StackItem align="baseline"><DefaultButton text='Add Timeseries' onClick={addTimeseries} className='smallButton' /></StackItem>            
        </Stack>         */}
        <Tree
            tree={makeTree(data.data, selections.selections)}
            rootId={0}
            initialOpen={true}
            onDrop={() => { }}
            render={(node: NodeModel<NodeData>, { depth, isOpen, onToggle }) => {
                const nodeData = (node.data as NodeData)
                if (renaming && renaming.type == nodeData.nodeType && renaming.id === nodeData.id) {
                    return <div className='treeViewListItem'>
                        <TreeOpenCloseArrow node={node} isOpen={isOpen} onToggle={onToggle}></TreeOpenCloseArrow>
                        <TextField className="text" defaultValue={node.text} onChange={handleRenameChange} onKeyDown={(e) => e.key === 'Enter' && handleRenameEnd()}></TextField>
                        <Rename16Regular className='icon iconHoverBlue' onClick={() => handleRenameEnd()}></Rename16Regular>
                        <Delete16Regular primaryFill={'white'} className='icon iconHoverRed' onClick={() => handleDelete(node)}></Delete16Regular>
                    </div>
                } else {
                    return <div className='treeViewListItem'>
                        <TreeOpenCloseArrow node={node} isOpen={isOpen} onToggle={onToggle}></TreeOpenCloseArrow>
                        {nodeData.nodeType == NodeType.Selection && nodeData.color && <>
                            <span style={{ display: 'block', width: '16px' }}></span>
                            <span className='selectionColorbox' style={{ backgroundColor: `rgb(${nodeData.color.r * 255}, ${nodeData.color.g * 255}, ${nodeData.color.b * 255})` }}></span>
                            <span style={{ display: 'block', width: '4px' }}></span>
                        </>}

                        <span onDoubleClick={() => handleRenameStart(node)} className='text'>{node.text}</span>
                        <Rename16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={() => handleRenameStart(node)}></Rename16Regular>
                        <Delete16Regular primaryFill={'white'} className='icon iconHoverRed' onClick={() => handleDelete(node)}></Delete16Regular>
                    </div>
                }

            }}
            classes={
                {
                    root: 'treeView',
                    container: 'treeViewContainer',
                    listItem: 'treeViewList',
                    dropTarget: 'treeViewDroppable',
                    draggingSource: 'treeViewDragginSource',
                }
            }
        />
    </div>
}
