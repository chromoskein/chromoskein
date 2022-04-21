import * as GraphicsModule from "../../modules/graphics";

export function LabelingOverlay(props: {graphicsLibrary: GraphicsModule.GraphicsLibrary}) : JSX.Element {

    // return <h1>TEST</h1>;
    return (<svg style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                <text x={18} y={34} fontSize={18} fill='white'>TEST</text>
                <text x={18} y={64} fontSize={18} fill='white'>TEST</text>
                <text x={18} y={94} fontSize={18} fill='white'>TEST</text>
                <text x={18} y={124} fontSize={18} fill='white'>TEST</text>
                <text x={18} y={154} fontSize={18} fill='white'>TEST</text>
</svg>);
}