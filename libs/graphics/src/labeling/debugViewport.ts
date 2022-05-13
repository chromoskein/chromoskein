import { GraphicsLibrary, LabelLayoutGenerator } from "..";
import { ChromatinViewport } from "../viewports/chromatin_viewport";

/**
 * The only purpose of this class is to blit textures from the main viewport canvas into a separate canvas for debuging purposes
 */
export class DebugViewport {
    //~ High-level inputs
    private _mainViewport: ChromatinViewport;
    private _labelingGenerator: LabelLayoutGenerator;

    //~ Low-level internals
    protected graphicsLibrary: GraphicsLibrary;

    protected _canvas: HTMLCanvasElement | null = null;
    protected _context: GPUCanvasContext | null = null;

    protected _width = 800;
    protected _height = 600;

    constructor(library: GraphicsLibrary, viewport: ChromatinViewport, labelingGenerator: LabelLayoutGenerator, canvas: HTMLCanvasElement | null) {
        this.graphicsLibrary = library;
        this._canvas = canvas;
        this._mainViewport = viewport;
        this._labelingGenerator = labelingGenerator;

        if (this._canvas == null) return;

        this._context = this._canvas.getContext("webgpu");

        this.resize(this._width, this._height);
        // this.reconfigureContext(this._width, this._height);
    }

    public resize(width: number, height: number): void {
        if (!this._context) return;

        console.log("DebugViewport::resize(" + width + ", " + height + ")");

        this.reconfigureContext(width, height);
    }

    private reconfigureContext(width: number, height: number): void {
        if (!this._context) return;

        if (width <= 0 || height <= 0) return;

        console.log("Reconfiguring context:" + width + " x " + height)
        this._context.configure({
            device: this.graphicsLibrary.device,
            format: 'bgra8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            compositingAlphaMode: "opaque",
            size: {
                width: width,
                height: height,
            }
        });
    }

    async render(frametime: number): Promise<void> {
        if (!this._context) {
            return;
        }

        // console.log("debugViewport::render");

        const device = this.graphicsLibrary.device;

        //~ fetch the canvas texture (the target)
        const textureView = this._context.getCurrentTexture().createView();

        // if (this._camera == null || this.scene == null) {
        if (this._mainViewport == null) { //~ I think this is not run ever right now
            const clearColor: GPUColorDict = { r: 1.0, g: 0.0, b: 1.0, a: 1.0 };
            const commandEncoder = device.createCommandEncoder();
            const passthroughPassEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: textureView,
                        // clearValue: this.backgroundColor,
                        clearValue: clearColor,
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            passthroughPassEncoder.end();
            const commandBuffer = commandEncoder.finish();

            device.queue.submit([commandBuffer]);

            return;
        }

        // console.log("gonna render!");
        const commandEncoder = device.createCommandEncoder();

        // const textureToShow = this._mainViewport.getIDBuffer();
        const textureToShow = this._labelingGenerator.debug_getContoursTexture();
        if (!textureToShow) {
            return;
        }

        const backgroundColor: GPUColorDict = { r: 0.3, g: 0.3, b: 0.3, a: 1.0};
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
        passthroughPassEncoder.setPipeline(this.graphicsLibrary.renderPipelines.textureBlit);
        passthroughPassEncoder.setBindGroup(0, device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.singleTexture,
            entries: [
                {
                    binding: 0,
                    resource: textureToShow.createView(),
                },
            ]
        }));
        passthroughPassEncoder.draw(3, 1, 0, 0);
        passthroughPassEncoder.end();

        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

    }



    public deallocate(): void {
        //~ TODO
    }

}