import { useEffect, useRef } from "react";
import * as GraphicsModule from "../../modules/graphics";

/**
 * Displays a layer of textual labels over the main canvas, annotating selections. Optionally it add another (third) layer with a canvas for showing debug textures.
 * @param props 
 * @returns 
 */
export function LabelingOverlay(props: { labels: GraphicsModule.Label[], configuration: { showAnchors: boolean, } }): JSX.Element {
    const textRefs = useRef<Array<SVGTextElement | null>>([]);
    const bgRefs = useRef<Array<SVGGraphicsElement | null>>([]);

    useEffect(() => {
            for (let i = 0; i < textRefs.current.length; i++) {
            const textEl = textRefs.current[i];
            if (!textEl) return;
            const bgEl = bgRefs.current[i];
            if (!bgEl) return;

            const SVGRect = textEl.getBBox();
            bgEl.setAttribute("x", SVGRect.x.toString());
            bgEl.setAttribute("y", SVGRect.y.toString());
            bgEl.setAttribute("width", SVGRect.width.toString());
            bgEl.setAttribute("height", SVGRect.height.toString());
            bgEl.setAttribute("fill-opacity", "0.8");
        }
    });

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', left: '0', top: '0', pointerEvents: 'none' }}>
            <svg style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                {props.configuration.showAnchors && (
                    props.labels.map(({ id, x, y, text }: GraphicsModule.Label, i: number) => (<circle key={"anchor"+id} cx={x} cy={y} r={2} fill='red'></circle>))
                )}
                {props.labels.map(({ id, x, y, text, color }: GraphicsModule.Label, i: number) => (<rect ref={(el) => (bgRefs.current[i] = el)} key={"bg"+id} fill={"rgb(" + 255 * color.r + ", " + 255 * color.g + ", " + 255 * color.b + ")"}>{text}</rect>))}
                {props.labels.map(({ id, x, y, text }: GraphicsModule.Label, i: number) => (<text ref={(el) => (textRefs.current[i] = el)} key={"label"+id} x={x} y={y} fontSize={18} fill='white'>{text}</text>))}
            </svg>
        </div>
    );
}