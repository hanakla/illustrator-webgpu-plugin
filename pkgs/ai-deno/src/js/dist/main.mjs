// src/js/src/types.ts
function definePlugin(plugin) {
  return plugin;
}

// src/js/src/ui.ts
var ui = {
  group: ({ direction = "horizontal" }, children) => ({
    type: "group",
    direction,
    children
  }),
  slider: (props) => ({
    ...props,
    type: "slider"
  }),
  checkbox: (props) => ({
    ...props,
    type: "checkbox"
  }),
  textInput: (props) => ({
    ...props,
    type: "textInput"
  }),
  text: (props) => ({
    ...props,
    type: "text"
  }),
  button: (props) => ({
    ...props,
    type: "button"
  })
};

// src/js/src/live-effects/blurEffect.ts
var blurEffect = definePlugin({
  id: "blur-v1",
  title: "Gausian Blur V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: 2 /* kPostEffectFilter */,
    features: []
  },
  paramSchema: {
    radius: {
      type: "real",
      default: 1
    }
  },
  initDoLiveEffect: async () => {
    const { createCanvas } = await import("jsr:@gfx/canvas");
    const device = await navigator.gpu.requestAdapter().then((adapter) => adapter.requestDevice());
    const shaderCode = `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) texCoord: vec2f,
      }

      @vertex
      fn vertexMain(@location(0) position: vec4f,
                    @location(1) texCoord: vec2f) -> VertexOutput {
        var output: VertexOutput;
        output.position = position;
        output.texCoord = texCoord;
        return output;
      }

      @group(0) @binding(0) var inputTexture: texture_2d<f32>;
      @group(0) @binding(1) var inputSampler: sampler;
      @group(0) @binding(2) var<uniform> kernel: array<f32, 256>;
      @group(0) @binding(3) var<uniform> kernelSize: u32;
      @group(0) @binding(4) var<uniform> direction: vec2f;

      @fragment
      fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
        var color = vec4f(0.0);
        let radius = i32(kernelSize) / 2;

        for (var i = -radius; i <= radius; i++) {
          let offset = direction * f32(i);
          let sampleCoord = texCoord + offset;
          let kernelValue = kernel[u32(i + radius)];
          color += textureSample(inputTexture, inputSampler, sampleCoord) * kernelValue;
        }

        return color;
      }
    `;
    return {
      createCanvas,
      device,
      shaderCode,
      bindGroupLayout: device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          },
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          },
          {
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          }
        ]
      })
    };
  },
  doLiveEffect: async ({
    device,
    createCanvas,
    horizontalPipeline,
    verticalPipeline,
    pipelineLayout
  }, params, input) => {
    const canvas = createCanvas(100, 100);
    console.time("[deno_ai(js)] gaussianBlurWebGPU");
    const result = await gaussianBlurWebGPU(input, params.radius);
    console.timeEnd("[deno_ai(js)] gaussianBlurWebGPU");
    return result;
    async function gaussianBlurWebGPU(input2, radius) {
      const { width, height, data } = input2;
      const { kernel, size } = generateGaussianKernel(radius);
      const kernelBuffer = device.createBuffer({
        size: 256 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(kernelBuffer, 0, new Float32Array(kernel));
      const kernelSizeBuffer = device.createBuffer({
        size: Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(kernelSizeBuffer, 0, new Uint32Array([size]));
      const directionBuffer = device.createBuffer({
        size: 2 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const textureData = new Uint8Array(data.buffer);
      const texture = device.createTexture({
        size: { width, height, depthOrArrayLayers: 1 },
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      });
      device.queue.writeTexture(
        { texture },
        textureData,
        { bytesPerRow: width * 4, rowsPerImage: height },
        { width, height, depthOrArrayLayers: 1 }
      );
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear"
      });
      const tempTexture = device.createTexture({
        size: { width, height, depthOrArrayLayers: 1 },
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
      });
      const outputTexture = device.createTexture({
        size: { width, height, depthOrArrayLayers: 1 },
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
      });
      device.queue.writeBuffer(
        directionBuffer,
        0,
        new Float32Array([1 / width, 0])
      );
      const horizontalBindGroup = device.createBindGroup({
        layout: pipelineLayout,
        entries: [
          { binding: 0, resource: texture.createView() },
          { binding: 1, resource: sampler },
          { binding: 2, resource: { buffer: kernelBuffer } },
          { binding: 3, resource: { buffer: kernelSizeBuffer } },
          { binding: 4, resource: { buffer: directionBuffer } }
        ]
      });
      const commandEncoder = device.createCommandEncoder();
      const horizontalPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: tempTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store"
          }
        ]
      });
      horizontalPass.setPipeline(horizontalPipeline);
      horizontalPass.setBindGroup(0, horizontalBindGroup);
      horizontalPass.draw(6, 1, 0, 0);
      horizontalPass.end();
      device.queue.writeBuffer(
        directionBuffer,
        0,
        new Float32Array([0, 1 / height])
      );
      const verticalBindGroup = device.createBindGroup({
        layout: pipelineLayout,
        entries: [
          { binding: 0, resource: tempTexture.createView() },
          { binding: 1, resource: sampler },
          { binding: 2, resource: { buffer: kernelBuffer } },
          { binding: 3, resource: { buffer: kernelSizeBuffer } },
          { binding: 4, resource: { buffer: directionBuffer } }
        ]
      });
      const verticalPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: outputTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store"
          }
        ]
      });
      verticalPass.setPipeline(verticalPipeline);
      verticalPass.setBindGroup(0, verticalBindGroup);
      verticalPass.draw(6, 1, 0, 0);
      verticalPass.end();
      const outputBuffer = device.createBuffer({
        size: width * height * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      commandEncoder.copyTextureToBuffer(
        { texture: outputTexture },
        { buffer: outputBuffer, bytesPerRow: width * 4, rowsPerImage: height },
        { width, height, depthOrArrayLayers: 1 }
      );
      device.queue.submit([commandEncoder.finish()]);
      await outputBuffer.mapAsync(GPUMapMode.READ);
      const outputArray = new Uint8ClampedArray(outputBuffer.getMappedRange());
      outputBuffer.unmap();
      const imageData = new ImageData(outputArray, width, height);
      kernelBuffer.destroy();
      kernelSizeBuffer.destroy();
      directionBuffer.destroy();
      texture.destroy();
      tempTexture.destroy();
      outputTexture.destroy();
      outputBuffer.destroy();
      return imageData;
    }
  },
  editLiveEffectParameters: (params) => JSON.stringify(params),
  renderUI: (params) => {
    console.log("renderUI");
    return ui.group({ direction: "col" }, [
      ui.text({ text: "Radius" }),
      ui.slider({
        key: "radius",
        label: "Radius",
        dataType: "float",
        min: 0,
        max: 400,
        value: params.radius ?? 1
      })
    ]);
  }
});
function generateGaussianKernel(radius) {
  const size = radius * 2 + 1;
  const kernel = new Array(size * size);
  const sigma = radius / 2;
  const twoSigmaSquare = 2 * sigma * sigma;
  const piTwoSigmaSquare = Math.PI * twoSigmaSquare;
  let sum = 0;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const exp = Math.exp(-(x * x + y * y) / twoSigmaSquare);
      const value = exp / piTwoSigmaSquare;
      const index = (y + radius) * size + (x + radius);
      kernel[index] = value;
      sum += value;
    }
  }
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }
  return { kernel, size };
}

