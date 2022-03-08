import React, { useRef } from "react";


export type TextFile = { name: string, content: string };
export function UploadTextFilesButton(
    props: {
        displayAs: typeof React.Component,
        onFilesSelected: (files: Array<TextFile>) => any,
        text?: string
        accept?: string
        multiple?: boolean
    }
) {

    const inputFileElement = useRef<HTMLInputElement>(null);

    async function readFile(file: File): Promise<TextFile> {
        return new Promise((resolve, reject) => {
            var fr = new FileReader();
            fr.onload = () => {
                resolve({
                    name: file.name,
                    content: fr.result as string
                } as TextFile)
            };
            fr.onerror = reject;
            fr.readAsText(file);
        });
    }

    async function onFilesChanged() {
        if (!inputFileElement.current?.files) {
            return;
        }
        const currentFiles: FileList = inputFileElement.current?.files;
        const fileReadingPromises: Array<Promise<TextFile>> = [];
        for (let i = 0; i < currentFiles.length; i++) {
            fileReadingPromises.push(readFile(currentFiles[i]))
        }
        const parsedFiles = await Promise.all(fileReadingPromises)
        props.onFilesSelected(parsedFiles);

    }

    function handleClick() {
        inputFileElement.current?.click();
    }


    return <>
        <props.displayAs text={props.text ?? "Select File(s)"} onClick={handleClick} />
        <input
            type="file"
            ref={inputFileElement}
            onChange={onFilesChanged}
            style={{ display: 'none' }}
            accept={props.accept ?? "*"}
            multiple={props.multiple ?? true}
        />
    </>
}