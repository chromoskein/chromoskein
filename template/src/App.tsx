import React, { useState, useEffect, useRef } from 'react';
import { GraphicsLibrary } from "./modules/graphics/index";
import * as GraphicsModule from "./modules/graphics";
import './App.css';
import pdbData from './data/3d_model.pdb';
import { parsePdb } from './modules/parsing/parsePDB';
import { vec3 } from 'gl-matrix';

export function App(): JSX.Element {
  const [adapter, setAdapter] = useState<GPUAdapter | null>(null);
  const [device, setDevice] = useState<GPUDevice | null>(null);
  const [deviceError, setDeviceError] = useState<GPUUncapturedErrorEvent | null>(null);
  const [graphicsLibrary, setGraphicsLibrary] = useState<GraphicsLibrary | null>(null);

  const canvasElement = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState<GraphicsModule.Viewport3D | null>(null);

  const [data, setData] = useState(null);

  //#region Adapter, Device, Library Initialization
  useEffect(() => {
    async function waitForAdapter() {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });

      setAdapter(adapter);
    }

    waitForAdapter();
  }, []);

  useEffect(() => {
    if (adapter == null) {
      return;
    }
    const waitForDevice = async function () {
      const device = await adapter.requestDevice({
        // requiredFeatures: ['timestamp-query']
      });
      device.onuncapturederror = (error: GPUUncapturedErrorEvent) => {
        setDeviceError(error);
      };

      setDeviceError(null);
      setDevice(device);
    }

    waitForDevice();
  }, [adapter]);

  useEffect(() => {
    if (adapter == null || device == null) {
      return;
    }

    setGraphicsLibrary(() => new GraphicsLibrary(adapter, device));
  }, [adapter, device]);
  //#endregion

  //#region Viewport Setup
  useEffect(() => {
    if (!graphicsLibrary || canvasElement == null || !canvasElement.current) return;

    const newViewport = graphicsLibrary.create3DViewport(canvasElement.current);
    setViewport(() => newViewport);

    // Draw the scene repeatedly
    const render = async (frametime: number) => {
      await newViewport.render(frametime);

      requestAnimationFrame(render);
    }
    const requestID = requestAnimationFrame(render);

    return function cleanup() {
      viewport?.deallocate();
      window.cancelAnimationFrame(requestID);
    };
  }, [graphicsLibrary, canvasElement]);
  //#endregion Viewport Setup

  //#region Load Data
  useEffect(() => {
    if (!viewport) return;

    fetch(pdbData)
      .then(response => response.text().then(data => {
        const positions = parsePdb(data)[0].atoms;
        const [_, spheres] = viewport.scene.addSpheres("atoms", positions.map(v => vec3.fromValues(v.x, v.y, v.z)), 0.1, null, false, true);
        spheres.radius = 0.008;
        viewport.scene.buildLowLevelStructure();
      })
    );
  }, [viewport]);
  //#endregion Load Data

  return (
    <canvas ref={canvasElement} style={{ width: '100%', height: '100%', overflow: 'hidden' }}></canvas>
  );
}