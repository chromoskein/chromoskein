import React, { Dispatch, useEffect, useRef, useState } from "react";
import { D1ViewportConfiguration } from "../../modules/storage/models/viewports";
import { Data, DataAction, DataState } from "../../modules/storage/models/data";
import { SelectionAction, SelectionState } from "../../modules/storage/models/selections";
// import { GoslingComponent, GoslingSpec } from "gosling.js";

export function D1Viewport(props: {
    configurationID: number,
    configuration: D1ViewportConfiguration,
    dataReducer: [DataState, Dispatch<DataAction>],
    selectionsReducer: [SelectionState, Dispatch<SelectionAction>],
}): JSX.Element {
    const container = useRef<HTMLDivElement | null>(null);
    // const goslingComponent = useRef(null);

    // const [containerSize, setContainerSize] = useState({ width: 400, height: 200 });

    // const configuration = props.configuration;

    // const [data, dataDispatch] = props.dataReducer;
    // const [globalSelections, globalSelectionsDispatch] = props.selectionsReducer;

    // useEffect(() => {
    //     if (container && container.current && container.current.parentElement) {
    //         const parent = container.current.parentElement;

    //         const observer = new ResizeObserver((entries) => {
    //             const entry = entries.find((entry) => entry.target === parent);

    //             if (!entry) {
    //                 return;
    //             }

    //             setContainerSize(() => { return { width: entry.contentRect.width, height: entry.contentRect.height } });
    //         });

    //         observer.observe(parent, { box: 'border-box' });
    //     }

    // }, [container]);

    // const [spec, setSpec] = useState<GoslingSpec>({
    //     "tracks": []
    // });

    // useEffect(() => {
    //     const dataId = configuration.data[0].id;
    //     if (dataId >= 0) {
    //         const d: Data = data.data.filter(d => d.id == dataId)[0];
    //         if (d && d.type == 'sparse-1d-data') {
    //             const values = (d.values as Sparse1DData).filter((v) => v.from != null && v.to != null).map(v => {
    //                 return {
    //                     chromosome: "1",
    //                     chromStart: v.from,
    //                     chromEnd: v.to,
    //                     value: v.value,
    //                 }
    //             });
    //             const xDomainMax = Math.max(...values.map(v => v.chromEnd));
    //             setSpec(() => {
    //                 return {
    //                     "tracks": [
    //                         {
    //                             "layout": "linear",
    //                             "width": containerSize.width - 60,
    //                             "height": containerSize.height - 90,
    //                             "padding": 30,
    //                             "data": {
    //                                 "type": "json",
    //                                 "chromosomeField": "chromosome",
    //                                 "genomicFields": ["chromStart", "chromEnd"],
    //                                 "quantitativeFields": ["value"],
    //                                 "values": values,
    //                             },
    //                             "mark": "bar",
    //                             "x": { "field": "chromStart", "type": "genomic", "domain": { "chromosome": "1", "interval": [1, xDomainMax] }, },
    //                             "xe": { "field": "chromEnd", "type": "genomic" },
    //                             "strokeWidth": { "value": 0.5 },
    //                             "y": { "field": "value", "type": "quantitative" }
    //                         }
    //                     ]
    //                 }
    //             });
    //         }
    //     }
    // }, [data, containerSize, configuration.data[0].id]);

    return (<div ref={container} style={{
        width: '100%',
        height: '100%',
        position: 'relative'
    }}>
        {/* <GoslingComponent
            ref={goslingComponent}
            spec={spec}
            compiled={(spec, vConf) => {}}
            padding={30}/> */}
    </div>
    );
}
