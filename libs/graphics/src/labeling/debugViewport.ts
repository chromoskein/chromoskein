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

    protected _width = 0;
    protected _height = 0;

    constructor(library: GraphicsLibrary, viewport: ChromatinViewport, canvas: HTMLCanvasElement | null) {
        this.graphicsLibrary = library;
        this._canvas = canvas;
        this._mainViewport = viewport;

        if (this._canvas != null) {
            console.log("✅CANVAS CONFIGURED");
            this._context = this._canvas.getContext("webgpu");
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
            const clearColor: GPUColorDict = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
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
        // }
    }


    public deallocate(): void {
        //~ TODO
    }

}