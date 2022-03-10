import { Checkbox, ChoiceGroup, ConstrainMode, DefaultButton, DetailsList, DetailsListLayoutMode, Dialog, DialogFooter, Dropdown, IChoiceGroupOption, IColumn, IDropdownOption, IDropdownStyles, PrimaryButton, SelectionMode, SpinButton, Stack } from '@fluentui/react';
import { vec3 } from 'gl-matrix';
import React, { Dispatch, useEffect, useRef, useState } from 'react';
import { CSVDelimiter, FileState, FileType, ParseResult, parseResultToXYZ, parseToRows, ParseConfiguration, ParseResultCSV, ParseResultPDB } from '../../modules/parsing';
import { DataState, DataAction, DataActionKind, BinPositionsData } from '../../modules/storage/models/data';
import { UploadTextFilesButton } from '../buttons/UploadTextFilesButton';


export function NewXYZDataDialog(props: {
  hidden: boolean,
  closeFunction: () => void,
  dataReducer: [DataState, Dispatch<DataAction>]
}): JSX.Element {
  const [data, dispatchData] = props.dataReducer;

  // Reference to the true input file obscured by a fake one (for styling purposes)
  const inputFileElement = useRef<HTMLInputElement | null>(null);
  // Click on the real input button when the fake one is pressed
  const onFakeUploadButtonClick = () => {
    inputFileElement?.current?.click();
  };

  const [parseState, setParseState] = useState(FileState.NoFile);
  const [files, setFiles] = useState<Array<{ name: string, content: string }>>([]);
  const [parsedFiles, setParsedFiles] = useState<Array<Array<ParseResult>>>([]);

  const [parseConfiguration, setParseConfiguration] = useState<ParseConfiguration>({ type: FileType.PDB });
  const [selectedColumns, setSelectedColumns] = useState<Array<string | number>>([]);
  const [basePairsResolution, setBasePairsResolution] = useState(1000);

  // (Re-)Parse the files when new ones are uploaded or the parse configuration changed
  useEffect(() => {
    setParseState(FileState.Parsing);
    setParsedFiles(() => []);

    for (let i = 0; i < files.length; i++) {
      setParsedFiles(prev => [...prev, parseToRows(files[i].content, parseConfiguration)]);
    }
  }, [files, parseConfiguration]);

  const closeDialog = () => {
    props.closeFunction();
  };

  const acceptFiles = () => {
    if (parsedFiles && parsedFiles.length <= 0) return;
    const parsedFile = parsedFiles[0];

    for (let i = 0; i < parsedFile.length; i++) {
      const parsedResultUntyped: ParseResult = parsedFile[i];

      if (parsedResultUntyped.type == 'CSV') {
        const parsedResult: ParseResultCSV = parsedResultUntyped as ParseResultCSV;

        const values = parseResultToXYZ(parsedResult, selectedColumns);

        dispatchData({
          type: DataActionKind.ADD_DATA,

          data: {
            name: files[0].name + (parsedFile.length > 1 ? "(" + i + ")" : ""),
            type: '3d-positions',
            values: values,
            basePairsResolution: basePairsResolution,
            binOffset: 0,
            normalizeCenter: vec3.create(),
            normalizeScale: 1.0,
          } as BinPositionsData
        });
      } else {
        const parsedResult: ParseResultPDB = parsedResultUntyped as ParseResultPDB;

        dispatchData({
          type: DataActionKind.ADD_DATA,

          data: {
            name: files[0].name + (parsedFile.length > 1 ? "(" + i + ")" : ""),
            type: '3d-positions',
            values: parsedResult.atoms,
            basePairsResolution: basePairsResolution,
            binOffset: 0,
            normalizeCenter: parsedResult.normalizeCenter,
            normalizeScale: parsedResult.normalizeScale,
            chromosomes: parsedResult.ranges,
          } as BinPositionsData
        });
      }
    }

    closeDialog();
  }

  const fileTypeOptions: IChoiceGroupOption[] = [
    { key: 'PDB', text: 'PDB' },
    { key: 'CSV', text: 'CSV' },
  ];

  const onFileTypeChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, option?: IChoiceGroupOption): void => {
    if (!option) {
      return;
    }

    switch (option.key) {
      case "PDB": setParseConfiguration({ type: FileType.PDB }); break;
      case "CSV": setParseConfiguration({ type: FileType.CSV, delimiter: CSVDelimiter.Comma, hasHeader: false }); break;
    }
  }

  const onDelimiterChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, option?: IChoiceGroupOption): void => {
    if (!option) {
      return;
    }

    switch (option.key) {
      case "Comma": setParseConfiguration((prev: ParseConfiguration) => ({ ...prev, delimiter: CSVDelimiter.Comma })); break;
      case "Tabulator": setParseConfiguration((prev: ParseConfiguration) => ({ ...prev, delimiter: CSVDelimiter.Tabulator })); break;
      case "Space": setParseConfiguration((prev: ParseConfiguration) => ({ ...prev, delimiter: CSVDelimiter.Space })); break;
    }
  }

  const onFileHasHeaderChanged = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, isChecked?: boolean) => {
    if (!isChecked) {
      return;
    }

    setParseConfiguration((prev: ParseConfiguration): ParseConfiguration => {
      if (prev.type == FileType.CSV) {
        return { type: FileType.CSV, delimiter: prev.delimiter, hasHeader: isChecked };
      } else {
        return { type: FileType.CSV, delimiter: CSVDelimiter.Comma, hasHeader: false };
      }
    });
  }

  const onBasePairsResolutionChanged = (_event: React.SyntheticEvent<HTMLElement>, newValue?: string): void => {
    if (newValue) {
      setBasePairsResolution(parseInt(newValue));
    }
  }

  const csvDelimiterOptions: IChoiceGroupOption[] = [
    { key: 'Comma', text: 'Comma' },
    { key: 'Tabulator', text: 'Tabulator' },
    { key: 'Space', text: 'Space' },
  ];

  const dropdownStyles: Partial<IDropdownStyles> = {
    dropdown: { width: 150 },
  };

  let dropdownOptions: IDropdownOption[] = [];
  if (parsedFiles && parsedFiles.at(0)) {
    const parsedFile: ParseResult = parsedFiles[0][0];

    if (parsedFile.type == 'CSV') {
      dropdownOptions = parsedFile.columns.map(v => { return { key: String(v), text: String(v) }; });
    } else if (parsedFile.type == 'PDB') {
      dropdownOptions = [
        { key: 'x', text: 'x' },
        { key: 'y', text: 'y' },
        { key: 'z', text: 'z' }
      ];
    }
  }

  const xyzDropdowns =
    <div>
      <Dropdown
        placeholder="Select a column"
        label="Column of X coordinate"
        options={dropdownOptions}
        styles={dropdownStyles}
        onChange={
          (_e, option) => setSelectedColumns((prev: Array<string | number>) => { if (option) prev[0] = option.key; return prev; })
        }

      />
      <Dropdown
        placeholder="Select a column"
        label="Column of Y coordinate"
        options={dropdownOptions}
        styles={dropdownStyles}
        onChange={
          (_e, option) => setSelectedColumns((prev: Array<string | number>) => { if (option) prev[1] = option.key; return prev; })
        }
      />
      <Dropdown
        placeholder="Select a column"
        label="Column of Z coordinate"
        options={dropdownOptions}
        styles={dropdownStyles}
        onChange={
          (_e, option) => setSelectedColumns((prev: Array<string | number>) => { if (option) prev[2] = option.key; return prev; })
        }
      />
    </div>;

  return (
    <Dialog hidden={props.hidden} maxWidth="2048" minWidth="1280">
      <form>
        <Stack horizontal tokens={{ childrenGap: 10 }}>
          <Stack tokens={{ childrenGap: 10 }}>
            <UploadTextFilesButton
              text="Upload"
              accept={".csv,.pdb,.xyz"}
              displayAs={PrimaryButton}
              onFilesSelected={setFiles}
            />
            {/* <div>{selectedFile ? selectedFile : "No file uploaded yet."}</div> */}
            {/* <div>State: {fileStateToText(fileparseState)}</div> */}
            <ChoiceGroup defaultSelectedKey="PDB" options={fileTypeOptions} label="Type of file" required={true} onChange={onFileTypeChange} />
            {parseConfiguration.type === FileType.CSV &&
              <Checkbox label="Has header" onChange={onFileHasHeaderChanged} />
            }
            {parseConfiguration.type === FileType.CSV &&
              <ChoiceGroup defaultSelectedKey="Comma" options={csvDelimiterOptions} label="CSV delimiter" required={true} onChange={onDelimiterChange} />
            }
            {parseConfiguration.type === FileType.CSV &&
              xyzDropdowns
            }
            <SpinButton
              label="Base pairs resolution"
              defaultValue={`${basePairsResolution}`}
              min={0}
              max={1000000}
              step={1000}
              incrementButtonAriaLabel="Increase value by 1000"
              decrementButtonAriaLabel="Decrease value by 1000"
              onChange={onBasePairsResolutionChanged}
            />
          </Stack>
          <div style={{ width: 480 }}>
            {parsedFiles && parsedFiles[0] && parsedFiles[0][0].type == "CSV" && (
              <DetailsList
                items={parsedFiles[0][0].rows.slice(0, 10)}
                columns={parsedFiles[0][0].columns.map((v, index) => { return { key: String(index), name: String(v), fieldName: String(v), minWidth: 75, maxWidth: 300, isResizable: true }; })}
                layoutMode={DetailsListLayoutMode.justified}
                constrainMode={ConstrainMode.horizontalConstrained}
                selectionMode={SelectionMode.none}
              />
            )}
            {parsedFiles && parsedFiles[0] && parsedFiles[0][0].type == "PDB" && (
              <DetailsList
                items={parsedFiles[0][0].atoms.slice(0, 10)}
                columns={[
                  { key: 'x', name: 'x', fieldName: 'x' } as IColumn,
                  { key: 'y', name: 'y', fieldName: 'y' } as IColumn,
                  { key: 'z', name: 'z', fieldName: 'z' } as IColumn
                ]}
                layoutMode={DetailsListLayoutMode.justified}
                constrainMode={ConstrainMode.horizontalConstrained}
                selectionMode={SelectionMode.none}
              />
            )}
          </div>
        </Stack>
      </form>
      <DialogFooter>
        <PrimaryButton text="Add" onClick={acceptFiles} />
        <DefaultButton text="Cancel" onClick={closeDialog} />
      </DialogFooter>
    </Dialog>
  );
}

export default NewXYZDataDialog;
