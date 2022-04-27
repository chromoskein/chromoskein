import * as GraphicsModule from "../../modules/graphics";
import { useRef } from "react";

// export function LabelingDebugViewport(props: { graphicsLibrary: GraphicsModule.GraphicsLibrary, viewport: GraphicsModule.ChromatinViewport }): JSX.Element {
export function LabelingDebugViewport(): JSX.Element {

    const canvasElement = useRef<HTMLCanvasElement>(null);

    const onClick = () => {
        // empty so far...
    }

    // return <canvas data-tip data-for='tooltip' ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} tabIndex={-1} onClick={() => onClick()}></canvas>
    return <canvas data-tip data-for='tooltip' ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none'}} tabIndex={-1}></canvas>
}