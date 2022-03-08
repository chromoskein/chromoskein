import { ConfigurationState } from "./models/viewports/configuration";
import { DataState } from "./models/data";
import { SelectionState } from "./models/selections";
import { WorkspaceStorage } from "./models/workspace";

// increment when the current application 
// can no longer correctly load previously created application states
export const APPLICATION_STATE_VERSION = 1;

export interface ApplicationState {
    data?: DataState;
    workspace?: WorkspaceStorage;
    configurations?: ConfigurationState;
    selections?: SelectionState;
    version?: number;
    [key: string]: unknown;

}

