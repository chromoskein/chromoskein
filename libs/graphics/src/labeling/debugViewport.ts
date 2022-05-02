import { GraphicsLibrary } from "..";
import { ChromatinViewport } from "../viewports/chromatin_viewport";

/**
 * The only purpose of this class is to blit textures from the main viewport canvas into a separate canvas for debuging purposes
 */
export class DebugViewport {
    //~ High-level inputs
    private _mainViewport: ChromatinViewport;

    //~ Low-level internals
    protected graphicsLibrary: GraphicsLibrary;

    protected _canvas: HTMLCanvasElement | null = null;
    protected _context: GPUCanvasContext | null = null;

    protected _width = 800;
    protected _height = 600;

    constructor(library: GraphicsLibrary, viewport: ChromatinViewport, canvas: HTMLCanvasElement | null) {
        this.graphicsLibrary = library;
        this._canvas = canvas;
        this._mainViewport = viewport;

        if (this._canvas != null) {
            console.log("✅CANVAS CONFIGURED");
            this._context = this._canvas.getContext("webgpu");

            const size = {
                width: this._width,
                height: this._height,
            };

            if (this._context) {
                this._context.configure({
                    device: this.graphicsLibrary.device,
                    format: 'bgra8unorm',
                    usage: GPUTextureUsage.RENDER_ATTACHMENT,
                    compositingAlphaMode: "opaque",
                    size,
                });

                console.log("let's try this.");
                const textureView = this._context.getCurrentTexture().createView();
                console.log("⚠️no problem, boss.");
            } else {
                console.log("PROBLEM, Boss!");
            }
        } else {
            console.log("❌CANVAS CONFIGURED");
        }
    }

    async render(frametime: number): Promise<void> {
        if (!this._context) {
            return;
        }

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

        console.log("gonna render!");
        const commandEncoder = device.createCommandEncoder();

        const textureToShow = this._mainViewport.getIDBuffer();
        if (!textureToShow) {
            return;
        }

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
        passthroughPassEncoder.setPipeline(this.graphicsLibrary.renderPipelines.textureBlit);
        passthroughPassEncoder.setBindGroup(0, device.createBindGroup({
            layout: this.graphicsLibrary.bindGroupLayouts.singleTexture,
            entries: [
                {
                    binding: 0,
                    // resource: this.gBuffer.colorsOpaque.createView(),
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