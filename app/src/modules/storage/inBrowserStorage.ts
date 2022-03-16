import { setMany, getMany, delMany, clear } from 'idb-keyval';
import { ApplicationState } from './state';


export async function saveToBrowser(states: ApplicationState): Promise<void> {
    return setMany(Object.entries(states))
        .catch(err => {
            console.error("Failed to save app states to IndexDB")
            throw err;
        });
}

export async function loadFromBrowser(states: Array<string>): Promise<ApplicationState> {

    return getMany(states)
        .then(
            (stateValues) => {
                const result: ApplicationState = {};
                for (let stateIndex = 0; stateIndex < stateValues.length; stateIndex++) {
                    if (stateValues[stateIndex] != null) {
                        result[states[stateIndex]] = stateValues[stateIndex];
                    }
                }
                return result;
            }
        ).catch((err) => {
            console.error("Failed to load app states from IndexDB")
            throw err;
        })
}

export async function clearBrowser(): Promise<void> {
    return clear()
        .catch(err => {
            console.error("Failed to delete app states from IndexDB")
            throw err
        })
}