// src/js/src/live-effects/utils.ts
var createCanvasImpl = typeof window === "undefined" ? async (width, height) => {
  const { createCanvas } = await import("jsr:@gfx/canvas");
  return createCanvas(width, height);
} : (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
var createImageDataImpl = typeof window === "undefined" ? async (data, width, height, settings) => {
  const { ImageData: ImageData2 } = await import("jsr:@gfx/canvas");
  return new ImageData2(
    data,
    width,
    height,
    settings
  );
} : (data, width, height, settings) => {
  return new ImageData(data, width, height, settings);
};
function getNearestAligned256Resolution(width, height, bytesPerPixel = 4) {
  const currentBytesPerRow = width * bytesPerPixel;
  const targetBytesPerRow = Math.ceil(currentBytesPerRow / 256) * 256;
  const newWidth = Math.round(targetBytesPerRow / bytesPerPixel);
  return {
    width: newWidth,
    height
  };
}
async function adjustImageToNearestAligned256Resolution(imageDataLike) {
  const { width: newWidth, height: newHeight } = getNearestAligned256Resolution(
    imageDataLike.width,
    imageDataLike.height
  );
  const resized = await resizeImageData(imageDataLike, newWidth, newHeight);
  return resized;
}
async function resizeImageData(data, width, height) {
  const canvas = createCanvasImpl(data.width, data.height);
  const ctx = canvas.getContext("2d");
  const imgData = createImageDataImpl(data.data, data.width, data.height, {
    colorSpace: "srgb"
  });
  ctx.putImageData(imgData, 0, 0);
  const resizedCanvas = createCanvasImpl(width, height);
  const resizedCtx = resizedCanvas.getContext("2d");
  resizedCtx.drawImage(canvas, 0, 0, width, height);
  return resizedCtx.getImageData(0, 0, width, height);
}

// src/js/src/live-effects/chromatic-aberration.ts
var chromaticAberration = definePlugin({
  id: "chromatic-aberration-v1",
  title: "Chromatic Aberration V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: 2 /* kPostEffectFilter */,
    features: []
  },
  paramSchema: {
    colorMode: {
      type: "string",
      default: "rgb"
    },
    strength: {
      type: "real",
      default: 1
    },
    angle: {
      type: "real",
      default: 0
    },
    opacity: {
      type: "real",
      default: 1
    }
  },
  editLiveEffectParameters: (params) => JSON.stringify(params),
  renderUI: (params) => {
    return ui.group({ direction: "col" }, [
      ui.group({ direction: "row" }, [
        ui.text({ text: "Color Mode" }),
        ui.textInput({ key: "colorMode", label: "Color Mode", value: params.colorMode })
      ]),
      ui.group({ direction: "row" }, [
        ui.text({ text: "Strength" }),
        ui.slider({ key: "strength", label: "Strength", dataType: "float", min: 0, max: 400, value: params.strength })
      ]),
      ui.group({ direction: "row" }, [
        ui.text({ text: "Angle" }),
        ui.slider({ key: "angle", label: "Angle", dataType: "float", min: 0, max: 360, value: params.angle })
      ]),
      ui.group({ direction: "row" }, [
        ui.text({ text: "Opacity" }),
        ui.slider({ key: "opacity", label: "Opacity", dataType: "float", min: 0, max: 1, value: params.opacity })
      ])
    ]);
  },
  initDoLiveEffect: async () => {
    const device = await navigator.gpu.requestAdapter().then(
      (adapter) => adapter.requestDevice({
        label: "WebGPU(Chromatic Aberration)"
      })
    );
    if (!device) {
      throw new Error("Failed to create WebGPU device");
    }
    const shader = device.createShaderModule({
      label: "Chromatic Aberration Shader",
      code: `
          struct Params {
              strength: f32,
              angle: f32,
              colorMode: u32,
              opacity: f32,
              blendMode: u32,  // 0: over, 1: under
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          fn getOffset(angle: f32) -> vec2f {
              let radians = angle * 3.14159 / 180.0;
              return vec2f(cos(radians), sin(radians));
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              let offset = getOffset(params.angle) * params.strength /100;
              var effectColor: vec4f;
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);
              let a = originalColor.a;

              if (params.colorMode == 0u) { // RGB mode
                  let redOffset = texCoord + offset;
                  let blueOffset = texCoord - offset;

                  let r = textureSampleLevel(inputTexture, textureSampler, redOffset, 0.0).r;
                  let g = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0).g;
                  let b = textureSampleLevel(inputTexture, textureSampler, blueOffset, 0.0).b;

                  effectColor = vec4f(r * a, g * a, b * a, a);
              } else { // CMYK mode
                  let cyanOffset = texCoord + offset;
                  let magentaOffset = texCoord + vec2f(-offset.y, offset.x) * 0.866;
                  let yellowOffset = texCoord + vec2f(-offset.x, -offset.y);
                  let blackOffset = texCoord - vec2f(-offset.y, offset.x) * 0.866; // K\u306F-120\u5EA6\u56DE\u8EE2

                  let cyan = textureSampleLevel(inputTexture, textureSampler, cyanOffset, 0.0);
                  let magenta = textureSampleLevel(inputTexture, textureSampler, magentaOffset, 0.0);
                  let yellow = textureSampleLevel(inputTexture, textureSampler, yellowOffset, 0.0);
                  let black = textureSampleLevel(inputTexture, textureSampler, blackOffset, 0.0);

                  // CMYK\u306E\u8272\u306E\u6DF7\u5408
                  var result = vec3f(1.0);

                  if (cyan.r < 1.0) {
                      result.r *= cyan.r;
                      result.g = min(result.g + (1.0 - cyan.r) * 0.3, 1.0);
                      result.b = min(result.b + (1.0 - cyan.r) * 0.3, 1.0);
                  }

                  if (magenta.g < 1.0) {
                      result.g *= magenta.g;
                      result.r = min(result.r + (1.0 - magenta.g) * 0.3, 1.0);
                      result.b = min(result.b + (1.0 - magenta.b) * 0.3, 1.0);
                  }

                  if (yellow.b < 1.0) {
                      result.b *= yellow.b;
                      result.r = min(result.r + (1.0 - yellow.b) * 0.3, 1.0);
                      result.g = min(result.g + (1.0 - yellow.b) * 0.3, 1.0);
                  }

                  if (black.r < 0.1) {
                      let k = 1.0 - (black.r + black.g + black.b) / 3.0;
                      result *= (1.0 - k);
                  }

                  effectColor = vec4f(result * a, a);
              }

              var finalColor: vec4f;
              if (params.blendMode == 0u) {
                  finalColor = mix(originalColor, effectColor, params.opacity);
              } else {
                  finalColor = mix(effectColor, originalColor, 1.0 - params.opacity);
              }

              textureStore(resultTexture, id.xy, finalColor);
          }
      `
    });
    device.addEventListener("uncapturederror", (e) => {
      console.error(e.error);
    });
    const pipeline = device.createComputePipeline({
      label: "Chromatic Aberration Pipeline",
      layout: "auto",
      compute: {
        module: shader,
        entryPoint: "computeMain"
      }
    });
    return { device, pipeline };
  },
  doLiveEffect: async ({ device, pipeline }, params, imgData) => {
    console.log("Chromatic Aberration V1", params, imgData);
    const orignalSize = { width: imgData.width, height: imgData.height };
    imgData = await adjustImageToNearestAligned256Resolution(imgData);
    const texture = device.createTexture({
      label: "Input Texture",
      size: [imgData.width, imgData.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
    });
    const resultTexture = device.createTexture({
      label: "Result Texture",
      size: [imgData.width, imgData.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
    });
    const sampler = device.createSampler({
      label: "Texture Sampler",
      magFilter: "linear",
      minFilter: "linear"
    });
    const uniformBuffer = device.createBuffer({
      label: "Params Buffer",
      size: 20,
      // float + float + uint + float + uint
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const bindGroup = device.createBindGroup({
      label: "Main Bind Group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView()
        },
        {
          binding: 1,
          resource: resultTexture.createView()
        },
        {
          binding: 2,
          resource: sampler
        },
        {
          binding: 3,
          resource: { buffer: uniformBuffer }
        }
      ]
    });
    const stagingBuffer = device.createBuffer({
      label: "Staging Buffer",
      size: imgData.width * imgData.height * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const uniformData = new ArrayBuffer(20);
    new Float32Array(uniformData, 0, 1)[0] = params.strength;
    new Float32Array(uniformData, 4, 1)[0] = params.angle;
    new Uint32Array(uniformData, 8, 1)[0] = params.colorMode === "RGB" ? 0 : 1;
    new Float32Array(uniformData, 12, 1)[0] = params.opacity / 100;
    new Uint32Array(uniformData, 16, 1)[0] = 0;
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    device.queue.writeTexture(
      { texture },
      imgData.data,
      { bytesPerRow: imgData.width * 4, rowsPerImage: imgData.height },
      [imgData.width, imgData.height]
    );
    const commandEncoder = device.createCommandEncoder({
      label: "Main Command Encoder"
    });
    const computePass = commandEncoder.beginComputePass({
      label: "Chromatic Aberration Compute Pass"
    });
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(
      Math.ceil(imgData.width / 16),
      Math.ceil(imgData.height / 16)
    );
    computePass.end();
    commandEncoder.copyTextureToBuffer(
      { texture: resultTexture },
      { buffer: stagingBuffer, bytesPerRow: imgData.width * 4 },
      [imgData.width, imgData.height]
    );
    device.queue.submit([commandEncoder.finish()]);
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const copyArrayBuffer = stagingBuffer.getMappedRange();
    const resultData = new Uint8Array(copyArrayBuffer.slice(0));
    stagingBuffer.unmap();
    const resultImageData = new ImageData(
      new Uint8ClampedArray(resultData),
      imgData.width,
      imgData.height
    );
    return await resizeImageData(
      resultImageData,
      orignalSize.width,
      orignalSize.height
    );
  }
});

// src/js/src/live-effects/effects.ts
var randomNoiseEffect = {
  id: "randomNoise-v1",
  title: "Random Noise V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: 2 /* kPostEffectFilter */,
    features: []
  },
  paramSchema: {},
  doLiveEffect: async (params, input) => {
    const buffer = input.data;
    console.log("Deno code running", buffer.byteLength / 4, buffer);
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = Math.random() * 255;
      buffer[i + 1] = Math.random() * 255;
      buffer[i + 2] = Math.random() * 255;
      buffer[i + 3] = i > 2e3 ? 0 : 255;
    }
    return input;
  },
  editLiveEffectParameters: () => "{}",
  renderUI: (params) => ui.group({}, [])
};

// src/js/src/main.ts
import { expandGlobSync, ensureDir } from "jsr:@std/fs@1.0.14";
import { toFileUrl, join } from "jsr:@std/path@1.0.8";
import { homedir } from "node:os";
var EFFECTS_DIR = new URL(toFileUrl(join(homedir(), ".deno_ai/effects")));
var allEffects = [
  randomNoiseEffect,
  blurEffect,
  chromaticAberration
];
var effectInits = /* @__PURE__ */ new Map();
await Promise.all(
  allEffects.map(async (effect) => {
    var _a;
    effectInits.set(effect, await ((_a = effect.initDoLiveEffect) == null ? void 0 : _a.call(effect)));
  })
);
var loadEffects = async () => {
  console.log("[deno_ai(js)] loadEffects", EFFECTS_DIR);
  await ensureDir(EFFECTS_DIR);
  console.log("[deno_ai(js)] loadEffects ensuredir");
  const metas = [
    ...expandGlobSync(`${EFFECTS_DIR}/*/meta.json`, {
      followSymlinks: true,
      includeDirs: false
    })
  ];
  await Promise.allSettled(
    metas.map((dir) => {
      console.log("dir", dir);
    })
  );
};
var getLiveEffects = () => {
  return allEffects.map((effect) => ({
    id: effect.id,
    title: effect.title,
    version: effect.version
  }));
};
var getEffectViewNode = (id, state) => {
  const effect = findEffect(id);
  if (!effect) return null;
  console.log("getEffectViewNode", id, state);
  const defaultValues = getDefaultValus(id);
  try {
    return effect.renderUI({
      ...defaultValues,
      ...state
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
};
var doLiveEffect = async (id, state, width, height, data) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);
  const init = effectInits.get(effect);
  if (!init) {
    console.error("Effect not initialized", id);
    return null;
  }
  console.log("[deno_ai(js)] doLiveEffect", id, state, width, height);
  try {
    const result = await effect.doLiveEffect(
      init,
      {
        ...defaultValues,
        ...state
      },
      {
        width,
        height,
        data
      }
    );
    if (typeof result.width !== "number" || typeof result.height !== "number" || !(result.data instanceof Uint8ClampedArray)) {
      throw new Error("Invalid result from doLiveEffect");
    }
    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
var getDefaultValus = (effectId) => {
  const effect = findEffect(effectId);
  if (!effect) return null;
  return Object.fromEntries(
    Object.entries(effect.paramSchema).map(([key, value]) => [
      key,
      structuredClone(value.default)
    ])
  );
};
var findEffect = (id) => {
  const effect = allEffects.find((e) => e.id === id);
  if (!effect) console.error(`Effect not found: ${id}`);
  return effect;
};
export {
  doLiveEffect,
  getEffectViewNode,
  getLiveEffects,
  loadEffects
};
