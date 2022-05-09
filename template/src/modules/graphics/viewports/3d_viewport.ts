import { vec2, vec3, vec4 } from "gl-matrix";
import { HighLevelStructure } from "../primitives/index";
import { OrbitCamera, SmoothCamera } from "../cameras/index";
import { RenderObjects, Scene } from "../scene";
import { GraphicsLibrary, LinearImmutableArray } from "..";
import { Hit, Ray } from "../shared";
import { GBUFFER_NORMAL_FORMAT } from "../pipelines/shared";
import { CullObject, CullSphere, CullPlane, CullRoundedCone } from "../culling";
import { Image } from 'image-js';
import blueNoise from './HDR_RGB_0.png';

export class Viewport3D {
  protected graphicsLibrary: GraphicsLibrary;

  protected _canvas: HTMLCanvasElement | null = null;
  protected _context: GPUCanvasContext | null = null;

  protected width = 0;
  protected height = 0;

  protected outputTexture: GPUTexture | null = null;
  protected depthTexture: GPUTexture | null = null;
  protected gBuffer: {
    colorsOpaque: GPUTexture,
    colorsTransparent: GPUTexture,
    worldNormals: GPUTexture,
    ambientOcclusion: [GPUTexture, GPUTexture, GPUTexture],
    currentAmbientOcclusion: number,
    globals: {
      ambientOcclusionTaps: number,
    },
    globalsGPU: GPUBuffer,
  } | null = null;

  protected _scene: Scene;
  protected _camera: OrbitCamera | SmoothCamera | null = null;

  //#region Culling
  protected _cullObjects: Array<CullObject> = [];
  protected _cullObjectsBuffer: LinearImmutableArray;
  //#endregion

  //#region Options
  public backgroundColor: GPUColorDict = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
  //#endregion

  protected _lastFrametime = 0;

  //#region Post-Process  
  protected _ssaoGlobals: {
    noiseSamples: Float32Array;
    kernelSize: number;
    radius: number;
    bias: number;
  };
  protected _ssaoGlobalsBuffer: Float32Array;
  protected _ssaoGlobalsGPU: GPUBuffer;
  protected _ssaoGlobalsFarGPU: GPUBuffer;
  protected _ssaoNoiseTexure: GPUTexture;
  //#endregion

  //#region Modules
  // protected blurModule: Blur;
  //#endregion

  //#region Ray Tracing
  public rayTraceAO = false;
  //#endregion

  //#region Benchmarking
  // private timestampsQuerySet: GPUQuerySet;
  // private timestampsBuffer: GPUBuffer;
  // private timestampsResolvedBuffer: GPUBuffer;
  //#endregion

  public dirty = true;

  constructor(
    graphicsLibrary: GraphicsLibrary,
    canvas: HTMLCanvasElement | null,
    scene: Scene | null = null,
    camera: OrbitCamera | SmoothCamera | null = null) {
    this.graphicsLibrary = graphicsLibrary;
    this._canvas = canvas;

    if (this._canvas != null) {
      this._context = this._canvas.getContext("webgpu");

      const parent = this._canvas.parentElement;
      const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        const entry = entries.find((entry: ResizeObserverEntry) => entry.target === parent);

        if (entry instanceof ResizeObserverEntry && entry.devicePixelContentBoxSize) {
          this.resize(
            entry.devicePixelContentBoxSize[0].inlineSize,
            entry.devicePixelContentBoxSize[0].blockSize);
        }
      });

