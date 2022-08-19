import { useEffect, useRef, useState } from "react";
import * as GraphicsModule from "../../modules/graphics";

/**
 * Displays a layer of textual labels over the main canvas, annotating selections. Optionally it add another (third) layer with a canvas for showing debug textures.
 * @param props 
 * @returns 
 */
export function LabelingOverlay(props: { labels: GraphicsModule.Label[], configuration: { showAnchors: boolean, } }): JSX.Element {
    const textRefs = useRef<Array<SVGTextElement | null>>([]);
    const bgRefs = useRef<Array<SVGGraphicsElement | null>>([]);

    // const breadcrumbsPanel: string[]= [];
    const [breadcrumbsPanel, setBreadcrumbsPanel] = useState<string[]>([]);

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

    const onLabelClick = (clickedId: number) => {
        const clickedLabel = props.labels.find(lbl => lbl.id == clickedId);
        if (clickedLabel) {
            console.log(clickedLabel.text);

            //~ update breadcrumbs panel
            const newBreadcrumbs = [...breadcrumbsPanel, clickedLabel.text]; 
            setBreadcrumbsPanel(newBreadcrumbs);

            //~ TODO:
            //~ - probably call a callback which will trigger hiding of chromatin part based on clicked selection
        }
    }

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', left: '0', top: '0', pointerEvents: 'none' }}>
            <svg style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                {props.configuration.showAnchors && (
                    props.labels.map(({ id, x, y, text }: GraphicsModule.Label, i: number) => (<circle key={"anchor"+id} cx={x} cy={y} r={2} fill='red'></circle>))
                )}
                {props.labels.map(({ id, x, y, text, color }: GraphicsModule.Label, i: number) => (<rect ref={(el) => (bgRefs.current[i] = el)} key={"bg"+id} style={{pointerEvents: 'auto'}} fill={"rgb(" + 255 * color.r + ", " + 255 * color.g + ", " + 255 * color.b + ")"} onClick={() => onLabelClick(id)}>{text}</rect>))}
                {props.labels.map(({ id, x, y, text }: GraphicsModule.Label, i: number) => (<text ref={(el) => (textRefs.current[i] = el)} key={"label"+id} x={x} y={y} fontSize={18} fill='white'>{text}</text>))}
            </svg>
            {/* Breadcrumbs panel: should go into own component */}
            <svg style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                {breadcrumbsPanel.map((item: string, i: number) => (<text x={10} y={30 + i * 20} fontSize={18} key={"breadcrumb"+i} fill='white'>{item}</text>))}
            </svg>
        </div>
    );
}