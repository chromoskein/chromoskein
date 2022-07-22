import { saveAs } from 'file-saver';
import { parse } from 'papaparse';
import { ApplicationState } from './state';

export async function saveToFile(states: ApplicationState): Promise<void> {
    const content = new Blob(
        [JSON.stringify(states)],
        {
            type: "application/json;charset=utf-8"
        }
    );
    const datetime = new Date();
    saveAs(content, `workspace-${datetime.toISOString().substring(0, 10)}.chromoskein`);
}

export type TextFile = { name: string, content: string };

export function loadFromJson(json: string): ApplicationState {
    const parsed: ApplicationState = JSON.parse(json);

    // Fix TypedArray conversion to Object
    if (parsed.selections) {
        for (const selection of parsed.selections.selections) {
            selection.bins = new Uint16Array(Array.from(Object.values(selection.bins)));
        }       
    }
    return parsed;
}

export function loadFromFile(file: TextFile): ApplicationState {
    return loadFromJson(file.content);
}