import { ChoiceGroup, DefaultButton, Dialog, DialogFooter, IChoiceGroupOption, PrimaryButton, TextField } from "@fluentui/react";
import { Dispatch, useState } from "react";
import { TextFile, UploadTextFilesButton } from "../buttons/UploadTextFilesButton";
import { ApplicationState } from "../../modules/storage/state";
import { DataAction, DataActionKind, DataState } from "../../modules/storage/models/data";
import { fromBEDtoSparse1DNumericData, fromBEDtoSparse1DTextData } from "../../modules/1d_data_utils";
import { CSVDelimiter, parseBED } from "../../modules/parsing";

export function NewGenomicDataDialog(props: {
    hidden: boolean,
    onClose: () => void,
    dataReducer: [DataState, Dispatch<DataAction>]


}) {
    const [data, dispatchData] = props.dataReducer;

    const [file, setFile] = useState<TextFile | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [filePreview, setFilePreview] = useState<string>("")

    const [delimiter, setDelimiter] = useState<CSVDelimiter.Tabulator | CSVDelimiter.Space>(CSVDelimiter.Tabulator);
    const [fileFormat, setFileFormat] = useState<string>('BED')
    const [numericalBedDataColumns, setNumericalBedDataColumns] = useState<Array<number>>([])
    const [textBedDataColumns, setTextBedDataColumns] = useState<Array<number>>([])



    function previewFile(files: Array<TextFile>) {
        const file = files[0]
        setFile(file);
        setFileName(file.name);
        setFilePreview(file.content.substring(0, file.content.indexOf("\n")).substring(0, 100))
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
                type: 'sparse-1d-data-numerical',
                values: parsedBed,
            }
        });
        if (fileFormat == "BED") {
            for (const col of numericalBedDataColumns) {
                dispatchData({
                    type: DataActionKind.ADD_DATA,

                    data: {
                        name: `${file.name} - Col #${col}`,
                        type: 'sparse-1d-data-numerical',
                        values: fromBEDtoSparse1DNumericData(parsedBed, col)
                    }
                });


            }

            for (const col of textBedDataColumns) {
                dispatchData({
                    type: DataActionKind.ADD_DATA,

                    data: {
                        name: `${file.name} - Col #${col}`,
                        type: 'sparse-1d-data-numerical',
                        values: fromBEDtoSparse1DTextData(parsedBed, col),
                    }
                });
            }
        }




        closeDialog();
    }

    function closeDialog() {
        props.onClose();
    }

    function setDataColumns(list: string, setter: Dispatch<React.SetStateAction<number[]>>) {
        const columnList = list.split(",").map(n => n.trim()).map(n => parseInt(n)).filter(n => !isNaN(n));
        setter(columnList);
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
                    text="Select Workspace File"
                    accept=".bed,.gff,.txt,.tsv"
                    onFilesSelected={previewFile}
                />
                <ChoiceGroup defaultSelectedKey="Tabulator" options={csvDelimiterOptions} label="Delimiter" required={true} onChange={onDelimiterChange} />
                <ChoiceGroup defaultSelectedKey="BED" options={fileFormetOptions} label="File Format" required={true} onChange={onFileFormatChange} />
                //todo :)
                numericalBedDataColumns: <TextField onChange={(e, columns) => setDataColumns(columns ?? "", setNumericalBedDataColumns)} />
                textBedDataColumns: <TextField onChange={(e, columns) => setDataColumns(columns ?? "", setTextBedDataColumns)} />
            </form>
            <p>
                Selected file: {fileName}
            </p>
            <p>
                File preview: {filePreview}...
            </p>
            <DialogFooter>
                <PrimaryButton text="Add" onClick={importFile} />
                <DefaultButton text="Cancel" onClick={closeDialog} />
            </DialogFooter>
        </Dialog>
    )
}