// src/js/src/main.ts
import { expandGlobSync, ensureDirSync } from "jsr:@std/fs@1.0.14";
import { toFileUrl, join, fromFileUrl } from "jsr:@std/path@1.0.8";
import { homedir } from "node:os";

// src/js/src/types.ts
function definePlugin(plugin) {
  return plugin;
}

// src/js/src/ui.ts
var ui = {
  group: ({ direction = "row" }, children) => ({
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
  }),
  select: (props) => ({
    ...props,
    selectedIndex: props.options.indexOf(props.value),
    type: "select"
  }),
  separator: () => ({
    type: "separator"
  })
};

// src/js/src/live-effects/utils.ts
import { decodeBase64 } from "jsr:@std/encoding@1.0.7";
var createCanvasImpl = typeof window === "undefined" ? async (width, height) => {
  const { createCanvas } = await import("jsr:@gfx/canvas");
  return createCanvas(width, height);
} : async (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
var createImageDataImpl = typeof window === "undefined" ? async (data, width, height, settings) => {
  const { ImageData: ImageData2 } = await import("jsr:@gfx/canvas");
  return new ImageData2(data, width, height, settings);
} : async (data, width, height, settings) => {
  return new ImageData(
    data,
    width,
    height,
    settings
  );
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
  const canvas = await createCanvasImpl(data.width, data.height);
  const ctx = canvas.getContext("2d");
  const imgData = await createImageDataImpl(
    data.data,
    data.width,
    data.height,
    {
      colorSpace: "srgb"
    }
  );
  ctx.putImageData(imgData, 0, 0);
  const resizedCanvas = await createCanvasImpl(width, height);
  const resizedCtx = resizedCanvas.getContext("2d");
  resizedCtx.drawImage(canvas, 0, 0, width, height);
  return resizedCtx.getImageData(0, 0, width, height);
}
async function paddingImageData(data, padding) {
  const width = data.width + padding * 2;
  const height = data.height + padding * 2;
  const canvas = await createCanvasImpl(width, height);
  const ctx = canvas.getContext("2d");
  const imgData = await createImageDataImpl(
    data.data,
    data.width,
    data.height,
    {
      colorSpace: "srgb"
    }
  );
  ctx.putImageData(imgData, padding, padding);
  return ctx.getImageData(0, 0, width, height);
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
      enum: ["rgb", "cmyk"],
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
      default: 100
    },
    blendMode: {
      type: "string",
      enum: ["over", "under"],
      default: "under"
    },
    padding: {
      type: "int",
      default: 0
    }
  },
  editLiveEffectParameters: (params) => JSON.stringify(params),
  renderUI: (params) => {
    return ui.group({ direction: "col" }, [
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Color Mode"}),
        ui.select({ key: "colorMode", label: "Color Mode", value: params.colorMode, options: ["rgb", "cmyk"] })
      ]),
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Strength"}),
        ui.slider({ key: "strength", label: "Strength", dataType: "float", min: 0, max: 200, value: params.strength })
      ]),
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Angle"}),
        ui.slider({ key: "angle", label: "Angle", dataType: "float", min: 0, max: 360, value: params.angle })
      ]),
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Opacity"}),
        ui.slider({ key: "opacity", label: "Opacity", dataType: "float", min: 0, max: 100, value: params.opacity })
      ]),
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Blend Mode"}),
        ui.select({ key: "blendMode", label: "Blend Mode", value: params.blendMode, options: ["over", "under"] })
      ]),
      ui.separator(),
      ui.group({ direction: "col" }, [
        ui.text({ text: "Debugging parameters" }),
        ui.slider({ key: "padding", label: "Padding", dataType: "int", min: 0, max: 200, value: params.padding })
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

          fn screenBlend(a: f32, b: f32) -> f32 {
              return 1.0 - (1.0 - a) * (1.0 - b);
          }

          // RGB \u304B\u3089 CMYK \u3078\u306E\u5909\u63DB\u95A2\u6570
          fn rgbToCmyk(rgb: vec3f) -> vec4f {
              let r = rgb.r;
              let g = rgb.g;
              let b = rgb.b;

              let k = 1.0 - max(max(r, g), b);

              // \u9ED2\u304C1.0\uFF08\u5B8C\u5168\u306A\u9ED2\uFF09\u306E\u5834\u5408\u3001\u4ED6\u306E\u30C1\u30E3\u30F3\u30CD\u30EB\u306F0\u306B
              if (k == 1.0) {
                  return vec4f(0.0, 0.0, 0.0, 1.0);
              }

              let c = (1.0 - r - k) / (1.0 - k);
              let m = (1.0 - g - k) / (1.0 - k);
              let y = (1.0 - b - k) / (1.0 - k);

              return vec4f(c, m, y, k);
          }

          // CMYK \u304B\u3089 RGB \u3078\u306E\u5909\u63DB\u95A2\u6570
          fn cmykToRgb(cmyk: vec4f) -> vec3f {
              let c = cmyk.x;
              let m = cmyk.y;
              let y = cmyk.z;
              let k = cmyk.w;

              let r = (1.0 - c) * (1.0 - k);
              let g = (1.0 - m) * (1.0 - k);
              let b = (1.0 - y) * (1.0 - k);

              return vec3f(r, g, b);
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // strength\u3092\u30D4\u30AF\u30BB\u30EB\u5358\u4F4D\u3068\u3057\u3066\u51E6\u7406\u3057\u3001\u30C6\u30AF\u30B9\u30C1\u30E3\u5EA7\u6A19\u306B\u5909\u63DB
              let pixelOffset = getOffset(params.angle) * params.strength;
              let texOffset = pixelOffset / dims;

              var effectColor: vec4f;
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              if (params.colorMode == 0u) { // RGB mode
                  let redOffset = texCoord + texOffset;
                  let blueOffset = texCoord - texOffset;

                  let redSample = textureSampleLevel(inputTexture, textureSampler, redOffset, 0.0);
                  let greenSample = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);
                  let blueSample = textureSampleLevel(inputTexture, textureSampler, blueOffset, 0.0);

                  let r = redSample.r;
                  let g = greenSample.g;
                  let b = blueSample.b;

                  let a_red = redSample.a;
                  let a_green = greenSample.a;
                  let a_blue = blueSample.a;

                  let a = screenBlend(screenBlend(a_red, a_green), a_blue);

                  effectColor = vec4f(r, g, b, a);
              } else { // CMYK mode
                  let cyanOffset = texCoord + texOffset;
                  let magentaOffset = texCoord + vec2f(-texOffset.y, texOffset.x) * 0.866;
                  let yellowOffset = texCoord + vec2f(-texOffset.x, -texOffset.y);
                  let blackOffset = texCoord - vec2f(-texOffset.y, texOffset.x) * 0.866;

                  let cyanSample = textureSampleLevel(inputTexture, textureSampler, cyanOffset, 0.0);
                  let magentaSample = textureSampleLevel(inputTexture, textureSampler, magentaOffset, 0.0);
                  let yellowSample = textureSampleLevel(inputTexture, textureSampler, yellowOffset, 0.0);
                  let blackSample = textureSampleLevel(inputTexture, textureSampler, blackOffset, 0.0);

                  // \u5404\u30B5\u30F3\u30D7\u30EB\u3092CMYK\u306B\u5909\u63DB
                  let cyanCmyk = rgbToCmyk(cyanSample.rgb);
                  let magentaCmyk = rgbToCmyk(magentaSample.rgb);
                  let yellowCmyk = rgbToCmyk(yellowSample.rgb);
                  let blackCmyk = rgbToCmyk(blackSample.rgb);

                  // CMYK\u5404\u30C1\u30E3\u30F3\u30CD\u30EB\u306E\u5206\u96E2
                  let c = cyanCmyk.x;        // \u30B7\u30A2\u30F3\u306E\u307F\u3092\u4F7F\u7528
                  let m = magentaCmyk.y;     // \u30DE\u30BC\u30F3\u30BF\u306E\u307F\u3092\u4F7F\u7528
                  let y = yellowCmyk.z;      // \u30A4\u30A8\u30ED\u30FC\u306E\u307F\u3092\u4F7F\u7528
                  let k = blackCmyk.w;       // \u30D6\u30E9\u30C3\u30AF\u306E\u307F\u3092\u4F7F\u7528

                  // \u5408\u6210CMYK\u5024\u3092\u4F5C\u6210
                  let finalCmyk = vec4f(c, m, y, k);

                  // CMYK\u304B\u3089RGB\u306B\u5909\u63DB
                  let result = cmykToRgb(finalCmyk);

                  // \u30A2\u30EB\u30D5\u30A1\u5024\u306E\u8A08\u7B97
                  let a_cyan = cyanSample.a;
                  let a_magenta = magentaSample.a;
                  let a_yellow = yellowSample.a;
                  let a_black = blackSample.a;

                  let a = screenBlend(screenBlend(screenBlend(a_cyan, a_magenta), a_yellow), a_black);

                  effectColor = vec4f(result, a);
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
    device.addEventListener("lost", (e) => {
      console.error(e);
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
    console.log("Chromatic Aberration V1", params);
    const padImg = await paddingImageData(imgData, params.padding);
    imgData = await adjustImageToNearestAligned256Resolution(padImg);
    const width = imgData.width, height = imgData.height;
    const texture = device.createTexture({
      label: "Input Texture",
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
    });
    const resultTexture = device.createTexture({
      label: "Result Texture",
      size: [width, height],
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
      size: width * height * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const uniformData = new ArrayBuffer(20);
    new Float32Array(uniformData, 0, 1)[0] = params.strength;
    new Float32Array(uniformData, 4, 1)[0] = params.angle;
    new Uint32Array(uniformData, 8, 1)[0] = params.colorMode === "rgb" ? 0 : 1;
    new Float32Array(uniformData, 12, 1)[0] = params.opacity / 100;
    new Uint32Array(uniformData, 16, 1)[0] = 0;
    new Uint32Array(uniformData, 16, 1)[0] = params.blendMode === "over" ? 0 : 1;
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    device.queue.writeTexture(
      { texture },
      imgData.data,
      { bytesPerRow: width * 4, rowsPerImage: height },
      [width, height]
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
      Math.ceil(width / 16),
      Math.ceil(height / 16)
    );
    computePass.end();
    commandEncoder.copyTextureToBuffer(
      { texture: resultTexture },
      { buffer: stagingBuffer, bytesPerRow: width * 4 },
      [width, height]
    );
    device.queue.submit([commandEncoder.finish()]);
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const copyArrayBuffer = stagingBuffer.getMappedRange();
    const resultData = new Uint8Array(copyArrayBuffer.slice(0));
    stagingBuffer.unmap();
    const resultImageData = new ImageData(
      new Uint8ClampedArray(resultData),
      width,
      height
    );
    return await resizeImageData(resultImageData, padImg.width, padImg.height);
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

// src/js/src/live-effects/test-blue-fill.ts
var testBlueFill = definePlugin({
  id: "test-blue-fill",
  title: "Test Blue Fill",
  version: { major: 1, minor: 0 },
  paramSchema: {
    useNewBuffer: {
      type: "bool",
      default: false
    },
    fillOtherChannels: {
      type: "bool",
      default: false
    },
    padding: {
      type: "int",
      default: 0
    },
    opacity: {
      type: "real",
      default: 100
    }
  },
  styleFilterFlags: {
    main: 2 /* kPostEffectFilter */,
    features: []
  },
  editLiveEffectParameters: () => "{}",
  doLiveEffect: async (init, params, input) => {
    let width = input.width;
    let height = input.height;
    let len = input.data.length;
    const alpha = Math.round(255 * (params.opacity / 100));
    let buffer = params.useNewBuffer ? Uint8ClampedArray.from(input.data) : input.data;
    if (params.padding > 0) {
      const data = await paddingImageData(
        {
          data: buffer,
          width: input.width,
          height: input.height
        },
        params.padding
      );
      buffer = data.data;
      len = buffer.length;
      width = data.width;
      height = data.height;
    }
    if (params.fillOtherChannels) {
      for (let i = 0; i < len; i += 4) {
        buffer[i] = 0;
        buffer[i + 1] = 0;
        buffer[i + 2] = 255;
        buffer[i + 3] = alpha;
      }
    } else {
      for (let i = 0; i < len; i += 4) {
        buffer[i + 2] = 255;
        buffer[i + 3] = alpha;
      }
    }
    return {
      data: buffer,
      width,
      height
    };
  },
  renderUI: (params) => ui.group({ direction: "col" }, [
    ui.checkbox({
      label: "Use new buffer",
      key: "useNewBuffer",
      value: params.useNewBuffer
    }),
    ui.checkbox({
      label: "Fill other channels",
      key: "fillOtherChannels",
      value: params.fillOtherChannels
    }),
    ui.slider({
      label: "Padding",
      key: "padding",
      dataType: "int",
      min: 0,
      max: 100,
      value: params.padding
    }),
    ui.slider({
      label: "Opacity",
      key: "opacity",
      dataType: "float",
      min: 0,
      max: 100,
      value: params.opacity
    })
  ])
});

// src/js/src/main.ts
var EFFECTS_DIR = new URL(toFileUrl(join(homedir(), ".ai-deno/effects")));
var allEffects = [
  randomNoiseEffect,
  // blurEffect,
  chromaticAberration,
  testBlueFill
];
var effectInits = /* @__PURE__ */ new Map();
await Promise.all(
  allEffects.map(async (effect) => {
    var _a;
    effectInits.set(effect, await ((_a = effect.initDoLiveEffect) == null ? void 0 : _a.call(effect)) ?? {});
  })
);
var loadEffects = async () => {
  ensureDirSync(EFFECTS_DIR);
  console.log(
    "[deno_ai(js)] loadEffects",
    `${fromFileUrl(EFFECTS_DIR)}/*/meta.json`
  );
  const metas = [
    ...expandGlobSync(`${fromFileUrl(EFFECTS_DIR)}/*/meta.json`, {
      followSymlinks: true,
      includeDirs: false
    })
  ];
  console.log("[deno_ai(js)] loadEffects metas", metas);
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
