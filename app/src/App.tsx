import './App.scss';
import React, { useEffect, useReducer } from 'react';
import TopBar from './components/TopBar';
import { Icon, Label, Separator, Slider, Stack } from '@fluentui/react';
import { useState } from 'react';
import * as FlexLayout from "flexlayout-react";
import { IIcons } from 'flexlayout-react/declarations/view/Layout';
import { initialWorkspaceState, WorkspaceActionKind, workspaceReducer, WorkspaceStorage } from './modules/storage/models/workspace';
import { RightPanel } from './components/RightPanel';
import { GraphicsLibrary } from "./modules/graphics/index";
import { ChromatinViewport } from './components/viewports/ChromatinViewport';
import { D1Viewport } from './components/viewports/D1Viewport';
import { ConfigurationActionKind, configurationReducer, ConfigurationState, defaultChromatinViewportConfiguration, defaultForceGraphViewportConfiguration, defaultDistanceViewportConfiguration, ViewportConfigurationType } from './modules/storage/models/viewports';
import { TADViewport } from './components/viewports/TADViewport';
import { isNumber } from 'lodash';
import { CursorClick24Regular, Lasso24Regular } from '@fluentui/react-icons';
import { NewXYZDataDialog } from './components/dialogs/NewXYZDataDialog';
// import New1DDataDialog from './dialogs/New1DDataDialog';
import { DataAction, DataActionKind, dataReducer, DataState } from './modules/storage/models/data';
import { SelectionActionKind, selectionReducer, SelectionState } from './modules/storage/models/selections';
import { clearBrowser, loadFromBrowser, saveToBrowser } from './modules/storage/inBrowserStorage';
import { saveToFile, loadFromFile } from './modules/storage/fileStorage';
import { ImportWorkspaceDialog } from './components/dialogs/ImportWorkspaceDialog';
import { ApplicationState, APPLICATION_STATE_VERSION } from './modules/storage/state';
import { ForceGraphViewport } from './components/viewports/ForceGraphViewport';
import { ToolsList } from './components/Tools/ToolsList';
import { ToolOptions } from './components/Tools/ToolOptions';
import { CoordinatePreview } from './components/Tools/CoordinatePreview';
import { NewGenomicDataDialog } from './components/dialogs/NewGenomicDataDialog';
import { coordinatePreviewReducer } from './modules/storage/models/coordinatePreview';

export enum Tool {
  PointSelection = 0,
  SphereSelection = 1,
}

