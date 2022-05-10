import * as GraphicsModule from "../../modules/graphics";

/**
 * Displays a layer of textual labels over the main canvas, annotating selections. Optionally it add another (third) layer with a canvas for showing debug textures.
 * @param props 
 * @returns 
 */
export function LabelingOverlay(props: { labels: GraphicsModule.Label[] }): JSX.Element {

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', left: '0', top: '0' }}>
            <svg style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                {props.labels.map(({ id, x, y, text }: GraphicsModule.Label) => (<text key={id} x={x} y={y} fontSize={18} fill='white'>{text}</text>))}
            </svg>
        </div>
    );
}