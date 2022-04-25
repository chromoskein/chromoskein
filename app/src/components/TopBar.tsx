import { CommandBar, ICommandBarItemProps, IContextualMenuItem, ThemeProvider } from '@fluentui/react';

type menuCallback = (ev?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>, item?: IContextualMenuItem) => any;

export function TopBar(props: {
    onAddXYZData: menuCallback,
    onAdd1DData: menuCallback,
    onAddDistanceData: menuCallback,
    onNewChromatinViewport: menuCallback,
    onNewD1Viewport: menuCallback,
    onNewTADMapViewport: menuCallback,
    onNewForceGraphViewport: menuCallback,
    onSaveState: menuCallback,
    onResetState: menuCallback,
    onFileExport: menuCallback,
    onFileImport: menuCallback,
    onExemplaryWorkspace: menuCallback,
}) {
    const items: ICommandBarItemProps[] = [
        {
            key: 'workSpace',
            text: 'Workspace',
            subMenuProps: {
                items: [
                    {
                        key: 'save',
                        text: 'Save in browser',
                        iconProps: { iconName: 'Save' },
                        onClick: props.onSaveState,
                    },
                    {
                        key: 'reset',
                        text: 'Remove browser data',
                        iconProps: { iconName: '' },
                        onClick: props.onResetState
                    },
                    {
                        key: 'export',
                        text: 'Export to file',
                        iconProps: { iconName: 'Export' },
                        onClick: props.onFileExport

                    },
                    {
                        key: 'import',
                        text: 'Import from file',
                        iconProps: { iconName: 'Import' },
                        onClick: props.onFileImport
                    },
                    {
                        key: 'exemplary-workspace',
                        text: 'Open exemplary workspace',
                        iconProps: { iconName: 'OpenFolderHorizontal' },
                        onClick: props.onExemplaryWorkspace
                    }
                ],
            },
        },
        {
            key: 'newItem',
            text: 'New Viewport',
            iconProps: { iconName: 'Add' },
            subMenuProps: {
                items: [
                    {
                        key: 'chromatin',
                        text: 'Chromatin',
                        onClick: props.onNewChromatinViewport
                    },
                    {
                        key: 'force-graph',
                        text: 'Force Graph',
                        onClick: props.onNewForceGraphViewport
                    },
                    // {
                    //     key: '1d-data',
                    //     text: '1D Data',
                    //     onClick: props.onNewD1Viewport,
                    // },
                    {
                        key: 'tad',
                        text: 'Distance Map',
                        onClick: props.onNewTADMapViewport,
                    },
                    {
                        key: 'table',
                        text: 'Table',
                    },
                ],
            },
        },
        {
            key: 'addData',
            text: 'Add Data',
            iconProps: { iconName: 'Add' },
            subMenuProps: {
                items: [
                    {
                        key: 'XYZ',
                        text: '3D Positions',
                        onClick: props.onAddXYZData
                    },
                    {
                        key: 'D1',
                        text: '1D Data',
                        onClick: props.onAdd1DData
                    },
                    // {
                    //     key: 'DistanceMatrix',
                    //     text: 'Distane Matrix',
                    //     onClick: props.onAddDistanceData
                    // },
                ],
            },
        },

    ];

    return (
        <div>
            <CommandBar
                items={items}
            />
        </div>
    );
}

export default TopBar;
