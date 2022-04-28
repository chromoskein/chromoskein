import * as GraphicsModule from "../../modules/graphics";
import { useEffect, useRef, useState } from "react";

/**
 * Provides a debug layer able to show intermediate textures from the labeling process. Implemented as a canvas.
 * @param props 
 * @returns 
 */
export function LabelingDebugViewport(props: {graphicsLibrary: GraphicsModule.GraphicsLibrary, viewport: GraphicsModule.ChromatinViewport}): JSX.Element {

    const canvasElement = useRef<HTMLCanvasElement>(null);
    const [labelingDebugViewport, setLabelingDebugViewport] = useState<GraphicsModule.DebugViewport>(() => new GraphicsModule.DebugViewport(props.graphicsLibrary, props.viewport, canvasElement.current));
    // const [layoutGenerator, setLayoutGenerator] = useState<GraphicsModule.LabelLayoutGenerator>(() => new GraphicsModule.LabelLayoutGenerator(props.viewport, props.graphicsLibrary));

    // Viewport Setup
    useEffect(() => {
        console.log("🅱️LabelingDebugViewport changed.");
        if (props.graphicsLibrary && canvasElement != null && canvasElement.current) {
            // const newViewport = props.graphicsLibrary.createChromatinViewport(canvasElement.current);
            const newViewport = new GraphicsModule.DebugViewport(props.graphicsLibrary, props.viewport, canvasElement.current);
            // newViewport.cameraConfiguration = configuration.camera;
            // setViewport(() => newViewport);
            setLabelingDebugViewport(() => newViewport);

            // Draw the scene repeatedly
            const render = async (frametime: number) => {
                await newViewport.render(frametime);

                requestAnimationFrame(render);
            }
            const requestID = requestAnimationFrame(render);

            return function cleanup() {
                // viewport?.deallocate();
                labelingDebugViewport?.deallocate();
                window.cancelAnimationFrame(requestID);
            };
        }
    }, [props.graphicsLibrary, props.viewport, canvasElement]);
    // }, [props.graphicsLibrary, props.viewport, labelingDebugViewport, canvasElement]);
    // }, [props.graphicsLibrary, props.configurationID, canvasElement]);

    return <canvas data-tip data-for='tooltip' ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none'}} tabIndex={-1}></canvas>
}