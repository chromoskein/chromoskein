import { GraphicsLibrary } from "..";
import { ChromatinViewport } from "../viewports";
import { Label } from "./label";


const DOWNSCALED_TEX_SIZE = 512;

export function computeContours(
    globals: {
        graphicsLibrary: GraphicsLibrary, 
        viewport: ChromatinViewport
    }, 
    inputIDTexture: GPUTexture, 
    outputContoursTexture: GPUTexture) : void 
    {

        if (!globals.viewport.camera) {
            return;
        }

        debug_clearContoursTexture(globals.graphicsLibrary, outputContoursTexture); //~ just for testing whether the blitting pipeline works fine. it does.

        const device = globals.graphicsLibrary.device;
        const commandEncoder = device.createCommandEncoder();
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
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

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
    },
    dtTexture: GPUTexture, smallIdTexture: GPUTexture): Promise<Label[]> {

        //~ TODO: copy dtTexture content to a buffer
        const dtTextureContent = await getTextureAsArray(globals, dtTexture);
        // if (!this.smallIDTexture) return [];
        const smallIdTextureContent = await getTextureAsArray(globals, smallIdTexture);

        //~ TODO: loop over pixels and pick best candidates for each region ID
        type Candidate = {
            x: number,
            y: number,
            dtValue: number,
            regionId: number,
        }
        const candidates = new Array<Candidate>(256);
        //~ init
        for (let c = 0; c < 256; c++) {
            candidates[c] = {x: 0, y: 0, dtValue: 0, regionId: -1};
        }

        const t = dtTextureContent;
        const tId = smallIdTextureContent;
        // const w = 512;
        const h = 512;
        for (let i = 0; i < 512; i++) {
            for (let j = 0; j < 512; j++) {
                const index = j * (h * 4) + i * 4;
                const pixelVal = { 
                    x: t[index + 0], 
                    y: t[index + 1], 
                    z: t[index + 2], 
                    w: t[index + 3]
                };
                // const id = pixelVal.w;
                const id = tId[index + 0];
                const currentBest = candidates[id];
                if (!currentBest) continue;
                if (pixelVal.z > currentBest.dtValue) {
                    const u = i / 512.0;
                    const v = j / 512.0;
                    // const newBest = {x: pixelVal.x, y: pixelVal.y, dtValue: pixelVal.z, regionId: id};
                    const newBest = {x: u, y: v, dtValue: pixelVal.z, regionId: id};
                    candidates[id] = newBest;
                }
            }
        }

        //~ debug
        candidates[123] = {x: 0, y: 0, dtValue: 321, regionId: 123};
        candidates[42] = {x: 0.5, y: 0.5, dtValue: 321, regionId: 42};
        candidates[43] = {x: 1.0, y: 1.0, dtValue: 321, regionId: 43};

        // if (!globals.viewport) return [];

        const labels: Label[] = [];
        for (let c = 0; c < 256; c++) {
            const candidate = candidates[c];
            if (candidate.regionId < 0) {
                continue;
            } else {
                const xScreen = candidate.x * (globals.viewport.width / 2.0); //~ the 2 comes here because of window.devicePixelRatio! TODO: make general
                const yScreen = candidate.y * (globals.viewport.height / 2.0);

                const lbl = {
                    // x: candidate.x,
                    x: xScreen,
                    // y: candidate.y,
                    y: yScreen,
                    id: candidate.regionId,
                    text: "Label TEST",
                }
                labels.push(lbl);
            }
        }
            
        // return [];
        return labels;
    }


