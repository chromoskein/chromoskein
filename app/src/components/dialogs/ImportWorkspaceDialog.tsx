import { DefaultButton, DetailsList, Dialog, DialogFooter, PrimaryButton } from "@fluentui/react";
import { useState } from "react";
import { TextFile, UploadTextFilesButton } from "../buttons/UploadTextFilesButton";
import { ApplicationState } from "../../modules/storage/state";

export function ImportWorkspaceDialog(props: {
    hidden: boolean,
    workspaceFileParser: (file: TextFile) => ApplicationState
    onClose: () => any,
    onFileImported: (state: ApplicationState) => any
}) {

    const [file, setFile] = useState<TextFile | null>(null);
    const [fileName, setFileName] = useState("");
    function previewFile(files: Array<TextFile>) {
        const file = files[0]
        setFile(file);
        setFileName(file.name);
    }

    function importFile() {
        if (!file) {
            console.warn("No file selected");
            return;
        }
        const content: ApplicationState = props.workspaceFileParser(file);
        props.onFileImported(content);
        closeDialog();
    }

    function closeDialog() {
        props.onClose();
    }

    return (
        <Dialog hidden={props.hidden} minWidth="350px">
            <form>
                <UploadTextFilesButton
                    displayAs={PrimaryButton}
                    text="Select Workspace File"
                    accept=".chromazoom"
                    onFilesSelected={previewFile}
                />
            </form>
            Selected file: {fileName}
            <DialogFooter>
                <PrimaryButton text="Import" onClick={importFile} />
                <DefaultButton text="Cancel" onClick={closeDialog} />
            </DialogFooter>
        </Dialog>
    )
}