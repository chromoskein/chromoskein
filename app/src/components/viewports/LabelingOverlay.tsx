import * as GraphicsModule from "../../modules/graphics";
import { useEffect, useState } from "react";
import { useDeepCompareEffect } from "react-use";


export function LabelingOverlay(props: { graphicsLibrary: GraphicsModule.GraphicsLibrary, viewport: GraphicsModule.ChromatinViewport }): JSX.Element {

    const [layoutGenerator, setLayoutGenerator] = useState<GraphicsModule.LabelLayoutGenerator>(() => new GraphicsModule.LabelLayoutGenerator(props.viewport, props.graphicsLibrary));
    const [labels, setLabels] = useState<GraphicsModule.Label[]>([]);

    // useDeepCompareEffect(() => {
    //     setLabels(layoutGenerator.getLabelPositions());
    //     // console.log("LabelingOverlay:: recomputing label positions!")
    // }, [layoutGenerator, props.viewport, props.viewport.camera]);

    useDeepCompareEffect(() => {
        layoutGenerator.viewport = props.viewport;
        setLabels(layoutGenerator.getLabelPositions());
        console.log("LabelingOverlay:: props.viewport changed!");
        console.log("width = " + props.viewport.width + ", " + "height = " + props.viewport.height);
    }, [layoutGenerator, props.viewport, props.viewport.width, props.viewport.height]);


    return (<svg style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
        {labels.map(({ id, x, y, text }: GraphicsModule.Label) => (<text key={id} x={x} y={y} fontSize={18} fill='white'>{text}</text>))}
    </svg>);
}