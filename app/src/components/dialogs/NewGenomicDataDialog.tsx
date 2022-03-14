import { ChoiceGroup, ConstrainMode, DefaultButton, DetailsList, DetailsListLayoutMode, Dialog, DialogFooter, Dropdown, IChoiceGroupOption, IColumn, IDropdownOption, PrimaryButton, SelectionMode, TextField } from "@fluentui/react";
import { Dispatch, useState } from "react";
import { TextFile, UploadTextFilesButton } from "../buttons/UploadTextFilesButton";
import { ApplicationState } from "../../modules/storage/state";
import { DataAction, DataActionKind, DataState } from "../../modules/storage/models/data";
import { fromBEDtoSparse1DNumericData, fromBEDtoSparse1DTextData } from "../../modules/coordniatesUtils";
import { CSVDelimiter, parseBED, ParseResultBED } from "../../modules/parsing";
import './Dialogs.scss';


type ColumnState = 'unused' | 'text' | 'numerical';
export function NewGenomicDataDialog(props: {
    hidden: boolean,
    onClose: () => void,
    dataReducer: [DataState, Dispatch<DataAction>]


}) {
    const [data, dispatchData] = props.dataReducer;

    const [file, setFile] = useState<TextFile | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [filePreview, setFilePreview] = useState<boolean>(false)

    const [delimiter, setDelimiter] = useState<CSVDelimiter.Tabulator | CSVDelimiter.Space>(CSVDelimiter.Tabulator);
    const [fileFormat, setFileFormat] = useState<string>('BED')
    const [columnTypes, setColumnTypes] = useState<Record<number, ColumnState>>({});


    let parsedFile: ParseResultBED | null = null;
    let parsedFileColumns: IColumn[] = [];

    const handleColumTypeChange = (colNumber: number, event: React.FormEvent<HTMLDivElement>, item?: IDropdownOption<ColumnState>) => {
        const newColumTypes = { ...columnTypes }
        newColumTypes[colNumber] = item?.data ?? 'unused';
        setColumnTypes(newColumTypes)
    }

    const columnTypeOptions: Array<IDropdownOption<ColumnState>> = [
        { key: 'unused', data: 'unused', text: 'Skip' }, { key: 'text', data: 'text', text: 'Text' }, { key: 'numerical', data: 'numerical', text: 'Signal' }
    ]
    const columnTypeSelector = (colNumber: number) => <div className="genomic-data-dialog-selectable-header"> {colNumber} <Dropdown
        selectedKey={columnTypes[colNumber] ?? 'unused'}
        options={columnTypeOptions}
        style={
            { display: "inline-block" }
        }
        onChange={(e, i) => handleColumTypeChange(colNumber, e, i)}
    /></div>


    if (file != null) {
        parsedFile = parseBED(file.content, delimiter)
        if (parsedFile.length == 0) {
            parsedFileColumns = [];
        } else {
            parsedFileColumns = [
                { key: 'chomosome', name: 'chrom', fieldName: 'chrom', minWidth: 0 },
                { key: 'from', name: 'from', fieldName: 'from', minWidth: 0 },
                { key: 'to', name: 'to', fieldName: 'to', minWidth: 0 },
                // { key: '4', name: '4', fieldName: '4', minWidth: 0 },

                ...Object.keys(parsedFile[0].attributes).slice(3).map(k => ({
                    key: `${k}`,
                    // name: `Column ${k}`,
                    name: columnTypeSelector(Number(k)) as any,
                    fieldName: `${k}`, minWidth: 0
                })),
            ]
        }
    }

    // function renderItemColumn(props) {
    //     return <span>hullo</span>
    // }

    function previewFile(files: Array<TextFile>) {
        const file = files.length >= 1 ? files[0] : null;
        setFile(file);
        setFileName(file?.name ?? "");
        setFilePreview(file ? true : false);
    }


    function onDelimiterChange(ev?: React.FormEvent<HTMLElement | HTMLInputElement> | undefined, option?: IChoiceGroupOption | undefined) {
        setDelimiter(csvDelimiterOptionValues[option?.key ?? 'Tabulator'])
    }

    function onFileFormatChange(ev?: React.FormEvent<HTMLElement | HTMLInputElement> | undefined, option?: IChoiceGroupOption | undefined) {
        setFileFormat(option?.key ?? 'BED')
    }
    function importFile() {
        if (!file) {
            console.warn("No file selected");
            return;
        }

        const parsedBed = parseBED(file.content, delimiter)

        dispatchData({
            type: DataActionKind.ADD_DATA,
            data: {
                name: `${file.name}`,
                type: 'bed-annotation',
                values: parsedBed,
            }
        });
        if (fileFormat == "BED") {
            for (const [column, type] of Object.entries(columnTypes)) {
                if (type == 'numerical') {
                    dispatchData({
                        type: DataActionKind.ADD_DATA,
                        data: {
                            name: `${file.name} - Signal #${column}`,
                            type: 'sparse-1d-data-numerical',
                            values: fromBEDtoSparse1DNumericData(parsedBed, Number(column))
                        }
                    });

                }
                if (type == 'text') {
                    dispatchData({
                        type: DataActionKind.ADD_DATA,
                        data: {
                            name: `${file.name} - Text #${column}`,
                            type: 'sparse-1d-data-text',
                            values: fromBEDtoSparse1DTextData(parsedBed, Number(column)),
                        }
                    });
                }
            }
        }
        closeDialog();
    }

    function closeDialog() {
        props.onClose();
    }


    const csvDelimiterOptionValues: Record<string, CSVDelimiter.Tabulator | CSVDelimiter.Space> = {
        'Tabulator': CSVDelimiter.Tabulator,
        'Space': CSVDelimiter.Space
    }

    const csvDelimiterOptions: IChoiceGroupOption[] = [
        { key: 'Tabulator', text: 'Tabulator' },
        { key: 'Space', text: 'Space' },
    ];

    const fileFormetOptions: IChoiceGroupOption[] = [
        { key: 'BED', text: 'BED' },
        { key: 'GFF3', text: 'GFF3 (todo)' },
    ];

    return (
        <Dialog hidden={props.hidden} maxWidth="2048" minWidth="1280">
            <form>
                <UploadTextFilesButton
                    displayAs={PrimaryButton}
                    text="Select File"
                    // accept=".bed,.gff,.txt,.tsv"
                    accept=".bed,.txt,.tsv"
                    onFilesSelected={previewFile}
                />
                <ChoiceGroup defaultSelectedKey="Tabulator" options={csvDelimiterOptions} label="Delimiter" required={true} onChange={onDelimiterChange} />
                {/* <ChoiceGroup defaultSelectedKey="BED" options={fileFormetOptions} label="File Format" required={true} onChange={onFileFormatChange} /> */}
            </form>

            {fileFormat == 'BED' && parsedFile != null && <DetailsList
                items={parsedFile.slice(0, 10)}
                columns={parsedFileColumns}
                layoutMode={DetailsListLayoutMode.justified}
                constrainMode={ConstrainMode.horizontalConstrained}
                selectionMode={SelectionMode.none}

            />}

            <p>
                Selected file: {fileName}
            </p>
            <DialogFooter>
                <PrimaryButton text="Add" onClick={importFile} />
                <DefaultButton text="Cancel" onClick={closeDialog} />
            </DialogFooter>
        </Dialog>
    )
}