function App(): JSX.Element {
  const [adapter, setAdapter] = useState<GPUAdapter | null>(null);
  const [device, setDevice] = useState<GPUDevice | null>(null);
  const [deviceError, setDeviceError] = useState<GPUUncapturedErrorEvent | null>(null);
  const [graphicsLibrary, setGraphicsLibrary] = useState<GraphicsLibrary | null>(null);

  //#region Adapter, Device, Library Initialization
  useEffect(() => {
    async function waitForAdapter() {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });

      setAdapter(adapter);
    }

    waitForAdapter();
  }, []);

  useEffect(() => {
    if (adapter == null) {
      return;
    }

    const waitForDevice = async function () {
      const device = await adapter.requestDevice({
        requiredFeatures: ['timestamp-query']
      });
      device.onuncapturederror = (error: GPUUncapturedErrorEvent) => {
        setDeviceError(error);
      };

      setDeviceError(null);
      setDevice(device);
    }

    waitForDevice();
  }, [adapter]);

  useEffect(() => {
    if (adapter == null || device == null) {
      return;
    }

    setGraphicsLibrary(() => new GraphicsLibrary(adapter, device));
  }, [adapter, device]);
  //#endregion

  //#region Application Data

  const initialState: ApplicationState = {
    version: APPLICATION_STATE_VERSION,
    data: {
      dataMaxId: 0,
      data: [],
    },
    configurations: {
      maxId: 0,
      configurations: [],
    },
    selections: {
      maxId: 0,
      selections: [],
    },
    workspace: {
      workspaceData: initialWorkspaceState
    }
  }


  const [data, dispatchData] = useReducer(
    dataReducer,
    initialState.data as DataState
  );
  const [workspace, dispatchWorkspace] = useReducer(
    workspaceReducer,
    initialState.workspace?.workspaceData as FlexLayout.IJsonModel
  );
  const [configurations, dispatchConfigurations] = useReducer(
    configurationReducer,
    initialState.configurations as ConfigurationState
  );
  const [selections, dispatchSelections] = useReducer(
    selectionReducer,
    initialState.selections as SelectionState
  );



  function setCurrentState(state: ApplicationState) {
    if (state.version == null || state.version < APPLICATION_STATE_VERSION) {
      throw "The workspace you are trying to load was created in a version of Chromazoom that is no longer supported."
    }
    if (state.data)
      dispatchData({
        type: DataActionKind.SET,
        state: state.data
      });
    if (state.workspace)
      dispatchWorkspace({
        type: WorkspaceActionKind.REPLACE,
        model: state.workspace.workspaceData
      });
    if (state.configurations)
      dispatchConfigurations({
        type: ConfigurationActionKind.SET,
        state: state.configurations
      });
    if (state.selections)
      dispatchSelections({
        type: SelectionActionKind.SET,
        state: state.selections
      });
  }

  function getCurrentState(): ApplicationState {
    return {
      data,
      configurations,
      selections,
      workspace: { workspaceData: workspace },
      version: APPLICATION_STATE_VERSION
    }
  }

  useEffect(() => {
    const loadAllFromBrowser = async () => {
      const state = await loadFromBrowser(Object.keys(getCurrentState()));
      if (state.version === undefined) {
        return;
      }
      setCurrentState(state);
    }

    loadAllFromBrowser();
  }, []);
  //#endregion

  //#region Workspace
  const [localModel, setLocalModel] = useState<FlexLayout.Model>(FlexLayout.Model.fromJson(workspace));

  useEffect(() => {
    if (!FlexLayout.Model) return;

    setLocalModel(FlexLayout.Model.fromJson(workspace));
  }, [workspace]);
  //#endregion

  //#region Dialogs
  const [newXYZDataDialogHidden, setNewXYZDataDialogHidden] = useState(true);
  const [newGenomicDataDialogHidden, setNewGenomicDataDialogHidden] = useState(true);
  const [new1DDataDialogHidden, setNew1DDataDialogHidden] = useState(true);
  const [newDistanceDataDialogHidden, setNewDistanceDataDialogHidden] = useState(true);
  const [workspaceFileImportDialogHidden, setWorkspaceFileImportDialogHidden] = useState(true);
  //#endregion

  //#region Tools
  const icons: IIcons = {
    close: <Icon iconName="ChromeClose" />
    // popout?: React.ReactNode;
    // maximize?: React.ReactNode;
    // restore?: React.ReactNode;
    // more?: React.ReactNode;
  }
  //#endregion


  const [coordinatePreview, dispatchCoordinatePreview] = useReducer(
    coordinatePreviewReducer,
    {
      type: "bin-coordinates-single",
      dataId: undefined,
      mappingIds: [],
      visible: false,
      from: 0,
      to: 0
    },
  );

  //#region Viewports creation
  const updateModel = (model: FlexLayout.Model) => {
    dispatchWorkspace({ type: WorkspaceActionKind.REPLACE, model: model.toJson() });
  };

  const titleFactory = (node: FlexLayout.TabNode) => {
    const config = node.getConfig();
    const configuration = configurations.configurations.find(c => c.id == config);
    if (!configuration) {
      console.error("Unknown type configuration")
      return "[WTF] Untitled";
    }
    const viewportConfiguration = configuration.viewportConfiguration;
    // default needs to be "[Unnamed tab]" to match the flexlayout default. Or figure out how to rename the tab before render
    const name = viewportConfiguration.tabName !== "" ? viewportConfiguration.tabName : "[Unnamed Tab]"
    const taggedName = `[${viewportConfiguration.tag}] ${name}`
    return taggedName;
  }

  const componentFactory = (node: FlexLayout.TabNode) => {
    const component = node.getComponent();
    const config = node.getConfig();
    const configuration = configurations.configurations.find(c => c.id == config);

    if (!config || !isNumber(config) || !configuration) {
      return <div></div>;
    }

    const viewportConfiguration = configuration.viewportConfiguration;

    if (component === "ForceGraphViewport") {

      if (viewportConfiguration.type != ViewportConfigurationType.ForceGraph) {
        return <div></div>;
      }

      return <ForceGraphViewport
        configurationID={config}
        configuration={viewportConfiguration}
        dataReducer={[data, dispatchData]}
        selectionsReducer={[selections, dispatchSelections]} />
    }

    if (component === "ChromatinViewport") {
      if (graphicsLibrary) {
        if (viewportConfiguration.type != ViewportConfigurationType.Chromatin) {
          return <div></div>;
        }

        return <ChromatinViewport
          graphicsLibrary={graphicsLibrary}
          configurationID={config}
          configurationsReducer={[configurations, dispatchConfigurations]}
          coordinatePreviewReducer={[coordinatePreview, dispatchCoordinatePreview]}
          dataReducer={[data, dispatchData]}
          selectionsReducer={[selections, dispatchSelections]}
        ></ChromatinViewport>
      } else {
        return <div>Graphics not yet loaded</div>
      }
    }

    if (component === "D1Viewport") {
      if (graphicsLibrary) {
        if (viewportConfiguration.type != ViewportConfigurationType.D1) {
          return <div></div>;
        }

        return <D1Viewport
          configurationID={config}
          configuration={viewportConfiguration}
          dataReducer={[data, dispatchData]}
          selectionsReducer={[selections, dispatchSelections]}
        ></D1Viewport>
      } else {
        return <div>Graphics not yet loaded</div>
      }
    }

    if (component === "TADMapViewport") {
      if (graphicsLibrary) {
        if (viewportConfiguration.type != ViewportConfigurationType.TAD) {
          return <div></div>;
        }

        return <TADViewport
          graphicsLibrary={graphicsLibrary}
          configurationID={config}
          configurationsReducer={[configurations, dispatchConfigurations]}
          dataReducer={[data, dispatchData]}
          selectionsReducer={[selections, dispatchSelections]}
        ></TADViewport>
      } else {
        return <div>Graphics not yet loaded</div>
      }
    }
  }

  const addChromatinViewport = () => {
    // dispatch(configurationsSlice.actions.add(defaultChromatinViewportConfiguration()));
    dispatchConfigurations({ type: ConfigurationActionKind.ADD, viewportConfiguration: defaultChromatinViewportConfiguration() });

    const nodeToAppend = localModel.getActiveTabset() ?? localModel.getRoot().getChildren()[0];
    localModel.doAction(
      FlexLayout.Actions.addNode(
        {
          "type": "tab",
          "weight": 50,
          "selected": 1,
          "component": "ChromatinViewport",
          config: configurations.maxId + 1,
        },
        nodeToAppend.getId(), FlexLayout.DockLocation.CENTER, -1)
    );
  };

  const addForceGraphViewport = () => {
    dispatchConfigurations({ type: ConfigurationActionKind.ADD, viewportConfiguration: defaultForceGraphViewportConfiguration() });

    const nodeToAppend = localModel.getActiveTabset() ?? localModel.getRoot().getChildren()[0];
    localModel.doAction(
      FlexLayout.Actions.addNode(
        {
          "type": "tab",
          "weight": 50,
          "selected": 1,
          "component": "ForceGraphViewport",
          config: configurations.maxId + 1,
        },
        nodeToAppend.getId(), FlexLayout.DockLocation.CENTER, -1)
    );

  }

  const addD1Viewport = () => {
    // dispatch(configurationsSlice.actions.add(defaultD1ViewportConfiguration()));

    // const nodeToAppend = localModel.getActiveTabset() ?? localModel.getRoot().getChildren()[0];
    // localModel.doAction(
    //   FlexLayout.Actions.addNode(
    //     {
    //       "type": "tab",
    //       "weight": 50,
    //       "selected": 1,
    //       "component": "D1Viewport",
    //       name: "New viewport",
    //       config: configurations.maxId + 1,
    //     },
    //     nodeToAppend.getId(), FlexLayout.DockLocation.CENTER, -1)
    // );
  };

  const addTADMapViewport = () => {
    dispatchConfigurations({ type: ConfigurationActionKind.ADD, viewportConfiguration: defaultDistanceViewportConfiguration() });

    const nodeToAppend = localModel.getActiveTabset() ?? localModel.getRoot().getChildren()[0];
    localModel.doAction(
      FlexLayout.Actions.addNode(
        {
          "type": "tab",
          "weight": 50,
          "selected": 1,
          "component": "TADMapViewport",
          name: "New viewport",
          config: configurations.maxId + 1,
        },
        nodeToAppend.getId(), FlexLayout.DockLocation.CENTER, -1)
    );
  };
  //#endregion

  const activeTabSet = localModel.getActiveTabset();
  const activeTabSetChildren = activeTabSet != undefined ? activeTabSet.getChildren() : undefined;
  const activeTab = (activeTabSetChildren != undefined && activeTabSetChildren.length > 0 && activeTabSetChildren[0] instanceof FlexLayout.TabNode) ? activeTabSetChildren[0] as FlexLayout.TabNode : undefined;

  return (
    <div className="App">
      <div className="topPanel">
        <TopBar
          onAddXYZData={() => { setNewXYZDataDialogHidden(false) }}
          onAdd1DData={() => { setNewGenomicDataDialogHidden(false) }}
          onAddDistanceData={() => { setNewDistanceDataDialogHidden(false) }}
          onNewChromatinViewport={addChromatinViewport}
          onNewD1Viewport={addD1Viewport}
          onNewTADMapViewport={addTADMapViewport}
          onNewForceGraphViewport={addForceGraphViewport}
          onNewWorkspace={() => setCurrentState(initialState)}
          onSaveState={async () => await saveToBrowser(getCurrentState())}
          onResetState={() => clearBrowser(Object.keys(getCurrentState())
          ).then(() => window.location.reload())
          }
          onFileExport={async () => {
            await saveToFile(getCurrentState())
          }}
          onFileImport={() => {
            setWorkspaceFileImportDialogHidden(false);
          }}
        />
      </div>

      <div className="toolOptionsPanel">
        {activeTab && <>
          <ToolOptions configurationID={activeTab.getConfig()} configurationsReducer={[configurations, dispatchConfigurations]}></ToolOptions>
          <Separator vertical></Separator>
          <CoordinatePreview style={{ padding: "0px 8px" }} coordinatePreviewReducer={[coordinatePreview, dispatchCoordinatePreview]} dataReducer={[data, dispatchData]}
          ></CoordinatePreview>
        </>}
      </div>

      <div className="mainArea">
        {activeTab && <ToolsList configurationID={activeTab.getConfig()} configurationsReducer={[configurations, dispatchConfigurations]}></ToolsList>}
        {!activeTab && <div className="toolsPanel"></div>}

        <FlexLayout.Layout
          model={localModel}
          factory={componentFactory}
          titleFactory={titleFactory}
          onModelChange={updateModel}
          icons={icons} />

        <RightPanel
          model={localModel}
          configurationsReducer={[configurations, dispatchConfigurations]}
          dataReducer={[data, dispatchData]}
          selectionsReducer={[selections, dispatchSelections]}
        ></RightPanel>
      </div>

      <NewXYZDataDialog
        hidden={newXYZDataDialogHidden}
        closeFunction={() => { setNewXYZDataDialogHidden(true) }}
        dataReducer={[data, dispatchData]}
      ></NewXYZDataDialog>
      <ImportWorkspaceDialog
        hidden={workspaceFileImportDialogHidden}
        workspaceFileParser={loadFromFile}
        onClose={() => { setWorkspaceFileImportDialogHidden(true) }}
        onFileImported={setCurrentState}
      />
      <NewGenomicDataDialog
        hidden={newGenomicDataDialogHidden}
        onClose={() => setNewGenomicDataDialogHidden(true)}
        dataReducer={[data, dispatchData]}
      ></NewGenomicDataDialog>
      {/* <New1DDataDialog hidden={new1DDataDialogHidden} closeFunction={() => { setNew1DDataDialogHidden(true) }} ></New1DDataDialog>
      <NewDistanceMatrixDialog hidden={newDistanceDataDialogHidden} closeFunction={() => { setNewDistanceDataDialogHidden(true) }} ></NewDistanceMatrixDialog> */}
    </div>
  );
}

export default App;
