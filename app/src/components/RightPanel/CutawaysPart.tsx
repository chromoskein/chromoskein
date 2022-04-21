import { ChromatinViewportConfiguration } from "../../modules/storage/models/viewports";
import { ConfigurationReducer } from "../hooks";

import { FormEvent, useState } from "react";
import { Text } from '@fluentui/react/lib/Text';
import { Delete16Regular, Rename16Regular } from '@fluentui/react-icons';
import { ChoiceGroup, IChoiceGroupOption, PrimaryButton, Slider, TextField } from "@fluentui/react";
import { vec3 } from "gl-matrix";

export function CutawaysPart(props: { configurationReducer: ConfigurationReducer<ChromatinViewportConfiguration> }): JSX.Element {
    const [configuration, updateConfiguration] = props.configurationReducer;
    const [renaming, setRenaming] = useState<{ cutawayIndex: number, newName: string } | null>(null);

    const addCutaway = () => {
        updateConfiguration({
            ...configuration,
            cutaways: [...configuration.cutaways, {
                name: "Cutaway " + configuration.cutaways.length,
                axis: 'X',
                length: -1,
            }]
        });
    }

    const selectCutaway = (cutawayIndex: number) => {
        updateConfiguration({
            ...configuration,
            selectedCutaway: cutawayIndex,
        });
    }

    const removeCutaway = (cutawayIndex: number) => {
        const cutaways = configuration.cutaways.slice();
        cutaways.splice(cutawayIndex, 1);

        updateConfiguration({
            ...configuration,
            selectedCutaway: configuration.selectedCutaway == cutawayIndex ? 0 : configuration.selectedCutaway,
            cutaways
        });
    }

    const handleRenameStart = (cutawayIndex: number, newName: string) => setRenaming({ cutawayIndex, newName })
    const handleRenameChange = (newName: string | undefined) => setRenaming({ ...renaming!, newName: newName ?? "" })
    const handleRenameEnd = () => {
        if (!renaming) return;

        const cutaways = configuration.cutaways.slice();
        cutaways[renaming.cutawayIndex] = {
            ...cutaways[renaming.cutawayIndex],
            name: renaming.newName
        };

        updateConfiguration({
            ...configuration,
            cutaways
        });

        setRenaming(null);
    }

    const setCutawayAxis = (ev?: FormEvent<HTMLElement | HTMLInputElement> | undefined, option?: IChoiceGroupOption | undefined) => {
        if (!option) return;

        const key = option.key;

        if (key != 'X' && key != 'Y' && key != 'Z' && key != 'CAMERA') return;

        const cutaways = configuration.cutaways.slice();

        if (key == 'CAMERA') {
            const position = vec3.fromValues(configuration.camera.position.x, configuration.camera.position.y, configuration.camera.position.z);
            const lookAtPosition = vec3.fromValues(configuration.camera.lookAtPosition.x, configuration.camera.lookAtPosition.y, configuration.camera.lookAtPosition.z);

            const forwardVector = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), lookAtPosition, position));

            cutaways[configuration.selectedCutaway] = {
                ...cutaways[configuration.selectedCutaway],
                axis: forwardVector
            };
        } else {
            cutaways[configuration.selectedCutaway] = {
                ...cutaways[configuration.selectedCutaway],
                axis: key,
            };
        }

        updateConfiguration({
            ...configuration,
            cutaways
        });
    }

    const setCutawayLength = (length: number) => {
        const cutaways = configuration.cutaways.slice();
        cutaways[configuration.selectedCutaway] = {
            ...cutaways[configuration.selectedCutaway],
            length,
        };

        updateConfiguration({
            ...configuration,
            cutaways
        });
    }

    let selectedKey: 'X' | 'Y' | 'Z' | 'CAMERA' = 'X';
    if (configuration.cutaways.length > 0 && configuration.cutaways[configuration.selectedCutaway]) {
        const axis = configuration.cutaways[configuration.selectedCutaway].axis;
        if (axis instanceof Array || axis instanceof Float32Array) {
            selectedKey = 'CAMERA';
        } else {
            selectedKey = axis;
        }
    }

    return <div><Text nowrap block variant='large'>Cutaways</Text>
        {configuration.cutaways.map((cutaway, cutawayIndex) => {
            if (renaming && renaming.cutawayIndex === cutawayIndex) {
                return <div
                    className={cutawayIndex == configuration.selectedCutaway ? "treeViewListItem selected" : "treeViewListItem"}
                    key={cutawayIndex}
                    onClick={() => selectCutaway(cutawayIndex)}>
                    <span style={{ display: 'block', width: '4px' }}></span>
                    <TextField className="text" defaultValue={cutaway.name} onChange={(_e, newName) => handleRenameChange(newName)} onKeyDown={(e) => e.key === 'Enter' && handleRenameEnd()}></TextField>
                    <Rename16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={handleRenameEnd}></Rename16Regular>
                    <Delete16Regular primaryFill={'white'} className='icon iconHoverRed' onClick={(e) => { e.stopPropagation(); removeCutaway(cutawayIndex) }}></Delete16Regular>
                </div>
            } else {
                return <div
                    className={cutawayIndex == configuration.selectedCutaway ? "treeViewListItem selected" : "treeViewListItem"}
                    key={cutawayIndex}
                    onClick={() => selectCutaway(cutawayIndex)}
                    style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'block', width: '4px' }}></span>
                    <span className='text'>{cutaway.name}</span>
                    <Rename16Regular primaryFill={'white'} className='icon iconHoverBlue' onClick={() => handleRenameStart(cutawayIndex, cutaway.name)}></Rename16Regular>
                    <Delete16Regular primaryFill={'white'} className='icon iconHoverRed' onClick={(e) => { e.stopPropagation(); removeCutaway(cutawayIndex) }}></Delete16Regular>
                </div>
            }
        })}

        <PrimaryButton text='Add Cutaway' style={{ marginTop: '8px' }} onClick={() => addCutaway()} />
        {configuration.cutaways.length > 0 && (<ChoiceGroup
            selectedKey={selectedKey}
            styles={{ flexContainer: { display: "flex", gap: "16px" } }}
            options={[
                { key: 'X', text: 'X' },
                { key: 'Y', text: 'Y' },
                { key: 'Z', text: 'Z' },
                { key: 'CAMERA', text: "Camera facing" }]}
            label="Cutaway axis"
            onChange={setCutawayAxis}
            required={true} />)}
        {configuration.cutaways.length > 0 && (<Slider
            label="Cutaway"
            min={-1.0}
            max={1.0}
            step={0.01}
            value={configuration.cutaways[configuration.selectedCutaway].length}
            onChange={value => setCutawayLength(value)}
        ></Slider>)}
    </div>
}