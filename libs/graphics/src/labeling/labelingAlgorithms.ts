import { randomUniform } from "d3";
import { GraphicsLibrary } from "..";
import { Selection, isoSelectionID } from "../../storage/models/selections";
import { ChromatinViewport } from "../viewports";
import { Label } from "./label";


const DOWNSCALED_TEX_SIZE = 512;
const timestepIndices = {
    contours_Start: 0,
    contours_End: 1,
    dt_Start: 2,
    dt_End: 3,
    maxDt_Start: 4,
    maxDt_End: 5,
}

export async function computeContours(
    globals: {
        graphicsLibrary: GraphicsLibrary, 
        viewport: ChromatinViewport,
        // timestampsQuerySet: GPUQuerySet,
        // timestampsBuffer: GPUBuffer,
        // timestampsResolvedBuffer: GPUBuffer,
    }, 
    inputIDTexture: GPUTexture, 
    outputContoursTexture: GPUTexture) : Promise<void>
    {

        if (!globals.viewport.camera) {
            return;
        }

        debug_clearContoursTexture(globals.graphicsLibrary, outputContoursTexture); //~ just for testing whether the blitting pipeline works fine. it does.

        const device = globals.graphicsLibrary.device;
        const commandEncoder = device.createCommandEncoder();

        // commandEncoder.writeTimestamp(globals.timestampsQuerySet, timestepIndices.contours_Start);

        const computePassEncoder = commandEncoder.beginComputePass();
        

        const cameraBindGroup = device.createBindGroup({
            layout: globals.graphicsLibrary.bindGroupLayouts.camera,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: globals.viewport.camera.bufferGPU,
                        offset: 0,
                    }
                },
            ]
        });

        renderContoursPass(globals.graphicsLibrary, 
            {
            width: globals.viewport.width,
            height: globals.viewport.height,
            cameraBindGroup: cameraBindGroup,
            cameraBGLayout: globals.graphicsLibrary.bindGroupLayouts.camera,
            contoursBindGroup: device.createBindGroup({
                layout: globals.graphicsLibrary.bindGroupLayouts.contours,
                entries: [
                    { binding: 0, resource: inputIDTexture.createView() },
                    { binding: 1, resource: outputContoursTexture.createView() },
                ]
            }),
            passEncoder: computePassEncoder,
        });

        computePassEncoder.end();

        // commandEncoder.writeTimestamp(globals.timestampsQuerySet, timestepIndices.contours_End);

        // commandEncoder.resolveQuerySet(globals.timestampsQuerySet, 0, 3, globals.timestampsBuffer, 0);
        // commandEncoder.copyBufferToBuffer(globals.timestampsBuffer, 0, globals.timestampsResolvedBuffer, 0, 4 * 8);

        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // await readTimestamps(globals.timestampsResolvedBuffer);

    }

export function computeDistanceTransform(globals:
    {
        graphicsLibrary: GraphicsLibrary,
        viewport: ChromatinViewport,
    },
    pingTexture: GPUTexture,
    pongTexture: GPUTexture,
    contoursSeedTex: GPUTexture, distanceTransfromTex: GPUTexture): void {
        // if (!this.graphicsLibrary || !this.pingTexture || !this.pongTexture) return;

        //~ copy contours seed to ping texture
        globals.graphicsLibrary.blit(contoursSeedTex, pingTexture);

        //~ Compute DT steps
        const RES = DOWNSCALED_TEX_SIZE;
        computeDTStep(globals, pingTexture, pongTexture, RES / 2.0);
        computeDTStep(globals, pongTexture, pingTexture, RES / 4.0);
        computeDTStep(globals, pingTexture, pongTexture, RES / 8.0);
        computeDTStep(globals, pongTexture, pingTexture, RES / 16.0);
        computeDTStep(globals, pingTexture, pongTexture, RES / 32.0);
        computeDTStep(globals, pongTexture, pingTexture, RES / 64.0);
        computeDTStep(globals, pingTexture, pongTexture, RES / 128.0);
        computeDTStep(globals, pongTexture, pingTexture, RES / 256.0);
        computeDTStep(globals, pingTexture, pongTexture, RES / 512.0);
        // ~ debug
        // this.computeDTStep(this.pongTexture, this.pingTexture, RES / 1024.0);

        //~ copy result to final distance transform texture
        globals.graphicsLibrary.blit(pongTexture, distanceTransfromTex);
        // this.graphicsLibrary.blit(this.pingTexture, distanceTransfromTex);
    }

