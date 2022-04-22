import * as GraphicsModule from "../../modules/graphics";
import { useState } from "react";

type Label = {
    x: number;
    y: number;
    id: number;
    text: string;
};

function getRandomInt(max: number) : number {
    return Math.floor(Math.random() * max);
}

export function LabelingOverlay(props: { graphicsLibrary: GraphicsModule.GraphicsLibrary }): JSX.Element {

    const [layoutGenerator, setLayoutGenerator] = useState<GraphicsModule.LabelLayoutGenerator>(() => new GraphicsModule.LabelLayoutGenerator());
    const labels: Label[] = Array.from({ length: 100 }, (_, index) => ({ id: index, x: getRandomInt(800), y: getRandomInt(600), text: "Label " + index }))

    return (<svg style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
        {labels.map(({ id, x, y, text }: Label) => (<text key={id} x={x} y={y} fontSize={18} fill='white'>{text}</text>))}
    </svg>);
}