import { IJsonModel } from 'flexlayout-react';

export const initialWorkspaceState: IJsonModel = {
  global: {
    splitterSize: 8,
    tabSetHeaderHeight: 44,
    tabSetTabStripHeight: 44,
  },
  layout: {
    "type": "row",
    "weight": 100,
    "children": [
    ]
  }
};

export type WorkspaceStorage = { workspaceData: IJsonModel };


//#region Reducer
export enum WorkspaceActionKind {
  REPLACE = 'REPLACE',
}

export type WorkspaceActionReplace = {
  type: WorkspaceActionKind.REPLACE;

  model: IJsonModel;
}

export type WorkspaceAction = WorkspaceActionReplace;

export function workspaceReducer(state: IJsonModel, action: WorkspaceAction): IJsonModel {
  switch (action.type) {
    case WorkspaceActionKind.REPLACE: {
      return action.model;
    }
    default: return state;
  }
}
//#endregion