export async function computeMaxDistanceCPU(globals:
    {
        graphicsLibrary: GraphicsLibrary,
        viewport: ChromatinViewport,
        selections: Selection[],
    },
    dtTexture: GPUTexture, smallIdTexture: GPUTexture): Promise<Label[]> {
    const maxDistTimeStart = performance.now();

    const dtTextureContent = await getTextureAsArray(globals, dtTexture);
    const smallIdTextureContent = await getTextureAsArray(globals, smallIdTexture);

    if (!globals.selections) {
        console.log("No selections!");
        return [];
    }

    type Candidate = {
        x: number,
        y: number,
        dtValue: number,
        regionId: number,
    }
    const candidates = new Array<Candidate>(256);
    //~ init
    for (let c = 0; c < 256; c++) {
        candidates[c] = { x: 0, y: 0, dtValue: 0, regionId: -1 };
    }

    const t = dtTextureContent;
    const tId = smallIdTextureContent;
    const pixelsNum = 512 * 512;
    const valuesNum = 4 * pixelsNum; //~ the array has and index for each vec4 component
    for (let index = 0; index < valuesNum; index += 4) {
        const pixelVal = {
            x: t[index + 0],
            y: t[index + 1],
            z: t[index + 2],
            w: t[index + 3]
        };
        const id = tId[index + 0];
        const currentBest = candidates[id];
        if (!currentBest) continue;
        const i = (index / 4) % 512;
        const j = (index / 4) / 512;
        if (pixelVal.z > currentBest.dtValue) {
            const u = i / 512.0;
            const v = j / 512.0;
            const newBest = { x: u, y: v, dtValue: pixelVal.z, regionId: id };
            candidates[id] = newBest;
        }
    }

    const labels: Label[] = [];
    for (let c = 0; c < 256; c++) {
        const candidate = candidates[c];
        if (candidate.regionId < 0) {
            continue;
        } else {
            const xScreen = candidate.x * (globals.viewport.width / 2.0); //~ the 2 comes here because of window.devicePixelRatio! TODO: make general
            const yScreen = candidate.y * (globals.viewport.height / 2.0);

            const found = globals.selections.find(sel => sel.id == isoSelectionID.wrap(candidate.regionId));
            const labelText = found ? found.name : "<LABEL Error (id: " + candidate.regionId + ")>";
            const labelColor = found ? found.color : { r: 0, g: 0, b: 0, a: 0 };

            const lbl = {
                x: xScreen,
                y: yScreen,
                id: candidate.regionId,
                text: labelText,
                color: labelColor,
            }
            labels.push(lbl);
        }
    }
    const maxDistTimeEnd = performance.now();
    console.log("computeMaxDistanceCPU took: " + (maxDistTimeEnd - maxDistTimeStart) + " ms");

    return labels;
}