      if (parent) {
        observer.observe(parent, { box: 'device-pixel-content-box' });
      }
    }

    if (this._canvas != null && this._context != null) {
      // this._camera = camera ?? new OrbitCamera(this.graphicsLibrary.device, this.width, this.height);
      this._camera = camera ?? new SmoothCamera(this.graphicsLibrary.device, this.width, this.height);
      this._canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      this._canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      this._canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      this._canvas.addEventListener('mouseenter', this.onMouseEnter.bind(this));
      this._canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));
      this._canvas.addEventListener('wheel', this.onWheelEvent.bind(this));
      this._canvas.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    this._scene = scene ?? graphicsLibrary.createScene();

    this._cullObjects = [];
    this._cullObjectsBuffer = this.graphicsLibrary.allocator.allocateArray(1);

    //#region Modules initialization 
    // this.blurModule = new Blur(graphicsLibrary);
    // this.blurModule.filterDimension = 3;
    //#endregion

    //#region SSAO initialization
    this._ssaoGlobals = {
      noiseSamples: new Float32Array(64 * 4),
      kernelSize: 64,
      radius: 0.5,
      bias: 0.25,
    };
    this._ssaoGlobalsBuffer = new Float32Array(64 * 4 + 16);
    this._ssaoGlobalsGPU = this.graphicsLibrary.device.createBuffer({
      size: this._ssaoGlobalsBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._ssaoGlobalsFarGPU = this.graphicsLibrary.device.createBuffer({
      size: this._ssaoGlobalsBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const lerp = (a: number, b: number, f: number): number => {
      return a + f * (b - a);
    };

    // for (let i = 0; i < this._ssaoGlobals.kernelSize; i++) {
    //   const sample = vec3.fromValues(
    //     Math.random() * 2.0 - 1.0,
    //     Math.random() * 2.0 - 1.0,
    //     Math.random()
    //   );

    //   vec3.normalize(sample, sample);
    //   vec3.scale(sample, sample, Math.random());

    //   let scale = i / this._ssaoGlobals.kernelSize;
    //   scale = lerp(0.1, 1.0, scale * scale);

    //   vec3.scale(sample, sample, scale);

    //   this._ssaoGlobals.noiseSamples.set([
    //     sample[0], sample[1], sample[2], 0.0
    //   ], i * 4);
    // }

    Image.load(blueNoise).then(image => {
      for (let i = 0; i < 64; i++) {
        // const sample = vec3.fromValues(
        //   Math.random() * 2.0 - 1.0, // (image.data[i*3 + 0] / image.maxValue) * 2.0 - 1.0,
        //   Math.random() * 2.0 - 1.0, // (image.data[i*3 + 0] / image.maxValue) * 2.0 - 1.0,
        //   Math.random()              // (image.data[i*3 + 0] / image.maxValue)
        // );

        const sample = vec3.fromValues(
          (image.data[i * 3 + 0] / image.maxValue) * 2.0 - 1.0,
          (image.data[i * 3 + 1] / image.maxValue) * 2.0 - 1.0,
          (image.data[i * 3 + 2] / image.maxValue)
        );

        vec3.normalize(sample, sample);
        vec3.scale(sample, sample, Math.random());

        let scale = i / this._ssaoGlobals.kernelSize;
        scale = lerp(0.1, 1.0, scale * scale);

        vec3.scale(sample, sample, scale);

        this._ssaoGlobals.noiseSamples.set([
          sample[0], sample[1], sample[2], 0.0
        ], i * 4);
      }

      this._ssaoGlobalsBuffer.set(this._ssaoGlobals.noiseSamples);
      this._ssaoGlobalsBuffer.set(
        [this._ssaoGlobals.kernelSize, this._ssaoGlobals.radius, this._ssaoGlobals.bias],
        64 * 4);
    });

    this._ssaoNoiseTexure = this.graphicsLibrary.device.createTexture({
      size: {
        width: 64,
        height: 64,
        depthOrArrayLayers: 1,
      },
      format: 'rgba32float',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    });

    Image.load(blueNoise).then(image => {
      const noiseTextureBuffer = new Float32Array(64 * 64 * 4);

      for (let i = 0; i < 64 * 64; i++) {
        noiseTextureBuffer.set([
          (image.data[i * 3 + 0] / image.maxValue) * 2.0 - 1.0,
          (image.data[i * 3 + 1] / image.maxValue) * 2.0 - 1.0,
          0.0,
          1.0
        ], i * 4);
      }

      this.graphicsLibrary.device.queue.writeTexture(
        { texture: this._ssaoNoiseTexure, },
        noiseTextureBuffer,
        { bytesPerRow: 1024, },
        { width: 64, height: 64, depthOrArrayLayers: 1 }
      );
    });

    //#endregion

    //#region Benchmarking
    // this.timestampsQuerySet = this.graphicsLibrary.device.createQuerySet({
    //   type: 'timestamp',
    //   count: 4,
    // });
    // this.timestampsBuffer = this.graphicsLibrary.device.createBuffer({
    //   size: 512,
    //   usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    // });
    // this.timestampsResolvedBuffer = this.graphicsLibrary.device.createBuffer({
    //   size: 512,
    //   usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    // });
    //#endregion
  }

  public deallocate(): void {
    this._scene.deallocate();

    this._canvas = null;
    this._context = null;

    this.width = 0;
    this.height = 0;

    this.outputTexture?.destroy();
    this.outputTexture = null;

    this.depthTexture?.destroy();
    this.depthTexture = null;

    this.gBuffer?.colorsOpaque.destroy();
    this.gBuffer?.colorsTransparent.destroy();
    this.gBuffer?.worldNormals.destroy();
    this.gBuffer?.ambientOcclusion.forEach(t => t.destroy());
    this.gBuffer = null;

    this._camera = null;
  }

  resize(width: number, height: number): void {
    if (!this._canvas || !this._context) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1.0;

    this._canvas.setAttribute("style", "width:" + (width / devicePixelRatio) + "px; height:" + (height / devicePixelRatio) + "px");

    this.width = width;
    this.height = height;

    this._canvas.width = width;
    this._canvas.height = height;

    // this.blurModule.width = width;
    // this.blurModule.height = height;

    const size = {
      width: this.width,
      height: this.height,
    };
    const sampleCount = 1;

    if (width <= 0 || height <= 0) {
      return;
    }

    this._context.configure({
      device: this.graphicsLibrary.device,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      compositingAlphaMode: "opaque",
      size,
    });

    this.depthTexture = this.graphicsLibrary.device.createTexture({
      size,
      sampleCount,
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });

    this.outputTexture = this.graphicsLibrary.device.createTexture({
      size,
      sampleCount,
      format: "rgba8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    });

    this.gBuffer = {
      colorsOpaque: this.graphicsLibrary.device.createTexture({
        size,
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      }),
      colorsTransparent: this.graphicsLibrary.device.createTexture({
        size,
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      }),
      worldNormals: this.graphicsLibrary.device.createTexture({
        size,
        format: GBUFFER_NORMAL_FORMAT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      }),
      ambientOcclusion: [this.graphicsLibrary.device.createTexture({
        size,
        format: 'r32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      }),
      this.graphicsLibrary.device.createTexture({
        size,
        format: "r32float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      }),
      this.graphicsLibrary.device.createTexture({
        size,
        format: "r32float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      })],
      currentAmbientOcclusion: 0,
      globals: {
        ambientOcclusionTaps: 0,
      },
      globalsGPU: this.graphicsLibrary.device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
    };

    // this.blurModule.textures = [this.gBuffer.ambientOcclusion[0], this.gBuffer.ambientOcclusion[1]];

    if (this._camera) {
      this._camera.width = this.width;
      this._camera.height = this.height;
    }

    this.dirty = true;
  }

  async render(frametime: number): Promise<void> {
    const device = this.graphicsLibrary.device;
    const renderPipelines = this.graphicsLibrary.renderPipelines;
    const bindGroupLayouts = this.graphicsLibrary.bindGroupLayouts;

    //~ Compute Delta Time
    const dt = frametime - this._lastFrametime;
    this._lastFrametime = frametime;

    if (this._canvas == null ||
      this._context == null ||
      this.depthTexture == null ||
      this.outputTexture == null ||
      this.gBuffer == null 
      // this.scene.bvh == null
      ) {
      return;
    }

    const textureView = this._context.getCurrentTexture().createView();

    if (this._camera == null || this.scene == null) {
      const commandEncoder = device.createCommandEncoder();
      const passthroughPassEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: this.backgroundColor,
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      passthroughPassEncoder.end();
      const commandBuffer = commandEncoder.finish();

      device.queue.submit([commandBuffer]);

      return;
    }

    if (this._camera instanceof SmoothCamera) {
      this._camera.updateCPU(dt); //~ DK: this is because in OrbitCamera updateCPU is protected and in SmoothCamera it's public and I need to call it here every frame
    }
    const dirty = true; // this.dirty || this._camera.dirty;

    this._camera.updateGPU(device.queue);
    this._ssaoGlobalsBuffer.set(
      [this._ssaoGlobals.kernelSize, 0.10, this._ssaoGlobals.bias],
      64 * 4);
    device.queue.writeBuffer(
      this._ssaoGlobalsGPU,
      0,
      this._ssaoGlobalsBuffer.buffer,
      this._ssaoGlobalsBuffer.byteOffset,
      this._ssaoGlobalsBuffer.byteLength,
    );
    this._ssaoGlobalsBuffer.set(
      [this._ssaoGlobals.kernelSize, 1.0, this._ssaoGlobals.bias],
      64 * 4);
    device.queue.writeBuffer(
      this._ssaoGlobalsFarGPU,
      0,
      this._ssaoGlobalsBuffer.buffer,
      this._ssaoGlobalsBuffer.byteOffset,
      this._ssaoGlobalsBuffer.byteLength,
    );
    this._scene.uploadModified(device.queue);
    this._cullObjectsBuffer.uploadModified(device.queue);

    const gBufferGlobals = new Int32Array([this.gBuffer.globals.ambientOcclusionTaps, /*dirty ? 1 : 0*/1]);
    device.queue.writeBuffer(
      this.gBuffer.globalsGPU,
      0,
      gBufferGlobals.buffer,
      gBufferGlobals.byteOffset,
      gBufferGlobals.byteLength,
    );

    const cameraBindGroup = device.createBindGroup({
      layout: bindGroupLayouts.camera,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this._camera.bufferGPU,
            offset: 0,
          }
        },
      ]
    });

    const cullObjectsBindGroup = device.createBindGroup({
      label: "Cull Objects BG",
      layout: bindGroupLayouts.cullObjects,
      entries: [
        {
          binding: 0, resource: { buffer: this._cullObjectsBuffer.gpuBuffer, offset: this._cullObjectsBuffer.data.byteOffset, size: this._cullObjectsBuffer.data.byteLength }
        },
      ]
    });

    const commandEncoder = device.createCommandEncoder();
    // commandEncoder.writeTimestamp(this.timestampsQuerySet, 0);

    //#region Rasterize G-Buffer
    const gBufferRasterizeOpaquePass = commandEncoder.beginRenderPass({
      label: "G-Buffer Rasterization Opaque Pass",
      colorAttachments: [
        {
          view: this.gBuffer.colorsOpaque.createView(),
          clearValue: this.backgroundColor,
          loadOp: 'clear',
          storeOp: 'store',
        },
        {
          view: this.gBuffer.worldNormals.createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),

        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    });

    gBufferRasterizeOpaquePass.setBindGroup(0, device.createBindGroup({
      label: "Camera BG",
      layout: bindGroupLayouts.camera,
      entries: [
        {
          binding: 0, resource: { buffer: this._camera.bufferGPU, offset: 0 }
        },
      ]
    }));
    gBufferRasterizeOpaquePass.setBindGroup(2, cullObjectsBindGroup);
    this.scene.renderRasterization(gBufferRasterizeOpaquePass, this._camera, RenderObjects.Opaque, null);
    gBufferRasterizeOpaquePass.end();

    // commandEncoder.writeTimestamp(this.timestampsQuerySet, 1);
    const gBufferRasterizeTransparentPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.gBuffer.colorsTransparent.createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }
      ]
    });

    gBufferRasterizeTransparentPass.setBindGroup(0, device.createBindGroup({
      label: "Camera BG",
      layout: bindGroupLayouts.camera,
      entries: [
        {
          binding: 0, resource: { buffer: this._camera.bufferGPU, offset: 0 }
        },
      ]
    }));
    gBufferRasterizeTransparentPass.setBindGroup(2, cullObjectsBindGroup);
    this.scene.renderRasterization(gBufferRasterizeTransparentPass, this._camera, RenderObjects.Transparent, this.depthTexture.createView());
    gBufferRasterizeTransparentPass.end();

    //#endregion

    const computePassEncoder = commandEncoder.beginComputePass();

    //#region Ray Trace G-Buffer    
    // this.scene.renderRayTracingGBuffer({
    //   width: this.width,
    //   height: this.height,
    //   cameraBindGroup,
    //   outputBindGroup: device.createBindGroup({
    //     layout: bindGroupLayouts.rayTracingGBufferOutput,
    //     entries: [
    //       { binding: 0, resource: this.gBuffer.colorsOpaque.createView() },
    //       { binding: 1, resource: this.gBuffer.worldPositions.createView() },
    //       { binding: 2, resource: this.gBuffer.worldNormals.createView() },
    //       { binding: 3, resource: this.gBuffer.ambientOcclusion[0].createView(), },
    //       { binding: 4, resource: { buffer: this.gBuffer.globalsGPU } },
    //     ]
    //   }),
    //   passEncoder: computePassEncoder,
    // });
    //#endregion

    if (this.rayTraceAO) {
      this._scene.renderRayTracingAmbientOcclusion({
        width: this.width,
        height: this.height,
        cameraBindGroup: cameraBindGroup,
        gBufferBindGroup: device.createBindGroup({
          layout: this.graphicsLibrary.bindGroupLayouts.rayTracingAmbientOcclusionOutput,
          entries: [
            { binding: 0, resource: this.depthTexture.createView() },
            { binding: 1, resource: this.gBuffer.worldNormals.createView() },
            { binding: 2, resource: this.gBuffer.ambientOcclusion[0].createView() },
            {
              binding: 3,
              resource: {
                buffer: this.gBuffer.globalsGPU,
              },
            }
          ]
        }),
        passEncoder: computePassEncoder,
      });
    } else {
      this._scene.renderScreenSpaceAmbientOcclusion({
        width: this.width,
        height: this.height,
        cameraBindGroup: cameraBindGroup,
        gBufferBindGroup: device.createBindGroup({
          layout: this.graphicsLibrary.bindGroupLayouts.ssaoGBuffer,
          entries: [
            { binding: 0, resource: this.depthTexture.createView() },
            { binding: 1, resource: this.gBuffer.worldNormals.createView() },
            { binding: 2, resource: this.gBuffer.ambientOcclusion[0].createView() }
          ]
        }),
        ssaoBindGroup: device.createBindGroup({
          layout: this.graphicsLibrary.bindGroupLayouts.ssaoGlobals,
          entries: [
            { binding: 0, resource: { buffer: this._ssaoGlobalsGPU } },
            { binding: 1, resource: this.graphicsLibrary.nearestRepeatSampler },
            { binding: 2, resource: this._ssaoNoiseTexure.createView() }
          ]
        }),
        passEncoder: computePassEncoder,
      });

      this._scene.renderScreenSpaceAmbientOcclusion({
        width: this.width,
        height: this.height,
        cameraBindGroup: cameraBindGroup,
        gBufferBindGroup: device.createBindGroup({
          layout: this.graphicsLibrary.bindGroupLayouts.ssaoGBuffer,
          entries: [
            { binding: 0, resource: this.depthTexture.createView() },
            { binding: 1, resource: this.gBuffer.worldNormals.createView() },
            { binding: 2, resource: this.gBuffer.ambientOcclusion[1].createView() }
          ]
        }),
        ssaoBindGroup: device.createBindGroup({
          layout: this.graphicsLibrary.bindGroupLayouts.ssaoGlobals,
          entries: [
            { binding: 0, resource: { buffer: this._ssaoGlobalsFarGPU } },
            { binding: 1, resource: this.graphicsLibrary.nearestRepeatSampler },
            { binding: 2, resource: this._ssaoNoiseTexure.createView() }
          ]
        }),
        passEncoder: computePassEncoder,
      });
    }

    computePassEncoder.setPipeline(this.graphicsLibrary.computePipelines.ssaoJoin);
    computePassEncoder.setBindGroup(0,
      device.createBindGroup({
        layout: this.graphicsLibrary.bindGroupLayouts.ssaoJoin,
        entries: [
          { binding: 0, resource: this.gBuffer.ambientOcclusion[0].createView() },          
          { binding: 1, resource: this.gBuffer.ambientOcclusion[1].createView() },
          { binding: 2, resource: this.gBuffer.ambientOcclusion[2].createView() },
        ],
      })
    );
    computePassEncoder.dispatchWorkgroups(
      Math.ceil((this.width + 7) / 8),
      Math.ceil((this.height + 7) / 8),
    );

    computePassEncoder.setPipeline(this.graphicsLibrary.computePipelines.ambientOcclusionBlur);
    computePassEncoder.setBindGroup(0,
      device.createBindGroup({
        layout: this.graphicsLibrary.bindGroupLayouts.aoBlurIO,
        entries: [
          { binding: 0, resource: this.gBuffer.ambientOcclusion[2].createView() },          
          { binding: 1, resource: this.gBuffer.worldNormals.createView() },
          { binding: 2, resource: this.depthTexture.createView() },
          { binding: 3, resource: this.gBuffer.ambientOcclusion[1].createView() },
        ],
      })
    );
    computePassEncoder.dispatchWorkgroups(
      Math.ceil((this.width + 7) / 8),
      Math.ceil((this.height + 7) / 8),
    );


    // computePassEncoder.setBindGroup(0,
    //   device.createBindGroup({
    //     layout: this.graphicsLibrary.bindGroupLayouts.aoBlurIO,
    //     entries: [
    //       { binding: 0, resource: this.gBuffer.ambientOcclusion[1].createView() },          
    //       { binding: 1, resource: this.gBuffer.worldNormals.createView() },
    //       { binding: 2, resource: this.depthTexture.createView() },
    //       { binding: 3, resource: this.gBuffer.ambientOcclusion[0].createView() },
    //     ],
    //   })
    // );
    // computePassEncoder.dispatch(
    //   Math.ceil((this.width + 7) / 8),
    //   Math.ceil((this.height + 7) / 8),
    // );

    computePassEncoder.end();

    // commandEncoder.writeTimestamp(this.timestampsQuerySet, 2);

    const passthroughPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: this.backgroundColor,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    passthroughPassEncoder.setPipeline(this.graphicsLibrary.renderPipelines.renderGBuffer);
    passthroughPassEncoder.setBindGroup(0, device.createBindGroup({
      layout: this.graphicsLibrary.bindGroupLayouts.renderGBuffer,
      entries: [
        {
          binding: 0,
          resource: this.gBuffer.colorsOpaque.createView(),
        },
        {
          binding: 1,
          resource: this.gBuffer.colorsTransparent.createView(),
        },
        {
          binding: 2,
          resource: this.depthTexture.createView(),
        },
        {
          binding: 3,
          resource: this.gBuffer.worldNormals.createView(),
        },
        {
          binding: 4,
          resource: this.gBuffer.ambientOcclusion[1].createView(),
        },
        {
          binding: 5,
          resource: {
            buffer: this.gBuffer.globalsGPU,
          },
        },
        {
          binding: 6,
          resource: {
            buffer: this._camera.bufferGPU,
          },
        }
      ]
    }));
    passthroughPassEncoder.draw(3, 1, 0, 0);
    passthroughPassEncoder.end();

    // commandEncoder.resolveQuerySet(this.timestampsQuerySet, 0, 3, this.timestampsBuffer, 0);
    // commandEncoder.copyBufferToBuffer(this.timestampsBuffer, 0, this.timestampsResolvedBuffer, 0, 4 * 8);

    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

    // await this.timestampsResolvedBuffer.mapAsync(GPUMapMode.READ);
    // const timestamps = this.timestampsResolvedBuffer.getMappedRange();
    // const timestampsDataView = new DataView(new Uint8Array(timestamps).buffer);

    // const left = timestampsDataView.getUint32(0, true);
    // const right = timestampsDataView.getUint32(4, true); 
    // const combined = left + 2 ** 32 * right;
    // const left2 = timestampsDataView.getUint32(8, true);
    // const right2 = timestampsDataView.getUint32(12, true);
    // const combined2 = left2 + 2 ** 32 * right2;    
    // const left3 = timestampsDataView.getUint32(16, true);
    // const right3 = timestampsDataView.getUint32(20, true);
    // const combined3 = left3 + 2 ** 32 * right3;    

    // this.timestampsResolvedBuffer.unmap();
    // console.log((combined2 - combined) / 1000000.0, (combined3 - combined2) / 1000000.0);

    this.dirty = false;
  }

  //#region Camera events
  public onMouseDown(event: MouseEvent): void {
    if (this._camera == null || this._scene == null) {
      return;
    }

    this._camera.onMouseDown(event);
  }

  public onMouseMove(event: MouseEvent): void {
    if (this._camera == null) {
      return;
    }

    this._camera.onMouseMove(event);

    if (this._scene == null || this._scene.bvh == null) {
      return;
    }
  }

  public onMouseUp(event: MouseEvent): void {
    this._camera?.onMouseUp(event);
  }

  public onMouseEnter(event: MouseEvent): void {
    this._camera?.onMouseEnter(event);
  }

  public onMouseLeave(event: MouseEvent): void {
    this._camera?.onMouseLeave(event);
  }

  public onWheelEvent(event: WheelEvent): void {
    this._camera?.onWheelEvent(event);
  }

  public onKeyDown(event: KeyboardEvent): void {
    this._camera?.onKeyDown(event);
  }
  //#endregion

  public set scene(scene: Scene) {
    this._scene = scene;
  }

  public get scene(): Scene {
    return this._scene;
  }

  public set camera(camera: OrbitCamera | SmoothCamera | null) {
    if (camera == this._camera) {
      return;
    }

    this._canvas?.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this._canvas?.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this._canvas?.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this._canvas?.removeEventListener('wheel', this.onWheelEvent.bind(this));
    this._canvas?.removeEventListener('keydown', this.onKeyDown.bind(this));

    this._camera = camera;
    this._canvas?.addEventListener('mousedown', this.onMouseDown.bind(this));
    this._canvas?.addEventListener('mouseup', this.onMouseUp.bind(this));
    this._canvas?.addEventListener('mousemove', this.onMouseMove.bind(this));
    this._canvas?.addEventListener('wheel', this.onWheelEvent.bind(this));
    this._canvas?.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  public get camera(): OrbitCamera | SmoothCamera | null {
    return this._camera;
  }

  public get canvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  //#region SSAO
  protected updateSSAOParameters(): void {
    this._ssaoGlobalsBuffer.set(
      [this._ssaoGlobals.kernelSize, this._ssaoGlobals.radius, this._ssaoGlobals.bias],
      this._ssaoGlobals.kernelSize * 4);
  }

  public set ssaoKernelSize(kernelSize: number) {
    this._ssaoGlobals.kernelSize = kernelSize;

    this.updateSSAOParameters();
  }

  public set ssaoKernelRadius(radius: number) {
    this._ssaoGlobals.radius = radius;

    this.updateSSAOParameters();
  }

  public set ssaoKernelBias(bias: number) {
    this._ssaoGlobals.bias = bias;

    this.updateSSAOParameters();
  }

  public set ssaoBlurSize(blurSize: number) {
    // this.blurModule.filterDimension = blurSize;
  }

  public get ssaoBlurSize(): number {
    // return this.blurModule.filterDimension;
    return 2;
  }
  //#endregion

  //#region Intersections
  public screenSpaceToRay(screenSpacePosition: vec2): Ray | null {
    if (this._scene == null || this._scene.bvh == null || this._camera == null) {
      return null;
    }

    const camera = this._camera;

    const normalizedSpacePosition = vec4.fromValues(
      (screenSpacePosition[0] / this.width) * 2.0 - 1.0,
      (1.0 - (screenSpacePosition[1] / this.height)) * 2.0 - 1.0,
      0.0,
      1.0
    );

    const viewSpacePosition = vec4.transformMat4(vec4.create(), normalizedSpacePosition, camera.projectionMatrixInverse);
    viewSpacePosition[2] = -1.0;
    viewSpacePosition[3] = 1.0;

    const worldSpacePosition = vec4.transformMat4(vec4.create(), viewSpacePosition, camera.viewMatrixInverse);

    const rayDirection = vec4.sub(vec4.create(), worldSpacePosition, vec4.fromValues(
      camera.position[0],
      camera.position[1],
      camera.position[2],
      1.0
    ));
    vec4.normalize(rayDirection, rayDirection);

    return new Ray(
      camera.position,
      vec3.fromValues(rayDirection[0], rayDirection[1], rayDirection[2])
    );
  }

  public intersections(screenSpacePosition: vec2): Array<Hit> {
    if (this._scene == null || this._scene.bvh == null || this._camera == null) {
      return [];
    }

    const normalizedSpacePosition = vec4.fromValues(
      (screenSpacePosition[0] / this.width) * 2.0 - 1.0,
      (1.0 - (screenSpacePosition[1] / this.height)) * 2.0 - 1.0,
      0.0,
      1.0
    );

    const viewSpacePosition = vec4.transformMat4(vec4.create(), normalizedSpacePosition, this._camera.projectionMatrixInverse);
    viewSpacePosition[2] = -1.0;
    viewSpacePosition[3] = 1.0;

    const worldSpacePosition = vec4.transformMat4(vec4.create(), viewSpacePosition, this._camera.viewMatrixInverse);

    const rayDirection = vec4.sub(vec4.create(), worldSpacePosition, vec4.fromValues(
      this._camera.position[0],
      this._camera.position[1],
      this._camera.position[2],
      1.0
    ));
    vec4.normalize(rayDirection, rayDirection);

    const ray = new Ray(
      this._camera.position,
      vec3.fromValues(rayDirection[0], rayDirection[1], rayDirection[2])
    );

    return this._scene.bvh.allIntersections(ray);
  }

  public closestIntersection(screenSpacePosition: vec2): Hit | null {
    if (this._scene == null || this._scene.bvh == null || this._camera == null) {
      return null;
    }

    const camera = this._camera;

    const normalizedSpacePosition = vec4.fromValues(
      (screenSpacePosition[0] / this.width) * 2.0 - 1.0,
      (1.0 - (screenSpacePosition[1] / this.height)) * 2.0 - 1.0,
      0.0,
      1.0
    );

    const viewSpacePosition = vec4.transformMat4(vec4.create(), normalizedSpacePosition, camera.projectionMatrixInverse);
    viewSpacePosition[2] = -1.0;
    viewSpacePosition[3] = 1.0;

    const worldSpacePosition = vec4.transformMat4(vec4.create(), viewSpacePosition, camera.viewMatrixInverse);

    const rayDirection = vec4.sub(vec4.create(), worldSpacePosition, vec4.fromValues(
      camera.position[0],
      camera.position[1],
      camera.position[2],
      1.0
    ));
    vec4.normalize(rayDirection, rayDirection);

    const ray = new Ray(
      camera.position,
      vec3.fromValues(rayDirection[0], rayDirection[1], rayDirection[2])
    );

    return this._scene.bvh.closestIntersection(ray, this._cullObjects);
  }
  //#endregion

  //#region Structure manipulation
  public getStructureByName(name: string): HighLevelStructure | null {
    if (this._scene == null) {
      return null;
    }

    return this._scene.getStructureByName(name);
  }

  public getStructureByID(structureID: number): HighLevelStructure | null {
    if (this._scene == null) {
      return null;
    }

    return this._scene.getStructureByID(structureID);
  }

  public removeStructureByName(name: string): void {
    if (this._scene == null) {
      return;
    }

    this._scene.removeStructureByName(name);
  }
  //#endregion

  //#region Culling
  public updateCullObjects(): void {
    const u32view = this._cullObjectsBuffer.u32View;
    const f32view = this._cullObjectsBuffer.f32View;

    u32view[0] = this._cullObjects.length;

    for (let i = 0; i < this._cullObjects.length; i++) {
      const cullObject = this._cullObjects[i];
      const baseOffset = (i + 1) * 32;

      if (cullObject instanceof CullSphere) {
        u32view[baseOffset + 0] = 0;
        f32view[baseOffset + 1] = cullObject.center[0];
        f32view[baseOffset + 2] = cullObject.center[1];
        f32view[baseOffset + 3] = cullObject.center[2];
        f32view[baseOffset + 4] = cullObject.radius;
        u32view[baseOffset + 5] = cullObject.cullType;
      }

      if (cullObject instanceof CullRoundedCone) {
        u32view[baseOffset + 0] = 1;

        f32view[baseOffset + 1] = cullObject.from[0];
        f32view[baseOffset + 2] = cullObject.from[1];
        f32view[baseOffset + 3] = cullObject.from[1];
        f32view[baseOffset + 4] = cullObject.radius;

        f32view[baseOffset + 5] = cullObject.to[0];
        f32view[baseOffset + 6] = cullObject.to[1];
        f32view[baseOffset + 7] = cullObject.to[2];
        f32view[baseOffset + 8] = cullObject.radius;

        u32view[baseOffset + 9] = cullObject.cullType;
      }

      if (cullObject instanceof CullPlane) {
        u32view[baseOffset + 0] = 2;

        f32view[baseOffset + 1] = cullObject.explicit[0];
        f32view[baseOffset + 2] = cullObject.explicit[1];
        f32view[baseOffset + 3] = cullObject.explicit[2];
        f32view[baseOffset + 4] = cullObject.explicit[3];
      }
    }

    this._cullObjectsBuffer.setModifiedSlabs([0]);
  }

  public get cullObjects(): Array<CullObject> {
    return this._cullObjects;
  }

  public addCullObject(object: CullObject): void {
    this._cullObjects.push(object);
  }

  public deleteCullObjects(): void {
    this._cullObjects = [];
  }
  //#endregion
}
