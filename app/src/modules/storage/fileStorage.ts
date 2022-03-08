import { saveAs } from 'file-saver';
import { ApplicationState } from './state';

export async function saveToFile(states: ApplicationState): Promise<void> {
    const content = new Blob(
        [JSON.stringify(states)],
        {
            type: "application/json;charset=utf-8"
        }
    );
    const datetime = new Date();
    saveAs(content, `workspace-${datetime.toISOString().substring(0, 10)}.chromazoom`);
}

export type TextFile = { name: string, content: string };
export function loadFromFile(file: TextFile): ApplicationState {
    return JSON.parse(file.content);
}