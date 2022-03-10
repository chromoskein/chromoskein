import { Dispatch, useEffect, useRef, useState } from "react";
import { Data, DataAction, DataState, Position3D, Positions3D } from "../../modules/storage/models/data";
import { UndirectedGraph } from "graphology";
import * as d3 from 'd3';
import { ForceGraphViewportConfiguration } from "../../modules/storage/models/viewports";
import { SelectionAction, SelectionState } from "../../modules/storage/models/selections";
import { ControlsContainer, ForceAtlasControl, SigmaContainer, useLoadGraph, useSigma, ZoomControl } from "react-sigma-v2";
import "react-sigma-v2/lib/react-sigma-v2.css";
import AbstractGraph from "graphology-types";
import { PlainObject } from "sigma/types";
import { animateNodes } from "sigma/utils/animate";
import FA2Layout from 'graphology-layout-forceatlas2/worker';




type GraphNode = { x: number, y: number, color: string, size: number } & d3.SimulationNodeDatum;
type GraphLink = { source: string | d3.SimulationNodeDatum, target: string | d3.SimulationNodeDatum, value: number, color: string, size: number } & d3.SimulationLinkDatum<GraphNode>






function randomCoordinate() {
    return Math.random() * 100;
}
function createLinearGraphRepresentation(graphRepresentation: AbstractGraph, data: Positions3D) {


    function* pairwise<T>(iterable: Iterable<T>): Generator<{ current: T, next: T, currentIndex: number }> {
        let currentIndex = 0;
        const iterator = iterable[Symbol.iterator]();
        let current = iterator.next();
        let next = iterator.next();
        while (!next.done) {
            yield { current: current.value, next: next.value, currentIndex };
            currentIndex++;
            current = next;
            next = iterator.next();
        }
    }

    if (data.length == 0) {
        return graphRepresentation;
    }
    console.log("Making linear representation")
    graphRepresentation.addNode(0, {
        x: randomCoordinate(),
        y: randomCoordinate(),
        color: "#F00",
        size: 10
    });
    for (let { current, next, currentIndex } of pairwise(data)) {
        graphRepresentation.addNode(currentIndex + 1, {
            x: randomCoordinate(),
            y: randomCoordinate(),
            color: "#F00",
            size: 10

        })
        graphRepresentation.addUndirectedEdge(currentIndex, currentIndex + 1, {
            color: "#000",
            size: 1
        })
    }

    return graphRepresentation;

}


function poseRandom(graph: AbstractGraph, data: Positions3D) {
    const randomPositions: PlainObject<PlainObject<number>> = {};
    graph.forEachNode((node) => {
        // create random positions respecting position extents
        randomPositions[node] = {
            x: randomCoordinate(),
            y: randomCoordinate(),
        };
    });



    animateNodes(graph, randomPositions, { duration: 0 })
}


function createForceGraphRepresentation(data?: Positions3D) {
    function distance(p1: Position3D, p2: Position3D) {
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        let dz = p1.z - p2.z;

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const graphRepresentation = new UndirectedGraph()

    if (!data || data.length == 0) {
        return graphRepresentation;
    }


    for (let bin_index = 0; bin_index < data.length; bin_index++) {
        graphRepresentation.addNode(bin_index, {
            x: randomCoordinate(),
            y: randomCoordinate()
        })
    }

    for (let bin_index = 0; bin_index < data.length; bin_index++) {
        for (let other_index = bin_index + 1; other_index < data.length; other_index++) {
            graphRepresentation.addUndirectedEdge(
                bin_index,
                other_index,
                {
                    source: bin_index.toString(),
                    target: other_index.toString(),
                    distance: distance(data[bin_index], data[other_index])
                }
            )
        }
    }

    return graphRepresentation
}

function makeForceLayout() {
    return
}


function GraphVizualization({ binPositions }: { binPositions: Positions3D }) {
    const sigma = useSigma();
    const loadGraph = useLoadGraph();
    const [layout, setLayout] = useState<FA2Layout | null>(null);


    const graph = sigma.getGraph();
    graph.clear();
    createLinearGraphRepresentation(graph, binPositions);
    // const repr = createForceGraphRepresentation(binPositions);
    // setLayout(new FA2Layout(repr, { settings: { gravity: 1 }, attributes: { weight: "distance" }, weighted: true }));


    // useEffect(() => {
    //     if (layout == null) {
    //         return;
    //     }
    //     layout.start();

    //     setTimeout(() => {
    //         layout.stop();
    //     }, 3000)

    // }, [])

    // loadGraph(repr);

    return null;
}

export function ForceGraphViewport(props: {
    configurationID: number,
    configuration: ForceGraphViewportConfiguration,
    dataReducer: [DataState, Dispatch<DataAction>]
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>]
}) {

    const viewport = useRef(null);

    const [data, setData] = props.dataReducer;
    const [binPositions, setBinPositions] = useState<Positions3D>([])
    const sigmaWrapper = useRef<HTMLDivElement>(null);

    const [mounted, setMounted] = useState(true)

    useEffect(() => {
        const isInvisible = sigmaWrapper.current?.offsetWidth === 0 || sigmaWrapper.current?.offsetHeight === 0
        setMounted(!isInvisible);
    }, [sigmaWrapper])

    useEffect(() => {
        console.log("Recomputing the graph vizualization");

        if (!viewport) {
            console.warn("No viewport or data");
            return;
        }

        if (!props.configuration.data) {
            console.warn("No data available");
            return;
        }

        const d: Data = data.data.filter(d => d.id == props.configuration.data!.id)[0];

        if (!d) {
            console.warn("No data selected");
            return;
        }

        if (d.type != '3d-positions') {
            console.error("Wrong data type selected");
            return;
        }
        const selectedData = d.values as Positions3D;
        setBinPositions(selectedData);
    }, [viewport, data, props.configuration.data]);

    useEffect(() => {
        // const simulation = d3.forceSimulation<GraphNode>()
        //     .force('link', d3.forceLink<GraphNode, GraphLink>()
        //         .id(n => n.id)
        //         .distance(l => l.value * 10))
        //     // .force('charge', d3.forceManyBody().strength(10))
        //     .force('center', d3.forceCenter(width / 2, height / 2))
        //     .nodes(graph.nodes)
        //     .on('tick', ticked);

        // const linkForce: d3.ForceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>> = simulation.force('link')!;
        // linkForce.links(graph.links)

    }, [])

    function handleOnRunSim() {

    }

    // if (!mounted) {
    //     return "Dismounted."
    // }

    return <div ref={sigmaWrapper} style={{ width: '100%', height: '100%', minHeight: '100px', minWidth: '100px' }}>
        <SigmaContainer>
            <GraphVizualization binPositions={binPositions} />
            <ControlsContainer position={"bottom-right"}>
                <ZoomControl />
                <ForceAtlasControl />
            </ControlsContainer>
        </SigmaContainer>
    </div>




}