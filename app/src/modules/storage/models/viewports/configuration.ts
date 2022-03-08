import { ViewportConfiguration, ViewportSelectionOptions } from "./shared";

//#region State
type Configuration = {
  id: number;
  viewportConfiguration: ViewportConfiguration;
}

export type ConfigurationState = {
  maxId: number;
  configurations: Array<Configuration>;
}
//#endregion

//#region Reducer
export enum ConfigurationActionKind {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  UPDATE_SELECTIONS = 'UPDATE_SELECTIONS',
  SET = 'SET',
}

export type ConfigurationActionAdd = {
  type: ConfigurationActionKind.ADD;

  viewportConfiguration: ViewportConfiguration;
}

export type ConfigurationActionUpdate = {
  type: ConfigurationActionKind.UPDATE;

  id: number;
  viewportConfiguration: ViewportConfiguration;
};

export type ConfigurationActionUpdateSelections = {
  type: ConfigurationActionKind.UPDATE_SELECTIONS;

  id: number;
  selections: Array<ViewportSelectionOptions>;
};

export type ConfigurationActionSet = {
  type: ConfigurationActionKind.SET;

  state: ConfigurationState
};

export type ConfigurationAction = ConfigurationActionAdd | ConfigurationActionUpdate | ConfigurationActionSet;

export function configurationReducer(state: ConfigurationState, action: ConfigurationAction): ConfigurationState {
  switch (action.type) {
    case ConfigurationActionKind.ADD: {
      const maxId = state.maxId + 1;

      return {
        ...state,
        maxId,
        configurations: [...state.configurations, { id: maxId, viewportConfiguration: action.viewportConfiguration }]
      };
    }
    case ConfigurationActionKind.UPDATE: {
      const configurationIndex: number = state.configurations.findIndex(e => e.id == action.id);

      if (configurationIndex < 0) {
        return state;
      }

      const newConfigurations = [...state.configurations];
      newConfigurations[configurationIndex] = { id: action.id, viewportConfiguration: action.viewportConfiguration };

      return {
        ...state,
        configurations: newConfigurations
      }
    }
    case ConfigurationActionKind.SET: {
      return action.state;
    }
    default: return state;
  }
}
//#endregion
