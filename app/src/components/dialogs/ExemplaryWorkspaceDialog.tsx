import { DefaultButton, DetailsList, Dialog, DialogFooter, PrimaryButton, Text } from "@fluentui/react";
import { useState } from "react";
import { TextFile, UploadTextFilesButton } from "../buttons/UploadTextFilesButton";
import { ApplicationState } from "../../modules/storage/state";
import exemplaryWorkspace from '../../exemplaryWorkspace.chromoskein';


export function ExemplaryWorkspaceDialog(props: {
    hidden: boolean,
    workspaceJsonParser: (content: string) => ApplicationState
    onClose: () => any,
    onFileImported: (state: ApplicationState) => any
}) {


    function importFile() {
        const content: ApplicationState = props.workspaceJsonParser(exemplaryWorkspace);
        props.onFileImported(content);
        closeDialog();
    }

    function closeDialog() {
        props.onClose();
    }

    return (
        <Dialog hidden={props.hidden} minWidth="500px">
            <Text>
                This exemplary workspace exists to showcase some of the features of the application. <br /> It uses 3D structure data of the house mouse <em>Mus musculus</em> from (Stevens, 2017), accessible as GSE80280 from Gene Expression Omnibus. For gene density data, the basic gene annotation dataset released in GENCODE 2021 (Frankish, 2021) is used, accessible on https://www.gencodegenes.org/mouse/release_M29.html.
            </Text>
            <div style={{ marginTop: "10px" }} />
            <ul>
                <li>Stevens, Tim J et al. “3D structures of individual mammalian genomes studied by single-cell Hi-C.” <em>Nature</em> vol. 544,7648 (2017): 59-64. doi:10.1038/nature21429</li>
                <li>Frankish, Adam et al. “GENCODE 2021.” <em>Nucleic acids research</em> vol. 49,D1 (2021): D916-D923. doi:10.1093/nar/gkaa1087</li>
            </ul>
            <DialogFooter>
                <PrimaryButton text="Import" onClick={importFile} />
            </DialogFooter>
        </Dialog>
    )
}