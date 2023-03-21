import React, { Dispatch, Fragment, useMemo } from "react";

import { ConfigurationAction, ConfigurationState, DistanceDataConfiguration, DistanceMapDataConfiguration, DistanceViewportConfiguration, TrackType } from '../../../modules/storage/models/viewports';
import { DataAction, DataState } from "../../../modules/storage/models/data";
import { isoSelectionID, SelectionAction, SelectionID, SelectionState } from "../../../modules/storage/models/selections";
import { useConfiguration } from '../../hooks';
import { Delete16Regular } from "@fluentui/react-icons";
import { ComboBox, DefaultButton, IComboBox, IComboBoxOption } from "@fluentui/react";
import { Text } from '@fluentui/react/lib/Text';
import { notEmpty } from "../../../modules/utils";

export function SelectionsTrack(props: {
    configurationID: number,
    configurationsReducer: [ConfigurationState, Dispatch<ConfigurationAction>],
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
    trackID: string,
}): JSX.Element {
    // Configuration/Data
    const configurationReducer = useConfiguration<DistanceViewportConfiguration>(props.configurationID, props.configurationsReducer);

    const [configuration, updateConfiguration] = configurationReducer;
    const [data, dataDispatch] = props.dataReducer;
    const [allSelections, allSelectionsDispatch] = props.selectionsReducer;

    const trackIndex = configuration.tracks.findIndex(t => t.id === props.trackID);
    const track = configuration.tracks[trackIndex];

    if (track.type != TrackType.Selections) {
        throw "";
    }

    const d = configuration.data as DistanceDataConfiguration;
    const selectionsList = allSelections.selections.filter(s => s.dataID == d.id).map(s => {
        return {
            key: isoSelectionID.unwrap(s.id),
            text: s.name,
        } as IComboBoxOption;
    });

    const addSelection = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption) => {
        if (!option) return;

        const key = option.key as number;

        const selectionID = isoSelectionID.wrap(key);

        const newTracks = [...configuration.tracks];
        const oldTrack = newTracks[trackIndex];

        if (oldTrack.type === TrackType.Selections) {
            const newSelections = [...new Set([...oldTrack.selections, selectionID])];
            newTracks[trackIndex] = {
                ...oldTrack,
                selections: newSelections
            };
        }

        updateConfiguration({
            ...configuration,
            tracks: newTracks
        });
    };

    const selections = useMemo(() => track.selections.map(selectionID => {
        if (configuration.data == null || configuration.data.type != DistanceMapDataConfiguration.Data) {
            return undefined;
        } else {
            const d = configuration.data as DistanceDataConfiguration;
            return allSelections.selections.find(s => s.id == selectionID && s.dataID == d.id);
        }
    }).filter(notEmpty), [configuration.data, track.selections, allSelections]);


    const selectSelection = (id: SelectionID) => {
        updateConfiguration({
            ...configuration,
            selectedSelectionID: id,
        });
    };

    return <Fragment><ComboBox
        label="Add a selection"
        allowFreeform={true}
        autoComplete={'on'}
        options={selectionsList}
        onChange={addSelection}
    /><div className="treeViewList" style={{ marginTop: '16px' }}>
            {track.type == TrackType.Selections && (selections.map(selection => {
                return <div className={`treeViewListItem ${selection.id === configuration.selectedSelectionID ? "selected" : ""}`} key={isoSelectionID.unwrap(selection.id).toString()} onClick={() => selectSelection(selection.id)}>
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
                        ></div>}
                        disabled={true}
                    />
                    <span style={{ display: 'block', width: '4px' }}></span>
                    <Text className="text" nowrap>{selection.name}</Text>
                    <Delete16Regular primaryFill={'white'} className='icon iconHoverRed'></Delete16Regular>
                </div>
            })
            )}
        </div>
    </Fragment >;
}