export async function computeMaxDistance_NewUsingAtomics(
    globals:
        {
            graphicsLibrary: GraphicsLibrary,
            viewport: ChromatinViewport,
            selections: Selection[],
        },
    idBuffer: GPUTexture, dtTexture: GPUTexture
): Promise<Label[]> {

    const device = globals.graphicsLibrary.device;

    //~ output buffers
    const resultBufferSize = 256 * 4 * 4; //~ 256 * vec4 = 256 * 4 * sizeof(float) 
    const resultBuffer = device.createBuffer({
        label: "MaxDT: Results buffer",
        size: resultBufferSize,
        // usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const resultStagingBuffer = device.createBuffer({
        label: "MaxDT: Results staging buffer",
        size: resultBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    //TODO: clear results buffer with -1, 0, 0, 0
    {
        // const buffer = new Float32Array(256 * 4);
        const buffer = new Int32Array(256 * 4);
        // const selID = isoSelectionID.unwrap(forSelection.id);
        // const iteration = 0;
        const arr: number[]= [];
        for (let j = 0; j < 256; j++) {
            arr.push(-1);
            arr.push(0);
            arr.push(0);
            arr.push(0);
        }
        // buffer.set([selID, iteration], 0);
        buffer.set(arr, 0);

        device.queue.writeBuffer(
            resultBuffer,
            0,
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
        );
    }

    //~ bind groups
    const inputBuffersBindGroup = device.createBindGroup({
        label: "Max DT: input textures bind group",
        layout: globals.graphicsLibrary.bindGroupLayouts.maxDTInputTextures,
        entries: [
            { binding: 0, resource: idBuffer.createView() },
            { binding: 1, resource: dtTexture.createView() },
        ]
    });
    const outputBufferBindGroup = device.createBindGroup({
        label: "Max DT: output bind group",
        layout: globals.graphicsLibrary.bindGroupLayouts.maxDTOutputBuffer,
        entries: [
            { binding: 0, resource: { buffer: resultBuffer } },
        ]
    });

    const commandEncoder = device.createCommandEncoder();

    //~ dispatch kernel
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(globals.graphicsLibrary.computePipelines.maxDTAtomics);
    passEncoder.setBindGroup(0, inputBuffersBindGroup);
    passEncoder.setBindGroup(1, outputBufferBindGroup);

    //~ invocation size
    const threadsNum = DOWNSCALED_TEX_SIZE * DOWNSCALED_TEX_SIZE; //~ currently 512*512 = 262144
    const threadsPerWorkgroup = 64;
    const workgroupsNum = threadsNum / threadsPerWorkgroup;
    const blockWidth = Math.sqrt(workgroupsNum); //~ defining this in 2D because I need the UVs from thread IDs
    passEncoder.dispatchWorkgroups(blockWidth, blockWidth, 1);

    passEncoder.end();

    //~ copy results to staging buffers
    commandEncoder.copyBufferToBuffer(resultBuffer, 0, resultStagingBuffer, 0, resultBufferSize);
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    //~ reading back the buffer
    // const resultArray = await readGPUBuffer(resultStagingBuffer, resultBufferSize);
    const resultArray = await readGPUBuffer_i32(resultStagingBuffer, resultBufferSize);

    //~ process results buffer
    const labels: Label[] = [];
    const resultsBufferLength = 256; //~ TODO: this length is still a little fucky, because I'm not using vectors in array (due to atomics)
    let i = 0;
    while (i < resultsBufferLength) {
        const regionId = resultArray[i + 0] as number;
        // const x = resultArray[i + 1] as number; //~ DK: this will be 0..511!
        // const y = resultArray[i + 2] as number;
        const x = (resultArray[i + 1] as number) / 512; 
        const y = (resultArray[i + 2] as number) / 512; 
        // const dtValue = resultArray[i + 3] as number;

        i += 4;

        if (regionId == -1) {
            continue;
        }

        const lbl = makeLabel(regionId, x, y);
        if (lbl != null) {
            labels.push(lbl);
        }

    }

    function makeLabel(regionId: number, x: number, y: number): Label | null {
        if (regionId == -1) {
            //~ if for this selection we still find a maximum value pixel with id -1
            //~ this means that there was no pixel with an id we wanted => no label
            return null;
        } else {
            //~ TODO: recalculate to screen/pixel coordinates
            const xScreen = x * (globals.viewport.width / 2.0);
            const yScreen = y * (globals.viewport.height / 2.0);

            const found = globals.selections.find(sel => sel.id == isoSelectionID.wrap(regionId));
            const labelText = found ? found.name : "<LABEL Error (id: " + regionId + ")>";
            const labelColor = found ? found.color : { r: 0, g: 0, b: 0, a: 0 };

            const lbl = {
                x: xScreen,
                y: yScreen,
                id: regionId,
                text: labelText,
                color: labelColor,
            };

            return lbl;
        }
    }

    return labels;
}
export async function computeMaxDistance_New(
    globals:
        {
            graphicsLibrary: GraphicsLibrary,
            viewport: ChromatinViewport,
            selections: Selection[],
        },
    idBuffer: GPUTexture, dtTexture: GPUTexture
): Promise<Label[]> {

    //~ DK: maybe I'll need to actually do this in steps:
    //~ - get a number of selections => IDs that should be found in the ID buffer
    //~ - for each, run a kernel looking for maximum value only under each ID
    if (!globals.selections) {
        console.log("No selections!");
        return [];
    }

    //~ copy textures to buffer (2D -> 1D)
    const dtTexValuesBuffer = transformTextureToBuffer(globals, dtTexture, 512, 512);
    const idTexValuesBuffer = transformTextureToBuffer(globals, idBuffer, 512, 512);

    const labels: Label[] = [];
    //~ for each selection i'm looking for the biggest distance separately in each iteration
    for (const sel of globals.selections) {
        const lbl = await computeLabelPositionWithMaxDistanceGPU(globals, 
                                                                sel, 
                                                                idTexValuesBuffer, 
                                                                dtTexValuesBuffer);
        if (lbl != null) {
            labels.push(lbl);
        }
    }
    
    return labels;
}

function prepareBuffersMaxDTGPU() : void {
 return;
}

export async function computeLabelPositionWithMaxDistanceGPU(
    globals:
        {
            graphicsLibrary: GraphicsLibrary,
            viewport: ChromatinViewport,
            selections: Selection[],
        },
    forSelection: Selection,
    idTexValuesBuffer: GPUBuffer, dtTexValuesBuffer: GPUBuffer): Promise<Label | null> {
    
    //~ bind buffers
    const device = globals.graphicsLibrary.device;
    
    const inputBuffersBindGroup = device.createBindGroup({
        label: "Max DT: input buffers bind group",
        layout: globals.graphicsLibrary.bindGroupLayouts.maxDTInputBuffers,
        entries: [
            { binding: 0, resource: { buffer: dtTexValuesBuffer } },
            { binding: 1, resource: { buffer: idTexValuesBuffer } },
        ]
    })

    if (!globals.viewport || !globals.viewport.camera) return null;
    const parametersBufferGPU = device.createBuffer({
        label: "MaxDT: Parameters buffer",
        size: 2 * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    //~ Upload the selection id parameter:
    {
        const buffer = new Float32Array(2);
        const selID = isoSelectionID.unwrap(forSelection.id);
        const iteration = 0;
        buffer.set([selID, iteration], 0);

        device.queue.writeBuffer(
            parametersBufferGPU,
            0,
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
        );
    }

    const paramsBindGroup = device.createBindGroup({
        label: "MaxDT Parameters Bind Group",
        layout: globals.graphicsLibrary.bindGroupLayouts.maxDTParameters,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: parametersBufferGPU,
                }
            }
        ]
    });

    const resultBufferSize = 4 * 4; //~ just one vec4
    const resultBuffer = device.createBuffer({
        label: "MaxDT: Results buffer",
        size: resultBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const resultIdBufferSize = 4 * 4; //~ just one vec4
    const resultIdBuffer = device.createBuffer({
        label: "MaxDT: Results buffer (IDs)",
        size: resultBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const wholeIdBufferSize = 4 * 4 * 512 * 512;
    const debugIdBufferBefore = device.createBuffer({
        label: "MaxDT: DEBUG before (IDs)",
        size: wholeIdBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const debugIdBufferAfter = device.createBuffer({
        label: "MaxDT: DEBUG after (IDs)",
        size: wholeIdBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const commandEncoder = device.createCommandEncoder();

    //~ debug
    commandEncoder.copyBufferToBuffer(idTexValuesBuffer, 0, debugIdBufferBefore, 0, wholeIdBufferSize);
        
    //~ dispatch kernel
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(globals.graphicsLibrary.computePipelines.maxDT);
    passEncoder.setBindGroup(0, paramsBindGroup);
    passEncoder.setBindGroup(1, inputBuffersBindGroup);

    //~ params
    const selID = isoSelectionID.unwrap(forSelection.id);
    let iteration = 1;
    //~ invocation size
    let threadsNum = DOWNSCALED_TEX_SIZE * DOWNSCALED_TEX_SIZE; //~ currently 512*512 = 262144
    const threadsPerWorkgroup = 64;
    // while (threadsNum >= threadsPerWorkgroup) {
        uploadMaxDistanceKernelParameters(device, parametersBufferGPU, selID, iteration);

        const workgroupsNum = threadsNum / threadsPerWorkgroup;
        const blockWidth = Math.sqrt(workgroupsNum); //~ defining this in 2D because I need the UVs from thread IDs
        passEncoder.dispatchWorkgroups(blockWidth, blockWidth, 1);

        iteration += 1;
        threadsNum = threadsNum / threadsPerWorkgroup; // = workgroupsNum
    // }
    passEncoder.end();

    //~ debug
    commandEncoder.copyBufferToBuffer(idTexValuesBuffer, 0, debugIdBufferAfter, 0, wholeIdBufferSize);

    //~ copy results to staging buffers
    commandEncoder.copyBufferToBuffer(dtTexValuesBuffer, 0, resultBuffer, 0, resultBufferSize);
    commandEncoder.copyBufferToBuffer(idTexValuesBuffer, 0, resultIdBuffer, 0, resultIdBufferSize);
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    //~ reading back the buffer
    const resultDtArray = await readGPUBuffer(resultBuffer, resultBufferSize);
    const resultIdArray = await readGPUBuffer(resultIdBuffer, resultIdBufferSize);

    //~ debug as fuck
    const debugIdArrayBefore = await readGPUBuffer(debugIdBufferBefore, wholeIdBufferSize);
    const debugIdArrayAfter = await readGPUBuffer(debugIdBufferAfter, wholeIdBufferSize);
    // for (let i = 0; i < debugIdArrayBefore.length; i += 4) {
    //     console.log("%.2f %.2f %.2f %.2f", debugIdArrayBefore[i], 
    //     debugIdArrayBefore[i+1], debugIdArrayBefore[i+2], debugIdArrayBefore[i+3] );
    // }
    // console.log(debugIdArrayBefore);
    // console.log(debugIdArrayAfter);


    const regionId = resultIdArray[0] as number;
    const x = resultIdArray[1] as number;
    const y = resultIdArray[2] as number;
    const dtValue = resultDtArray[2] as number;

    if (regionId == -1) {
        //~ if for this selection we still find a maximum value pixel with id -1
        //~ this means that there was no pixel with an id we wanted => no label
        return null;
    } else {
        //~ TODO: recalculate to screen/pixel coordinates
        const xScreen = x * (globals.viewport.width / 2.0);
        const yScreen = y * (globals.viewport.height / 2.0);

        const found = globals.selections.find(sel => sel.id == isoSelectionID.wrap(regionId));
        const labelText = found ? found.name : "<LABEL Error (id: " + regionId + ")>";
        const labelColor = found ? found.color : { r: 0, g: 0, b: 0, a: 0 };

        const lbl = {
            x: xScreen,
            y: yScreen,
            id: regionId,
            text: labelText,
            color: labelColor,
        };

        return lbl;
    }
}

function uploadMaxDistanceKernelParameters(device: GPUDevice, bufferGPU: GPUBuffer, 
                                selectionId: number, iteration: number): void {
        const buffer = new Float32Array(2);
        buffer.set([selectionId, iteration], 0);

        device.queue.writeBuffer(
            bufferGPU,
            0,
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
        );
    }

async function readGPUBuffer(buffer: GPUBuffer, size: number): Promise<Float32Array> {
    await buffer.mapAsync(GPUMapMode.READ, 0, size);
    const copyArrayBuffer = buffer.getMappedRange(0, size);
    const data = copyArrayBuffer.slice(0);
    buffer.unmap();
    const dataArray = new Float32Array(data);
    return dataArray;
}

async function readGPUBuffer_i32(buffer: GPUBuffer, size: number): Promise<Int32Array> {
    await buffer.mapAsync(GPUMapMode.READ, 0, size);
    const copyArrayBuffer = buffer.getMappedRange(0, size);
    const data = copyArrayBuffer.slice(0);
    buffer.unmap();
    const dataArray = new Int32Array(data);
    return dataArray;
}

// export async function computeMaxDistance(globals:
//     {
//         graphicsLibrary: GraphicsLibrary,
//         viewport: ChromatinViewport,
//     },
//     idBuffer: GPUTexture, dtTexture: GPUTexture): Promise<Label[]> {
//     if (!globals.graphicsLibrary) return [];

//     const device = globals.graphicsLibrary.device;
//     const commandEncoder = device.createCommandEncoder();
//     const passEncoder = commandEncoder.beginComputePass();

//     // if (!this.viewport) return [];
//     // const idBuffer = this.viewport.getIDBuffer();
//     // if (!idBuffer) return [];

//     // if (!this.distanceTransformTexture) return [];
//     const inputTexturesBindGroup = device.createBindGroup({
//         label: "Max DT: input textures bind group",
//         layout: globals.graphicsLibrary.bindGroupLayouts.maxDTInputTextures,
//         entries: [
//             { binding: 0, resource: idBuffer.createView() },
//             { binding: 1, resource: dtTexture.createView() },
//         ]
//     })

//     if (!globals.viewport || !globals.viewport.camera) return [];
//     const cameraBindGroup = device.createBindGroup({
//         label: "Camera bind group",
//         layout: globals.graphicsLibrary.bindGroupLayouts.camera,
//         entries: [
//             {
//                 binding: 0,
//                 resource: {
//                     buffer: globals.viewport.camera.bufferGPU,
//                     offset: 0,
//                 }
//             },
//         ]
//     });

//     //~ generating initial buffer:
//     const MAX_LABELS = 256;
//     const BUFFER_SIZE = MAX_LABELS * 4 * 4;
//     const labelCandidates = new Float32Array(new ArrayBuffer(BUFFER_SIZE));
//     for (let i = 0; i < MAX_LABELS; i++) {
//         labelCandidates[i * 4 + 0] = -1; // regionId (i32)
//         // labelCandidates[i * 4 + 1] = 1.0; // dtValue (f32)
//         labelCandidates[i * 4 + 1] = 0.0; // dtValue (f32)
//         labelCandidates[i * 4 + 2] = 0; // uvPosition.x (vec2<f32>)
//         labelCandidates[i * 4 + 3] = 0; // uvPosition.y (vec2<f32>)
//     }

//     const labelsBufferGPU = device.createBuffer({
//         size: BUFFER_SIZE,
//         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
//     });

//     const stagingBuffer = device.createBuffer({
//         size: BUFFER_SIZE,
//         usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
//     });

//     const candidatesBufferBindGroup = device.createBindGroup({
//         layout: globals.graphicsLibrary.bindGroupLayouts.maxDTCandidatesBuffer,
//         entries: [{
//             binding: 0,
//             resource: {
//                 buffer: labelsBufferGPU,
//             },
//         }],
//     });

//     device.queue.writeBuffer(labelsBufferGPU, 0, labelCandidates);

//     passEncoder.setPipeline(globals.graphicsLibrary.computePipelines.maxDT);
//     passEncoder.setBindGroup(0, cameraBindGroup);
//     passEncoder.setBindGroup(1, inputTexturesBindGroup);
//     passEncoder.setBindGroup(2, candidatesBufferBindGroup);

//     // console.log("DT: dispatching workgroups!");
//     passEncoder.dispatchWorkgroups(
//         DOWNSCALED_TEX_SIZE / 8,
//         DOWNSCALED_TEX_SIZE / 8,
//         1);

//     passEncoder.end();
//     commandEncoder.copyBufferToBuffer(labelsBufferGPU, 0, stagingBuffer, 0, BUFFER_SIZE);
//     const commandBuffer = commandEncoder.finish();
//     device.queue.submit([commandBuffer]);

//     //~ reading back the buffer
//     await stagingBuffer.mapAsync(GPUMapMode.READ, 0, BUFFER_SIZE);
//     const copyArrayBuffer = stagingBuffer.getMappedRange(0, BUFFER_SIZE);
//     const data = copyArrayBuffer.slice(0);
//     stagingBuffer.unmap();
//     // console.log(new Float32Array(data));
//     const dataArray = new Float32Array(data);
//     // console.log(dataArray);

//     // labelCandidates[i * 4 + 0] = -1; // regionId (i32)
//     // labelCandidates[i * 4 + 1] = 0; // dtValue (f32)
//     // labelCandidates[i * 4 + 2] = 0; // uvPosition.x (vec2<f32>)
//     // labelCandidates[i * 4 + 3] = 0; // uvPosition.y (vec2<f32>)

//     const labels: Label[] = [];
//     for (let i = 0; i < MAX_LABELS; i++) {
//         // console.log(i);
//         const regionId = dataArray[i * 4 + 0] as number;
//         const dtValue = dataArray[i * 4 + 1] as number;
//         const x = dataArray[i * 4 + 2] as number;
//         const y = dataArray[i * 4 + 3] as number;
//         //~ TODO: recalculate to screen/pixel coordinates
//         const xScreen = x * (globals.viewport.width / 2.0);
//         const yScreen = y * (globals.viewport.height / 2.0);
//         const lbl = {
//             x: xScreen,
//             y: yScreen,
//             id: regionId,
//             text: "Label test",
//             color: {r: 0, g: 0, b: 0, a: 0},
//         };
//         // console.log(lbl);

//         if (lbl.id == -1) {
//             // break;
//         } else {
//             labels.push(lbl);
//             console.log("regionId: %d, uvPosition: (%f, %f), dtValue: %f", regionId, x, y, dtValue);
//         }
//     }
//     console.log("Labels:");
//     // console.log(labels);

//     return labels;
// }

async function readTimestamps(resolvedTimestampsBuffer: GPUBuffer) {
    await resolvedTimestampsBuffer.mapAsync(GPUMapMode.READ);
    const timestamps = resolvedTimestampsBuffer.getMappedRange();
    const timestampsDataView = new DataView(new Uint8Array(timestamps).buffer);

    const left = timestampsDataView.getUint32(0, true);
    const right = timestampsDataView.getUint32(4, true);
    const combined = left + 2 ** 32 * right;
    const left2 = timestampsDataView.getUint32(8, true);
    const right2 = timestampsDataView.getUint32(12, true);
    const combined2 = left2 + 2 ** 32 * right2;
    const left3 = timestampsDataView.getUint32(16, true);
    const right3 = timestampsDataView.getUint32(20, true);
    const combined3 = left3 + 2 ** 32 * right3;

    resolvedTimestampsBuffer.unmap();
    console.log((combined2 - combined) / 1000000.0, (combined3 - combined2) / 1000000.0);
}

async function getTextureAsArray(globals:
    {
        graphicsLibrary: GraphicsLibrary,
        viewport: ChromatinViewport,
    },
    texture: GPUTexture): Promise<Float32Array> {
        // const empty = new Float32Array(0);
        // if (!this.graphicsLibrary) return empty; 

        const device = globals.graphicsLibrary.device;
        const commandEncoder = device.createCommandEncoder();

        const texWidth = 512;
        const texHeight = 512;

        const BUFFER_SIZE = texWidth * texHeight * 4 * 4;
        const stagingBuffer = device.createBuffer({
            size: BUFFER_SIZE,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        commandEncoder.copyTextureToBuffer(
            { texture }, 
            { buffer: stagingBuffer, bytesPerRow: texWidth * 4 * 4 }, 
            [ texWidth, texHeight ]);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        //~ reading back the buffer
        await stagingBuffer.mapAsync(GPUMapMode.READ, 0, BUFFER_SIZE);
        const copyArrayBuffer = stagingBuffer.getMappedRange(0, BUFFER_SIZE);
        const data = copyArrayBuffer.slice(0);
        stagingBuffer.unmap();
        // console.log("~~~ DT Texture dump: ~~~")
        // console.log(new Float32Array(data));
        const dataArray = new Float32Array(data);

        //~ dealloc
        stagingBuffer.destroy();

        return dataArray;
    }

function transformTextureToBuffer(
    globals:
        {
            graphicsLibrary: GraphicsLibrary,
            viewport: ChromatinViewport,
        },
    source: GPUTexture, width: number, height: number) : GPUBuffer
{
    const device = globals.graphicsLibrary.device;
    const commandEncoder = device.createCommandEncoder();

    const BUFFER_SIZE = width * height * 4 * 4;
    const texBuffer = device.createBuffer({
        size: BUFFER_SIZE,
        // usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });

    commandEncoder.copyTextureToBuffer(
        { texture: source },
        { buffer: texBuffer, bytesPerRow: width * 4 * 4 },
        [width, height]);
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    return texBuffer;
}

function renderContoursPass(
    graphicsLibrary: GraphicsLibrary,
    parameters: {
        width: number,
        height: number,
        cameraBindGroup: GPUBindGroup,
        cameraBGLayout: GPUBindGroupLayout,
        contoursBindGroup: GPUBindGroup,
        passEncoder: GPUComputePassEncoder,
    }): void {
        // if (!graphicsLibrary) return;

        parameters.passEncoder.setPipeline(graphicsLibrary.computePipelines.contours);
        parameters.passEncoder.setBindGroup(0, parameters.cameraBindGroup);
        parameters.passEncoder.setBindGroup(1, parameters.contoursBindGroup);

        parameters.passEncoder.dispatchWorkgroups(
            Math.ceil((parameters.width + 7) / 8),
            Math.ceil((parameters.height + 7) / 8),
            1);
    }

function computeDTStep(
    globals: {
        graphicsLibrary: GraphicsLibrary, 
        viewport: ChromatinViewport
    },
    inputTex: GPUTexture, outputTex: GPUTexture, stepSize: number): void {
        //~ todo
        // if (!this.graphicsLibrary) return; 

        const device = globals.graphicsLibrary.device;

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        const contoursBindGroup = device.createBindGroup({
            layout: globals.graphicsLibrary.bindGroupLayouts.contours,
            entries: [
                { binding: 0, resource: inputTex.createView() },
                { binding: 1, resource: outputTex.createView() },
                // { binding: 0, resource: idBuffer.createView() },
                // { binding: 1, resource: this.contoursTexture.createView() },
            ]
        })

        if (!globals.viewport || !globals.viewport.camera) return;
        const cameraBindGroup = device.createBindGroup({
            layout: globals.graphicsLibrary.bindGroupLayouts.camera,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: globals.viewport.camera.bufferGPU,
                        offset: 0,
                    }
                },
            ]
        });

        // console.log("stepSize = " + stepSize);
        const stepParams = {
            stepSize: stepSize, //~ do I need to somehow convert so that it's compatible with f32 in wgsl?
            widthScale: globals.viewport.width / DOWNSCALED_TEX_SIZE,
            heightScale: globals.viewport.height / DOWNSCALED_TEX_SIZE,
        };
        
          const stepParamBufferSize = 3 * Float32Array.BYTES_PER_ELEMENT;
          const stepParamBuffer = device.createBuffer({
            size: stepParamBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          });

        device.queue.writeBuffer(
            stepParamBuffer,
            0,
            new Float32Array([
                stepParams.stepSize,
                stepParams.widthScale,
                stepParams.heightScale,
            ])
        );

        const dtParamsBindGroup = device.createBindGroup({
            layout: globals.graphicsLibrary.bindGroupLayouts.distanceTransformStepParams,
            entries: [
                { binding: 0, resource: {
                    buffer: stepParamBuffer
                } },
            ]
        });

        // passEncoder.setPipeline(this.graphicsLibrary.computePipelines.contours);
        passEncoder.setPipeline(globals.graphicsLibrary.computePipelines.distanceTransform);
        passEncoder.setBindGroup(0, cameraBindGroup);
        passEncoder.setBindGroup(1, contoursBindGroup);
        passEncoder.setBindGroup(2, dtParamsBindGroup);

        // console.log("DT: dispatching workgroups!");
        passEncoder.dispatchWorkgroups(
            DOWNSCALED_TEX_SIZE / 8,
            DOWNSCALED_TEX_SIZE / 8,
            1);
        // passEncoder.dispatchWorkgroups(
        //     Math.ceil((parameters.width + 7) / 8),
        //     Math.ceil((parameters.height + 7) / 8),
        //     1);

        passEncoder.end();
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

    }

function debug_clearContoursTexture(graphicsLibrary: GraphicsLibrary, contoursTexture: GPUTexture) {
        // if (!this.graphicsLibrary) {
        //     return;
        // }

        const device = graphicsLibrary.device;

        const commandEncoder = device.createCommandEncoder();

        
        // if (!this.contoursTexture) {
        //     return;
        // }
        const textureView = contoursTexture.createView();

        const backgroundColor: GPUColorDict = { r: 1.0, g: 0.0, b: 0.0, a: 1.0};
        const passthroughPassEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: backgroundColor,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });
                
        passthroughPassEncoder.end();

        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

    }