export async function computeMaxDistance(globals:
    {
        graphicsLibrary: GraphicsLibrary,
        viewport: ChromatinViewport,
    },
    idBuffer: GPUTexture, dtTexture: GPUTexture): Promise<Label[]> {
    if (!globals.graphicsLibrary) return [];

    const device = globals.graphicsLibrary.device;
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();

    // if (!this.viewport) return [];
    // const idBuffer = this.viewport.getIDBuffer();
    // if (!idBuffer) return [];

    // if (!this.distanceTransformTexture) return [];
    const inputTexturesBindGroup = device.createBindGroup({
        label: "Max DT: input textures bind group",
        layout: globals.graphicsLibrary.bindGroupLayouts.maxDTInputTextures,
        entries: [
            { binding: 0, resource: idBuffer.createView() },
            { binding: 1, resource: dtTexture.createView() },
        ]
    })

    if (!globals.viewport || !globals.viewport.camera) return [];
    const cameraBindGroup = device.createBindGroup({
        label: "Camera bind group",
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

    //~ generating initial buffer:
    const MAX_LABELS = 256;
    const BUFFER_SIZE = MAX_LABELS * 4 * 4;
    const labelCandidates = new Float32Array(new ArrayBuffer(BUFFER_SIZE));
    for (let i = 0; i < MAX_LABELS; i++) {
        labelCandidates[i * 4 + 0] = -1; // regionId (i32)
        // labelCandidates[i * 4 + 1] = 1.0; // dtValue (f32)
        labelCandidates[i * 4 + 1] = 0.0; // dtValue (f32)
        labelCandidates[i * 4 + 2] = 0; // uvPosition.x (vec2<f32>)
        labelCandidates[i * 4 + 3] = 0; // uvPosition.y (vec2<f32>)
    }

    const labelsBufferGPU = device.createBuffer({
        size: BUFFER_SIZE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const stagingBuffer = device.createBuffer({
        size: BUFFER_SIZE,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const candidatesBufferBindGroup = device.createBindGroup({
        layout: globals.graphicsLibrary.bindGroupLayouts.maxDTCandidatesBuffer,
        entries: [{
            binding: 0,
            resource: {
                buffer: labelsBufferGPU,
            },
        }],
    });

    device.queue.writeBuffer(labelsBufferGPU, 0, labelCandidates);

    passEncoder.setPipeline(globals.graphicsLibrary.computePipelines.maxDT);
    passEncoder.setBindGroup(0, cameraBindGroup);
    passEncoder.setBindGroup(1, inputTexturesBindGroup);
    passEncoder.setBindGroup(2, candidatesBufferBindGroup);

    // console.log("DT: dispatching workgroups!");
    passEncoder.dispatchWorkgroups(
        DOWNSCALED_TEX_SIZE / 8,
        DOWNSCALED_TEX_SIZE / 8,
        1);

    passEncoder.end();
    commandEncoder.copyBufferToBuffer(labelsBufferGPU, 0, stagingBuffer, 0, BUFFER_SIZE);
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    //~ reading back the buffer
    await stagingBuffer.mapAsync(GPUMapMode.READ, 0, BUFFER_SIZE);
    const copyArrayBuffer = stagingBuffer.getMappedRange(0, BUFFER_SIZE);
    const data = copyArrayBuffer.slice(0);
    stagingBuffer.unmap();
    // console.log(new Float32Array(data));
    const dataArray = new Float32Array(data);
    // console.log(dataArray);

    // labelCandidates[i * 4 + 0] = -1; // regionId (i32)
    // labelCandidates[i * 4 + 1] = 0; // dtValue (f32)
    // labelCandidates[i * 4 + 2] = 0; // uvPosition.x (vec2<f32>)
    // labelCandidates[i * 4 + 3] = 0; // uvPosition.y (vec2<f32>)

    const labels: Label[] = [];
    for (let i = 0; i < MAX_LABELS; i++) {
        // console.log(i);
        const regionId = dataArray[i * 4 + 0] as number;
        const dtValue = dataArray[i * 4 + 1] as number;
        const x = dataArray[i * 4 + 2] as number;
        const y = dataArray[i * 4 + 3] as number;
        //~ TODO: recalculate to screen/pixel coordinates
        const xScreen = x * (globals.viewport.width / 2.0);
        const yScreen = y * (globals.viewport.height / 2.0);
        const lbl = {
            x: xScreen,
            y: yScreen,
            id: regionId,
            text: "Label test",
        };
        // console.log(lbl);

        if (lbl.id == -1) {
            // break;
        } else {
            labels.push(lbl);
            console.log("regionId: %d, uvPosition: (%f, %f), dtValue: %f", regionId, x, y, dtValue);
        }
    }
    console.log("Labels:");
    // console.log(labels);

    return labels;
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