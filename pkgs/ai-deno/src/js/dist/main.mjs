// src/js/src/main.ts
import { expandGlobSync, ensureDirSync } from "jsr:@std/fs@1.0.14";
import { toFileUrl as toFileUrl2, join as join2, fromFileUrl } from "jsr:@std/path@1.0.8";
import { isEqual } from "jsr:@es-toolkit/es-toolkit@1.33.0";
import { homedir } from "node:os";

// src/js/src/live-effects/chromatic-aberration.ts
import {
  makeShaderDataDefinitions,
  makeStructuredView
} from "npm:webgpu-utils";

// src/js/src/types.ts
function definePlugin(plugin) {
  return plugin;
}

// src/js/src/ui/nodes.ts
var ui = {
  group: ({ direction = "row" }, children) => ({
    type: "group",
    direction,
    children
  }),
  button: (props) => ({
    ...props,
    type: "button"
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
  numberInput: (props) => ({
    ...props,
    type: "numberInput"
  }),
  colorInput: (props) => ({
    ...props,
    type: "colorInput"
  }),
  text: (props) => ({
    ...props,
    type: "text"
  }),
  select: (props) => ({
    ...props,
    selectedIndex: props.options.findIndex(
      (option) => option.value === props.value
    ),
    type: "select"
  }),
  separator: () => ({
    type: "separator"
  })
};

// src/js/src/ui/locale.ts
var texts = (t9) => t9;
function createTranslator(texts2) {
  const locale = getLocale(Object.keys(texts2), "en");
  return (key, params = {}) => {
    var _a;
    const text = (_a = texts2[locale]) == null ? void 0 : _a[key];
    if (!text) return key;
    return text.replace(/\{\{(.+?)\}\}/g, (_, key2) => {
      const value = params[key2];
      return value == null ? "" : String(value);
    });
  };
}
function getLocale(acceptLocales, fallbackLocale) {
  const userLocale = navigator.language.split("-")[0];
  if (acceptLocales.includes(userLocale)) {
    return userLocale;
  }
  return fallbackLocale;
}

// src/js/src/live-effects/_utils.ts
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
async function toBlob(canvas, mime, quality) {
  if (typeof window === "undefined") {
    mime = mime.replace(/^image\//, "");
    const b64 = canvas.toDataURL(mime, quality).split(",")[1];
    const buffer = decodeBase64(b64);
    return new Blob([buffer], { type: mime });
  } else {
    return new Promise((r) => {
      canvas.toBlob((b) => r(b), mime, quality);
    });
  }
}
function getNearestAligned256Resolution(width, height, bytesPerPixel = 4) {
  const currentBytesPerRow = width * bytesPerPixel;
  const targetBytesPerRow = Math.ceil(currentBytesPerRow / 256) * 256;
  const newWidth = Math.round(targetBytesPerRow / bytesPerPixel);
  return {
    width: newWidth,
    height
  };
}
async function addWebGPUAlignmentPadding(imageDataLike) {
  const { width, height } = imageDataLike;
  const { width: newWidth, height: newHeight } = getNearestAligned256Resolution(
    width,
    height
  );
  if (newWidth === width && newHeight === height) {
    return imageDataLike;
  }
  const canvas = await createCanvasImpl(newWidth, newHeight);
  const ctx = canvas.getContext("2d");
  const imgData = await createImageDataImpl(imageDataLike.data, width, height);
  ctx.putImageData(imgData, 0, 0);
  return ctx.getImageData(0, 0, newWidth, newHeight);
}
async function removeWebGPUAlignmentPadding(imageDataLike, originalWidth, originalHeight) {
  const { width, height } = imageDataLike;
  const canvas = await createCanvasImpl(originalWidth, originalHeight);
  const ctx = canvas.getContext("2d");
  const imgData = await createImageDataImpl(imageDataLike.data, width, height);
  ctx.putImageData(imgData, 0, 0);
  return ctx.getImageData(0, 0, originalWidth, originalHeight);
}
async function paddingImageData(data, padding) {
  padding = Math.ceil(padding);
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
async function toPng(imgData) {
  const canvas = await createCanvasImpl(imgData.width, imgData.height);
  const ctx = canvas.getContext("2d");
  const img = await createImageDataImpl(
    imgData.data,
    imgData.width,
    imgData.height
  );
  ctx.putImageData(img, 0, 0);
  return toBlob(canvas, "image/png", 100);
}
function lerp(a, b, t9) {
  return a + (b - a) * t9;
}
function parseColorCode(color) {
  const hex = (color.startsWith("#") ? color.slice(1) : color).toUpperCase();
  if (!/^[0-9A-F]{3}$|^[0-9A-F]{4}$|^[0-9A-F]{6}$|^[0-9A-F]{8}$/.test(hex)) {
    return null;
  }
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;
    return { r, g, b, a: 1 };
  }
  if (hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;
    const a = parseInt(hex[3] + hex[3], 16) / 255;
    return { r, g, b, a };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r, g, b, a: 1 };
  }
  if (hex.length === 8) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const a = parseInt(hex.substring(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  return null;
}
function toColorCode(color, includeHash = false) {
  const r = Math.round(color.r * 255).toString(16).padStart(2, "0");
  const g = Math.round(color.g * 255).toString(16).padStart(2, "0");
  const b = Math.round(color.b * 255).toString(16).padStart(2, "0");
  const prefix = includeHash ? "#" : "";
  if (color.a === 1) {
    return `${prefix}${r}${g}${b}`.toLowerCase();
  }
  const a = Math.round(color.a * 255).toString(16).padStart(2, "0");
  return `${prefix}${r}${g}${b}${a}`.toLowerCase();
}

// src/js/src/logger.ts
var _AI_DENO_2 = globalThis._AI_DENO_ ?? {
  op_aideno_debug_enabled: () => true,
  op_ai_alert: () => {
  }
};
var enableLogger = _AI_DENO_2.op_aideno_debug_enabled();
console.log("[deno_ai(js)] enableLogger", enableLogger);
var logger = {
  log: (...args) => {
    if (!enableLogger) return;
    console.log("[deno_ai(js)]", ...args);
  },
  info: (...args) => {
    if (!enableLogger) return;
    console.info("[deno_ai(js)]", ...args);
  },
  error: (...args) => {
    if (!enableLogger) return;
    console.error("[deno_ai(js)]", ...args);
  },
  time: (label) => {
    if (!enableLogger) return;
    console.time(label);
  },
  timeEnd: (label) => {
    if (!enableLogger) return;
    console.timeEnd(label);
  }
};

// src/js/src/live-effects/_shared.ts
async function createGPUDevice(options = {}, initializer) {
  var _a;
  let deviceRef = null;
  let inits = null;
  const init = async () => {
    var _a2;
    const adapter = await navigator.gpu.requestAdapter(options.adapter);
    if (!adapter) {
      throw new Error("No adapter found");
    }
    const device = await adapter.requestDevice({
      ...options.device,
      requiredLimits: {
        ...(_a2 = options.device) == null ? void 0 : _a2.requiredLimits,
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D
      }
    });
    device.addEventListener("uncapturederror", (e) => {
      console.error(e.error);
    });
    inits = await initializer(device);
    return device;
  };
  deviceRef = await init();
  logger.info("Create GPU Device: ", ((_a = options.device) == null ? void 0 : _a.label) ?? "<<unnamed>>");
  return new Proxy(
    {},
    {
      get(_, key) {
        if (key === "device") {
          return deviceRef;
        }
        return Reflect.get(inits, key);
      },
      has(_, p) {
        return Reflect.has(inits, p);
      }
    }
  );
}

// src/js/src/live-effects/chromatic-aberration.ts
var t = createTranslator(
  texts({
    en: {
      title: "Chromatic Aberration V1",
      colorMode: "Color Mode",
      strength: "Strength",
      angle: "Angle",
      opacity: "Opacity",
      blendMode: "Blend Mode",
      blendOver: "Over",
      blendeUnder: "Under",
      debuggingParameters: "Debugging parameters",
      padding: "Padding"
    },
    ja: {
      title: "\u8272\u53CE\u5DEE V1",
      colorMode: "\u30AB\u30E9\u30FC\u30E2\u30FC\u30C9",
      strength: "\u5F37\u5EA6",
      angle: "\u89D2\u5EA6",
      opacity: "\u4E0D\u900F\u660E\u5EA6",
      blendMode: "\u30D6\u30EC\u30F3\u30C9\u30E2\u30FC\u30C9",
      blendOver: "\u4E0A\u306B\u5408\u6210",
      blendeUnder: "\u4E0B\u306B\u5408\u6210",
      debuggingParameters: "\u30C7\u30D0\u30C3\u30B0\u30D1\u30E9\u30E1\u30FC\u30BF",
      padding: "\u30D1\u30C7\u30A3\u30F3\u30B0"
    }
  })
);
var chromaticAberration = definePlugin({
  id: "chromatic-aberration-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
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
      }
    },
    onEditParameters: (params) => params,
    onAdjustColors: (params, adjustColor) => params,
    onInterpolate: (params, paramsB, progress) => ({
      colorMode: params.colorMode,
      strength: lerp(params.strength, paramsB.strength, progress),
      angle: lerp(params.angle, paramsB.angle, progress),
      opacity: lerp(params.opacity, paramsB.opacity, progress),
      blendMode: params.blendMode
    }),
    onScaleParams: (params, scale) => ({
      colorMode: params.colorMode,
      strength: params.strength * scale,
      angle: params.angle,
      opacity: params.opacity,
      blendMode: params.blendMode
    }),
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorMode") }),
          ui.select({ key: "colorMode", value: params.colorMode, options: [
            { value: "rgb", label: "RGB" },
            { value: "cmyk", label: "CMYK" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.slider({ key: "strength", dataType: "float", min: 0, max: 200, value: params.strength })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("angle") }),
          ui.slider({ key: "angle", dataType: "float", min: 0, max: 360, value: params.angle })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("opacity") }),
          ui.slider({ key: "opacity", dataType: "float", min: 0, max: 100, value: params.opacity })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Blend Mode" }),
          ui.select({ key: "blendMode", value: params.blendMode, options: [
            { value: "over", label: t("blendOver") },
            { value: "under", label: t("blendeUnder") }
          ] })
        ])
        // ui.separator(),
        // ui.group({ direction: "col" }, [
        //   ui.text({ text: "Debugging parameters" }),
        //   ui.slider({ key: "padding", label: "Padding", dataType: 'int', min: 0, max: 200, value: params.padding }),
        // ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, async (device) => {
        const code = `
          struct Params {
            dpi: f32,
            baseDpi: f32,
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
              let pixelOffset = getOffset(params.angle) * params.strength * (params.dpi / params.baseDpi);
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
      `;
        const shader = device.createShaderModule({
          label: "Chromatic Aberration Shader",
          code
        });
        const defs = makeShaderDataDefinitions(code);
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
        return { device, pipeline, defs };
      });
    },
    goLiveEffect: async ({ device, pipeline, defs }, params, imgData, env) => {
      console.log("Chromatic Aberration V1", params);
      const dpiScale = env.dpi / env.baseDpi;
      imgData = await paddingImageData(
        imgData,
        Math.ceil(params.strength * dpiScale)
      );
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const width = imgData.width;
      const height = imgData.height;
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
      const uniformValues = makeStructuredView(defs.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        dpi: env.dpi,
        baseDpi: env.baseDpi,
        strength: params.strength,
        angle: params.angle,
        colorMode: params.colorMode === "rgb" ? 0 : 1,
        opacity: params.opacity / 100,
        blendMode: params.blendMode === "over" ? 0 : 1
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
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: width * height * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
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
      const resultImageData = await removeWebGPUAlignmentPadding(
        new ImageData(new Uint8ClampedArray(resultData), width, height),
        outputWidth,
        outputHeight
      );
      return resultImageData;
    }
  }
});

// src/js/src/live-effects/test-blue-fill.ts
import { toFileUrl, join } from "jsr:@std/path@1.0.8";
var global = {
  lastInput: null,
  inputSize: null
};
var testBlueFill = definePlugin({
  id: "test-blue-fill",
  title: "Test Blue Fill",
  version: { major: 1, minor: 0 },
  liveEffect: {
    paramSchema: {
      useNewBuffer: {
        type: "bool",
        default: false
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 1, a: 1 }
      },
      fillOtherChannels: {
        type: "bool",
        default: false
      },
      passThrough: {
        type: "bool",
        default: false
      },
      fullTransparent: {
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
      },
      count: {
        type: "int",
        default: 0
      }
    },
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    onAdjustColors: (params, adjustColor) => params,
    onEditParameters: (params) => params,
    onScaleParams: (params, scaleFactor) => params,
    onInterpolate: (paramsA, paramsB, t9) => paramsA,
    goLiveEffect: async (init, params, input) => {
      let width = input.width;
      let height = input.height;
      let len = input.data.length;
      global.lastInput = {
        data: Uint8ClampedArray.from(input.data),
        width,
        height
      };
      global.inputSize = { width, height };
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
      if (params.passThrough) {
        return {
          data: buffer,
          width,
          height
        };
      }
      if (params.fullTransparent) {
        for (let i = 0; i < len; i += 4) {
          buffer[i + 3] = 0;
        }
        return {
          data: buffer,
          width,
          height
        };
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
    renderUI: (params, setParam) => {
      var _a, _b;
      const onClickSaveInputAsPng = async () => {
        if (!global.lastInput) {
          _AI_DENO_.op_ai_alert("No input data");
          return;
        }
        const path = new URL(
          "./test-blue-fill.png",
          toFileUrl(join(Deno.cwd(), "./"))
        );
        const png = await toPng(global.lastInput);
        Deno.writeFile(path, new Uint8Array(await png.arrayBuffer()));
        _AI_DENO_.op_ai_alert(`Saved to ${path}`);
      };
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.button({
            text: "Update view",
            onClick: () => {
              setParam((prev) => {
                return { count: prev.count + 1 };
              });
            }
          }),
          ui.button({
            text: "Save input as PNG",
            onClick: onClickSaveInputAsPng
          }),
          ui.button({
            text: "Alert",
            onClick: () => {
              console.log("Hello");
            }
          })
        ]),
        ui.group({ direction: "row" }, [
          ui.text({
            text: `Input: ${(_a = global.inputSize) == null ? void 0 : _a.width}x${(_b = global.inputSize) == null ? void 0 : _b.height}`
          }),
          ui.text({ text: `Count: ${params.count}` })
        ]),
        ui.group({ direction: "row" }, [
          // ui.text({ text: "Use new buffer" }),
          ui.checkbox({
            label: "Use new buffer",
            key: "useNewBuffer",
            value: params.useNewBuffer
          }),
          // ui.text({ text: "Fill other channels" }),
          ui.checkbox({
            key: "fillOtherChannels",
            label: "Fill other channels",
            value: params.fillOtherChannels
          })
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "passThrough",
            label: "Pass through",
            value: params.passThrough
          }),
          ui.checkbox({
            key: "fullTransparent",
            label: "Full transparent",
            value: params.fullTransparent
          })
        ]),
        ui.text({ text: "Color" }),
        ui.colorInput({
          key: "color",
          value: params.color
        }),
        ui.text({ text: "Padding" }),
        ui.group({ direction: "row" }, [
          ui.slider({
            key: "padding",
            dataType: "int",
            min: 0,
            max: 100,
            value: params.padding
          }),
          ui.numberInput({
            dataType: "int",
            key: "padding",
            value: params.padding,
            min: 0,
            max: 100,
            step: 1
          })
        ]),
        ui.text({ text: "Opacity" }),
        ui.slider({
          key: "opacity",
          dataType: "float",
          min: 0,
          max: 100,
          value: params.opacity
        }),
        ui.textInput({ value: "Hello" })
      ]);
    }
  }
});

// src/js/src/live-effects/directional-blur.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions2,
  makeStructuredView as makeStructuredView2
} from "npm:webgpu-utils";
var t2 = createTranslator({
  en: {
    title: "Directional Blur",
    strength: "Size (px)",
    direction: "Direction",
    opacity: "Opacity",
    blurMode: "Blur Mode",
    behind: "Behind",
    front: "Front",
    both: "Both",
    fadeScale: "Scale to fade",
    fadeDirection: "Direction to fade"
  },
  ja: {
    title: "\u65B9\u5411\u6027\u30D6\u30E9\u30FC",
    strength: "\u5927\u304D\u3055 (px)",
    direction: "\u65B9\u5411",
    opacity: "\u4E0D\u900F\u660E\u5EA6",
    blurMode: "\u30D6\u30E9\u30FC\u30E2\u30FC\u30C9",
    behind: "\u5F8C\u65B9",
    front: "\u524D\u65B9",
    both: "\u4E21\u65B9",
    fadeScale: "\u7E2E\u5C0F\u7387",
    fadeDirection: "\u7E2E\u5C0F\u65B9\u5411"
  }
});
var directionalBlur = definePlugin({
  id: "directional-blur-v1",
  title: "Directional Blur V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      strength: {
        type: "real",
        default: 5
      },
      angle: {
        type: "real",
        default: 0
      },
      opacity: {
        type: "real",
        default: 100
      },
      blurMode: {
        type: "string",
        enum: ["both", "behind", "front"],
        default: "both"
      },
      fadeOut: {
        type: "real",
        default: 0
      },
      fadeDirection: {
        type: "real",
        default: 0
      }
    },
    onEditParameters: (params) => params,
    onInterpolate: (a, b, progress) => {
      return {
        strength: lerp(a.strength, b.strength, progress),
        angle: lerp(a.angle, b.angle, progress),
        opacity: lerp(a.opacity, b.opacity, progress),
        blurMode: b.blurMode,
        fadeOut: lerp(a.fadeOut, b.fadeOut, progress),
        fadeDirection: lerp(a.fadeDirection, b.fadeDirection, progress)
      };
    },
    onScaleParams: (params, scale) => {
      return {
        strength: params.strength * scale,
        angle: params.angle,
        opacity: params.opacity,
        blurMode: params.blurMode,
        fadeOut: params.fadeOut,
        fadeDirection: params.fadeDirection
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("strength") }),
          ui.slider({
            key: "strength",
            dataType: "float",
            min: 0,
            max: 500,
            value: params.strength
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("direction") }),
          ui.slider({
            key: "angle",
            dataType: "float",
            min: 0,
            max: 360,
            value: params.angle
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Opacity" }),
          ui.slider({
            key: "opacity",
            dataType: "float",
            min: 0,
            max: 100,
            value: params.opacity
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("blurMode") }),
          ui.select({
            key: "blurMode",
            value: params.blurMode,
            options: [
              { value: "both", label: t2("both") },
              { value: "behind", label: t2("behind") },
              { value: "front", label: t2("front") }
            ]
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("fadeScale") }),
          ui.slider({
            key: "fadeOut",
            dataType: "float",
            min: 0,
            max: 1,
            value: params.fadeOut
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t2("fadeDirection") }),
          ui.slider({
            key: "fadeDirection",
            dataType: "float",
            min: -1,
            max: 1,
            value: params.fadeDirection
          })
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, (device) => {
        const code = `
          struct Params {
            strength: f32,
            angle: f32,
            opacity: f32,
            blurMode: u32,
            fadeOut: f32,     // \u7E2E\u5C0F\u7387\uFF1A\u30B5\u30F3\u30D7\u30EB\u756A\u53F7\u304C\u5897\u3048\u308B\u307B\u3069\u56F3\u50CF\u304C\u5C0F\u3055\u304F\u306A\u308B
            fadeDirection: f32, // \u7E2E\u5C0F\u65B9\u5411\uFF1A\u4E0A\u5BC4\u308A/\u4E0B\u5BC4\u308A
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          fn getOffset(angle: f32) -> vec2f {
            let radians = angle * 3.14159 / 180.0;
            return vec2f(cos(radians), sin(radians));
          }

          fn gaussianWeight(distance: f32, sigma: f32) -> f32 {
            let normalized = distance / sigma;
            return exp(-(normalized * normalized) / 2.0);
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
            let dims = vec2f(textureDimensions(inputTexture));
            let texCoord = vec2f(id.xy) / dims;

            // \u5143\u306E\u753B\u50CF\u3092\u53D6\u5F97
            let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

            // strength = 0 \u307E\u305F\u306F opacity = 0 \u306A\u3089\u5143\u306E\u753B\u50CF\u3092\u305D\u306E\u307E\u307E\u8FD4\u3059
            if (params.strength <= 0.0 || params.opacity <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
            }

            // \u65B9\u5411\u30D9\u30AF\u30C8\u30EB\u306E\u8A08\u7B97
            let pixelOffset = getOffset(params.angle) * params.strength;
            let texOffset = pixelOffset / dims;

            // strength\u306B\u5FDC\u3058\u305F\u30B5\u30F3\u30D7\u30EB\u6570\u306E\u81EA\u52D5\u8A08\u7B97
            // \u3088\u308A\u591A\u304F\u306E\u30B5\u30F3\u30D7\u30EB\u3092\u4F7F\u7528\u3057\u3066\u30D6\u30E9\u30FC\u3092\u6ED1\u3089\u304B\u306B
            let numSamples = max(i32(params.strength), 5);

            // \u30D6\u30E9\u30FC\u51E6\u7406
            var blurredColor = vec4f(0.0);
            var totalWeight = 0.0;

            // \u30D6\u30E9\u30FC\u30E2\u30FC\u30C9\u306B\u5FDC\u3058\u3066\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u7BC4\u56F2\u3092\u8ABF\u6574
            var startSample = -numSamples;
            var endSample = numSamples;

            // blurMode: 0=both, 1=behind, 2=front
            if (params.blurMode == 1u) { // behind
                startSample = 0;
                endSample = numSamples;  // \u6B63\u306E\u65B9\u5411\u306B\u30D6\u30E9\u30FC\uFF08\u5143\u306E\u753B\u50CF\u306E\u80CC\u5F8C\uFF09
            } else if (params.blurMode == 2u) { // front
                startSample = -numSamples;
                endSample = 0;  // \u8CA0\u306E\u65B9\u5411\u306B\u30D6\u30E9\u30FC\uFF08\u5143\u306E\u753B\u50CF\u306E\u524D\u65B9\uFF09
            }

            // \u4E2D\u592E\u3068\u4E21\u65B9\u5411\u306B\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
            for (var i = startSample; i <= endSample; i++) {
                // \u4E2D\u592E\u306E\u30B5\u30F3\u30D7\u30EB\uFF08i = 0\uFF09\u306F\u5143\u306E\u753B\u50CF\u3092\u305D\u306E\u307E\u307E\u4F7F\u7528
                if (i == 0) {
                    blurredColor += originalColor;
                    totalWeight += 1.0;
                    continue;
                }

                // \u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u4F4D\u7F6E\u306E\u8A08\u7B97
                let blurIntensity = 1.5; // \u30D6\u30E9\u30FC\u306E\u5F37\u5EA6\u3092\u4E0A\u3052\u308B\u305F\u3081\u306E\u4FC2\u6570
                let sampleOffset = f32(i) / f32(numSamples) * blurIntensity;

                // \u30B5\u30F3\u30D7\u30EB\u8DDD\u96E2\uFF080.0\uFF5E1.0\u306B\u6B63\u898F\u5316\uFF09
                let normalizedDistance = f32(abs(i)) / f32(numSamples);

                // \u57FA\u672C\u7684\u306A\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u5EA7\u6A19\uFF08\u30D6\u30E9\u30FC\u65B9\u5411\uFF09
                let baseCoord = texCoord + texOffset * sampleOffset;

                // \u7E2E\u5C0F\u52B9\u679C\u306E\u9069\u7528
                var sampleCoord = baseCoord;
                if (params.fadeOut > 0.0) {
                    // \u7E2E\u5C0F\u7387\u306E\u8A08\u7B97\uFF080.0\uFF5E1.0\uFF09
                    let scale = max(1.0 - (normalizedDistance * params.fadeOut), 0.01);

                    // \u753B\u50CF\u4E2D\u5FC3\u3092\u539F\u70B9\u3068\u3057\u3066\u62E1\u5927\u7E2E\u5C0F
                    let center = vec2f(0.5, 0.5);
                    sampleCoord = center + (baseCoord - center) / scale;

                    // \u7E2E\u5C0F\u65B9\u5411\u306E\u9069\u7528\uFF08\u4E0A\u4E0B\u65B9\u5411\u306E\u30B7\u30D5\u30C8\uFF09
                    if (params.fadeDirection != 0.0) {
                        // \u6B63\u306E\u5024\uFF1A\u4E0B\u65B9\u5411\u3001\u8CA0\u306E\u5024\uFF1A\u4E0A\u65B9\u5411
                        let shift = (1.0 - scale) * 0.5 * params.fadeDirection;
                        sampleCoord.y += shift;
                    }
                }

                // \u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u5EA7\u6A19\u30920.0\uFF5E1.0\u306E\u7BC4\u56F2\u306B\u30AF\u30E9\u30F3\u30D7
                sampleCoord = clamp(sampleCoord, vec2f(0.0), vec2f(1.0));

                // \u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
                let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);

                // \u91CD\u307F\u8A08\u7B97
                let sigma = 0.5; // \u56FA\u5B9A\u5024\u3092\u5927\u304D\u304F\u3057\u3066\u307C\u304B\u3057\u52B9\u679C\u3092\u5F37\u5316\uFF08\u5143\u306F0.3\uFF09
                let weight = gaussianWeight(normalizedDistance, sigma);

                // \u5408\u8A08\u306B\u52A0\u7B97
                blurredColor += sampleColor * weight;
                totalWeight += weight;
            }

            // \u6B63\u898F\u5316
            var finalColor = originalColor;
            if (totalWeight > 0.0) {
                blurredColor = blurredColor / totalWeight;

                // behind\u30E2\u30FC\u30C9\u306E\u5834\u5408\u306F\u5143\u306E\u753B\u50CF\u3092\u5F37\u8ABF
                if (params.blurMode == 1u) { // behind
                    // behind\u30E2\u30FC\u30C9\u3067\u306F\u3001\u5143\u306E\u753B\u50CF\u304C\u512A\u5148\u3055\u308C\u308B\u5358\u7D14\u306A\u30D6\u30EC\u30F3\u30C9
                    let behindOpacity = min(params.opacity * 0.7, 70.0) / 100.0; // \u4E0A\u9650\u3092\u5F15\u304D\u4E0A\u3052
                    finalColor = mix(originalColor, blurredColor, behindOpacity);
                } else {
                    // \u901A\u5E38\u306E\u30D6\u30EC\u30F3\u30C9
                    finalColor = mix(originalColor, blurredColor, params.opacity / 100.0);
                }
            }

            textureStore(resultTexture, id.xy, finalColor);
          }
        `;
        const shader = device.createShaderModule({
          code
        });
        console.log({ shader });
        const defs = makeShaderDataDefinitions2(code);
        const pipeline = device.createComputePipeline({
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeMain"
          }
        });
        return { device, pipeline, defs };
      });
    },
    goLiveEffect: async ({ device, pipeline, defs }, params, imgData) => {
      try {
        imgData = await paddingImageData(imgData, Math.ceil(params.strength));
        const outputWidth = imgData.width;
        const outputHeight = imgData.height;
        imgData = await addWebGPUAlignmentPadding(imgData);
        const inputWidth = imgData.width;
        const inputHeight = imgData.height;
        const texture = device.createTexture({
          size: [inputWidth, inputHeight],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
        const resultTexture = device.createTexture({
          size: [inputWidth, inputHeight],
          format: "rgba8unorm",
          usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
        });
        const sampler = device.createSampler({
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge"
        });
        let blurModeValue = 0;
        if (params.blurMode === "behind") {
          blurModeValue = 1;
        } else if (params.blurMode === "front") {
          blurModeValue = 2;
        }
        const uniformValues = makeStructuredView2(defs.uniforms.params);
        const uniformBuffer = device.createBuffer({
          size: uniformValues.arrayBuffer.byteLength,
          // 6 * 4 bytes
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        uniformValues.set({
          strength: params.strength,
          angle: params.angle,
          opacity: params.opacity,
          blurMode: blurModeValue,
          fadeOut: params.fadeOut || 0,
          fadeDirection: params.fadeDirection || 0
        });
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
        const bindGroup = device.createBindGroup({
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
        device.queue.writeTexture(
          { texture },
          imgData.data,
          { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
          [inputWidth, inputHeight]
        );
        const commandEncoder = device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(inputWidth / 16),
          Math.ceil(inputHeight / 16)
        );
        computePass.end();
        const stagingBuffer = device.createBuffer({
          size: inputWidth * inputHeight * 4,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        commandEncoder.copyTextureToBuffer(
          { texture: resultTexture },
          {
            buffer: stagingBuffer,
            bytesPerRow: inputWidth * 4,
            rowsPerImage: inputHeight
          },
          [inputWidth, inputHeight]
        );
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const copyArrayBuffer = stagingBuffer.getMappedRange();
        const resultData = new Uint8Array(copyArrayBuffer.slice(0));
        stagingBuffer.unmap();
        const resultImageData = await removeWebGPUAlignmentPadding(
          new ImageData(
            new Uint8ClampedArray(resultData),
            inputWidth,
            inputHeight
          ),
          outputWidth,
          outputHeight
        );
        return resultImageData;
      } catch (err) {
        console.error("WebGPU processing error:", err);
        return imgData;
      }
    }
  }
});

// src/js/src/live-effects/kirakira-glow.ts
var t3 = createTranslator({
  en: {
    title: "KiraKira Glow V1",
    strength: "Blur Strength",
    transparentOriginal: "Transparent original",
    highQuality: "High quality mode"
  },
  ja: {
    title: "\u30AD\u30E9\u30AD\u30E9\u30B0\u30ED\u30FC V1",
    strength: "\u307C\u304B\u3057\u5F37\u5EA6",
    transparentOriginal: "\u5143\u753B\u50CF\u3092\u900F\u660E\u306B\u3059\u308B",
    highQuality: "\u9AD8\u54C1\u8CEA\u30E2\u30FC\u30C9"
  }
});
var kirakiraGlow = definePlugin({
  id: "kirakira-glow-effect-v1",
  title: t3("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      strength: {
        type: "real",
        default: 10
      },
      transparentOriginal: {
        type: "bool",
        default: false
      },
      highQuality: {
        type: "bool",
        default: false
      }
    },
    onEditParameters: (params) => {
      params.strength = Math.max(0, params.strength);
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        strength: params.strength * scaleFactor,
        transparentOriginal: params.transparentOriginal,
        highQuality: params.highQuality
      };
    },
    onInterpolate: (paramsA, paramsB, t9) => {
      return {
        strength: lerp(paramsA.strength, paramsB.strength, t9),
        transparentOriginal: t9 < 0.5 ? paramsA.transparentOriginal : paramsB.transparentOriginal,
        highQuality: t9 < 0.5 ? paramsA.highQuality : paramsB.highQuality
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strength",
              dataType: "float",
              min: 0,
              max: 500,
              value: params.strength
            }),
            ui.numberInput({
              key: "strength",
              dataType: "float",
              value: params.strength
            })
          ])
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "transparentOriginal",
            label: t3("transparentOriginal"),
            value: params.transparentOriginal
          })
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "highQuality",
            label: t3("highQuality"),
            value: params.highQuality
          })
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, async (device) => {
        const shader = device.createShaderModule({
          label: "Optimized Glow Effect Shader",
          code: `
          struct Params {
            strength: f32,
            transparentOriginal: u32,
            highQuality: u32,
            width: u32,
            height: u32,
            downscaleFactor: u32,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var tempTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(3) var textureSampler: sampler;
          @group(0) @binding(4) var<uniform> params: Params;
          @group(1) @binding(0) var tempReadTexture: texture_2d<f32>;
          @group(1) @binding(1) var resultReadTexture: texture_2d<f32>;

          fn gaussian1D(x: f32, sigma: f32) -> f32 {
            let sigma2 = sigma * sigma;
            return exp(-(x * x) / (2.0 * sigma2)) / (sqrt(2.0 * 3.14159265359) * sigma);
          }

          @compute @workgroup_size(16, 16)
          fn computeDownsample(@builtin(global_invocation_id) id: vec3u) {
            let dims = vec2f(textureDimensions(inputTexture));
            let smallDims = vec2f(textureDimensions(tempTexture));

            let texCoord = vec2f(id.xy) / smallDims;
            let srcCoord = texCoord;
            let color = textureSampleLevel(inputTexture, textureSampler, srcCoord, 0.0);

            textureStore(tempTexture, id.xy, color);
          }

          @compute @workgroup_size(16, 16)
          fn computeHorizontalBlur(@builtin(global_invocation_id) id: vec3u) {
            let dims = vec2f(textureDimensions(tempTexture));
            let texCoord = vec2f(id.xy) / dims;

            let sigma = max(1.0, params.strength / 3.0);
            let kernelSize = i32(min(select(16.0, 24.0, params.highQuality != 0u), ceil(params.strength)));

            var totalWeight = 0.0;
            var totalColor = vec3f(0.0);
            var totalAlpha = 0.0;

            for (var x = -kernelSize; x <= kernelSize; x++) {
              let weight = gaussian1D(f32(x), sigma);
              let sampleCoord = vec2f(texCoord.x + f32(x) / dims.x, texCoord.y);

              if (sampleCoord.x >= 0.0 && sampleCoord.x <= 1.0) {
                let sampleColor = textureSampleLevel(tempReadTexture, textureSampler, sampleCoord, 0.0);

                if (sampleColor.a > 0.001) {
                  let unpremultipliedColor = sampleColor.rgb / sampleColor.a;
                  totalColor += unpremultipliedColor * weight * sampleColor.a;
                  totalAlpha += sampleColor.a * weight;
                }
                totalWeight += weight;
              }
            }

            var blurredColor = vec4f(0.0);
            if (totalWeight > 0.0 && totalAlpha > 0.001) {
              let normalizedColor = totalColor / totalAlpha;
              blurredColor = vec4f(normalizedColor, totalAlpha / totalWeight);
            }

            textureStore(resultTexture, id.xy, blurredColor);
          }

          @compute @workgroup_size(16, 16)
          fn computeVerticalBlur(@builtin(global_invocation_id) id: vec3u) {
            let dims = vec2f(textureDimensions(resultTexture));
            let texCoord = vec2f(id.xy) / dims;

            let sigma = max(1.0, params.strength / 3.0);
            let kernelSize = i32(min(select(16.0, 24.0, params.highQuality != 0u), ceil(params.strength)));

            var totalWeight = 0.0;
            var totalColor = vec3f(0.0);
            var totalAlpha = 0.0;

            for (var y = -kernelSize; y <= kernelSize; y++) {
              let weight = gaussian1D(f32(y), sigma);
              let sampleCoord = vec2f(texCoord.x, texCoord.y + f32(y) / dims.y);

              if (sampleCoord.y >= 0.0 && sampleCoord.y <= 1.0) {
                let sampleColor = textureSampleLevel(resultReadTexture, textureSampler, sampleCoord, 0.0);

                if (sampleColor.a > 0.001) {
                  let unpremultipliedColor = sampleColor.rgb / sampleColor.a;
                  totalColor += unpremultipliedColor * weight * sampleColor.a;
                  totalAlpha += sampleColor.a * weight;
                }
                totalWeight += weight;
              }
            }

            var blurredColor = vec4f(0.0);
            if (totalWeight > 0.0 && totalAlpha > 0.001) {
              let normalizedColor = totalColor / totalAlpha;
              blurredColor = vec4f(normalizedColor, totalAlpha / totalWeight);
            }

            textureStore(tempTexture, id.xy, blurredColor);
          }

          @compute @workgroup_size(16, 16)
          fn computeFinalComposite(@builtin(global_invocation_id) id: vec3u) {
            let dims = vec2f(textureDimensions(resultTexture));
            let smallDims = vec2f(textureDimensions(tempTexture));
            let texCoord = vec2f(id.xy) / dims;

            let smallCoord = texCoord;
            let blurredColor = textureSampleLevel(tempReadTexture, textureSampler, smallCoord, 0.0);
            let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

            var finalColor = vec4f(0.0);

            if (params.transparentOriginal != 0u) {
              finalColor = blurredColor;

              if (originalColor.a > 0.0) {
                finalColor.a = finalColor.a * (1.0 - originalColor.a);
              }
            } else {
              finalColor = blurredColor;

              if (originalColor.a > 0.0) {
                finalColor = vec4f(
                  mix(finalColor.rgb, originalColor.rgb, originalColor.a),
                  max(finalColor.a, originalColor.a)
                );
              }
            }

            textureStore(resultTexture, id.xy, finalColor);
          }
          `
        });
        const downsamplePipeline = device.createComputePipeline({
          label: "Downsample Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeDownsample"
          }
        });
        const horizontalBlurPipeline = device.createComputePipeline({
          label: "Horizontal Blur Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeHorizontalBlur"
          }
        });
        const verticalBlurPipeline = device.createComputePipeline({
          label: "Vertical Blur Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeVerticalBlur"
          }
        });
        const compositePipeline = device.createComputePipeline({
          label: "Composite Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeFinalComposite"
          }
        });
        return {
          downsamplePipeline,
          horizontalBlurPipeline,
          verticalBlurPipeline,
          compositePipeline
        };
      });
    },
    goLiveEffect: async ({
      device,
      downsamplePipeline,
      horizontalBlurPipeline,
      verticalBlurPipeline,
      compositePipeline
    }, params, imgData, env) => {
      const dpiScale = env.dpi / env.baseDpi;
      const padding = Math.ceil(params.strength * dpiScale);
      imgData = await paddingImageData(imgData, padding);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      let downscaleFactor = 1;
      if (!params.highQuality) {
        if (inputWidth > 8192) downscaleFactor = 8;
        else if (inputWidth > 4096) downscaleFactor = 4;
        else if (inputWidth > 2048) downscaleFactor = 2;
      } else {
        if (inputWidth > 8192) downscaleFactor = 4;
        else if (inputWidth > 4096) downscaleFactor = 2;
      }
      const smallWidth = Math.ceil(inputWidth / downscaleFactor);
      const smallHeight = Math.ceil(inputHeight / downscaleFactor);
      const inputTexture = device.createTexture({
        label: "KiraKiraGlow_InputTexture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      const tempTexture = device.createTexture({
        label: "KiraKiraGlow_TempTexture",
        size: [smallWidth, smallHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
      });
      const resultTexture = device.createTexture({
        label: "KiraKiraGlow_ResultTexture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
      });
      const sampler = device.createSampler({
        label: "KiraKiraGlow_Sampler",
        magFilter: "linear",
        minFilter: "linear"
      });
      const uniformBuffer = device.createBuffer({
        label: "KiraKiraGlow_UniformBuffer",
        size: 24,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const uniformData = new ArrayBuffer(24);
      const uniformView = new DataView(uniformData);
      uniformView.setFloat32(0, params.strength, true);
      uniformView.setUint32(4, params.transparentOriginal ? 1 : 0, true);
      uniformView.setUint32(8, params.highQuality ? 1 : 0, true);
      uniformView.setUint32(12, inputWidth, true);
      uniformView.setUint32(16, inputHeight, true);
      uniformView.setUint32(20, downscaleFactor, true);
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const downsampleBindGroup = device.createBindGroup({
        label: "KiraKiraGlow_DownsampleBindGroup",
        layout: downsamplePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: tempTexture.createView() },
          { binding: 3, resource: sampler }
        ]
      });
      const horizontalBlurBindGroup = device.createBindGroup({
        label: "KiraKiraGlow_HorizontalBlurBindGroup",
        layout: horizontalBlurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 1, resource: tempTexture.createView() },
          { binding: 2, resource: resultTexture.createView() },
          { binding: 3, resource: sampler },
          { binding: 4, resource: { buffer: uniformBuffer } }
        ]
      });
      const horizontalBlurReadGroup = device.createBindGroup({
        label: "KiraKiraGlow_HorizontalBlurReadGroup",
        layout: horizontalBlurPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: tempTexture.createView() }]
      });
      const verticalBlurBindGroup = device.createBindGroup({
        label: "KiraKiraGlow_VerticalBlurBindGroup",
        layout: verticalBlurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 1, resource: tempTexture.createView() },
          { binding: 2, resource: resultTexture.createView() },
          { binding: 3, resource: sampler },
          { binding: 4, resource: { buffer: uniformBuffer } }
        ]
      });
      const verticalBlurReadGroup = device.createBindGroup({
        label: "KiraKiraGlow_VerticalBlurReadGroup",
        layout: verticalBlurPipeline.getBindGroupLayout(1),
        entries: [{ binding: 1, resource: resultTexture.createView() }]
      });
      const compositeBindGroup = device.createBindGroup({
        label: "KiraKiraGlow_CompositeBindGroup",
        layout: compositePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: tempTexture.createView() },
          { binding: 2, resource: resultTexture.createView() },
          { binding: 3, resource: sampler },
          { binding: 4, resource: { buffer: uniformBuffer } }
        ]
      });
      const compositeReadGroup = device.createBindGroup({
        label: "KiraKiraGlow_CompositeReadGroup",
        layout: compositePipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: tempTexture.createView() }]
      });
      const commandEncoder = device.createCommandEncoder({
        label: "KiraKiraGlow_CommandEncoder"
      });
      {
        const computePass = commandEncoder.beginComputePass({
          label: "KiraKiraGlow_DownsamplePass"
        });
        computePass.setPipeline(downsamplePipeline);
        computePass.setBindGroup(0, downsampleBindGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(smallWidth / 16),
          Math.ceil(smallHeight / 16)
        );
        computePass.end();
      }
      {
        const computePass = commandEncoder.beginComputePass({
          label: "KiraKiraGlow_HorizontalBlurPass"
        });
        computePass.setPipeline(horizontalBlurPipeline);
        computePass.setBindGroup(0, horizontalBlurBindGroup);
        computePass.setBindGroup(1, horizontalBlurReadGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(smallWidth / 16),
          Math.ceil(smallHeight / 16)
        );
        computePass.end();
      }
      {
        const computePass = commandEncoder.beginComputePass({
          label: "KiraKiraGlow_VerticalBlurPass"
        });
        computePass.setPipeline(verticalBlurPipeline);
        computePass.setBindGroup(0, verticalBlurBindGroup);
        computePass.setBindGroup(1, verticalBlurReadGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(smallWidth / 16),
          Math.ceil(smallHeight / 16)
        );
        computePass.end();
      }
      {
        const computePass = commandEncoder.beginComputePass({
          label: "KiraKiraGlow_CompositePass"
        });
        computePass.setPipeline(compositePipeline);
        computePass.setBindGroup(0, compositeBindGroup);
        computePass.setBindGroup(1, compositeReadGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(inputWidth / 16),
          Math.ceil(inputHeight / 16)
        );
        computePass.end();
      }
      const stagingBuffer = device.createBuffer({
        label: "KiraKiraGlow_StagingBuffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/dithering.ts
var dithering = definePlugin({
  id: "dithering-effect-v1",
  title: "Dithering Effect V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      patternType: {
        type: "string",
        enum: ["bayer2x2", "bayer4x4", "bayer8x8"],
        default: "bayer4x4"
      },
      threshold: {
        type: "real",
        default: 0.5
      },
      colorMode: {
        type: "string",
        enum: ["monochrome", "color"],
        default: "color"
      },
      strength: {
        type: "real",
        default: 100
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        threshold: params.threshold,
        strength: params.strength,
        patternType: params.patternType,
        colorMode: params.colorMode
      };
    },
    onInterpolate: (paramsA, paramsB, t9) => {
      return {
        threshold: lerp(paramsA.threshold, paramsB.threshold, t9),
        strength: lerp(paramsA.strength, paramsB.strength, t9),
        patternType: t9 < 0.5 ? paramsA.patternType : paramsB.patternType,
        colorMode: t9 < 0.5 ? paramsA.colorMode : paramsB.colorMode
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.select({ key: "patternType", label: "Pattern Type", value: params.patternType, options: [
            { value: "bayer2x2", label: "2x2 Bayer" },
            { value: "bayer4x4", label: "4x4 Bayer" },
            { value: "bayer8x8", label: "8x8 Bayer" }
          ] })
        ]),
        ui.group({ direction: "row" }, [
          ui.slider({ key: "threshold", label: "Threshold", dataType: "float", min: 0, max: 100, value: params.threshold })
        ]),
        ui.group({ direction: "row" }, [
          ui.select({ key: "colorMode", label: "Color Mode", value: params.colorMode, options: [
            { value: "monochrome", label: "Monochrome" },
            { value: "color", label: "Color" }
          ] })
        ]),
        ui.group({ direction: "row" }, [
          ui.slider({ key: "strength", label: "Strength", dataType: "float", min: 0, max: 100, value: params.strength })
        ])
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then(
        (adapter) => adapter.requestDevice({
          label: "WebGPU(Dithering Effect)"
        })
      );
      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }
      const shader = device.createShaderModule({
        label: "Dithering Effect Shader",
        code: `
          struct Params {
            threshold: f32,
            strength: f32,
            patternType: u32,  // 0: bayer2x2, 1: bayer4x4, 2: bayer8x8
            colorMode: u32,    // 0: monochrome, 1: color
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          // Bayer matrices for ordered dithering
          const bayer2x2: array<f32, 4> = array<f32, 4>(
            0.0, 0.5,
            0.75, 0.25
          );

          const bayer4x4: array<f32, 16> = array<f32, 16>(
            0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
            12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
            3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
            15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
          );

          const bayer8x8: array<f32, 64> = array<f32, 64>(
            0.0/64.0, 32.0/64.0, 8.0/64.0, 40.0/64.0, 2.0/64.0, 34.0/64.0, 10.0/64.0, 42.0/64.0,
            48.0/64.0, 16.0/64.0, 56.0/64.0, 24.0/64.0, 50.0/64.0, 18.0/64.0, 58.0/64.0, 26.0/64.0,
            12.0/64.0, 44.0/64.0, 4.0/64.0, 36.0/64.0, 14.0/64.0, 46.0/64.0, 6.0/64.0, 38.0/64.0,
            60.0/64.0, 28.0/64.0, 52.0/64.0, 20.0/64.0, 62.0/64.0, 30.0/64.0, 54.0/64.0, 22.0/64.0,
            3.0/64.0, 35.0/64.0, 11.0/64.0, 43.0/64.0, 1.0/64.0, 33.0/64.0, 9.0/64.0, 41.0/64.0,
            51.0/64.0, 19.0/64.0, 59.0/64.0, 27.0/64.0, 49.0/64.0, 17.0/64.0, 57.0/64.0, 25.0/64.0,
            15.0/64.0, 47.0/64.0, 7.0/64.0, 39.0/64.0, 13.0/64.0, 45.0/64.0, 5.0/64.0, 37.0/64.0,
            63.0/64.0, 31.0/64.0, 55.0/64.0, 23.0/64.0, 61.0/64.0, 29.0/64.0, 53.0/64.0, 21.0/64.0
          );

          // Get Bayer matrix value based on pattern type and coordinates
          fn getBayerValue(x: u32, y: u32, patternType: u32) -> f32 {
            if (patternType == 0u) {
              // 2x2 Bayer matrix
              return bayer2x2[(y % 2u) * 2u + (x % 2u)];
            } else if (patternType == 1u) {
              // 4x4 Bayer matrix
              return bayer4x4[(y % 4u) * 4u + (x % 4u)];
            } else {
              // 8x8 Bayer matrix
              return bayer8x8[(y % 8u) * 8u + (x % 8u)];
            }
          }

          // Convert RGB to grayscale
          fn rgbToGrayscale(color: vec3f) -> f32 {
            return dot(color, vec3f(0.299, 0.587, 0.114));
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // Get Bayer matrix value for the current pixel
              let bayerValue = getBayerValue(id.x, id.y, params.patternType);

              // Apply threshold and create dithering effect
              var finalColor: vec4f;

              if (params.colorMode == 0u) {
                // Monochrome mode
                let gray = rgbToGrayscale(originalColor.rgb);
                let dithered = step(bayerValue, gray + (params.threshold - 0.5));
                finalColor = vec4f(vec3f(dithered), originalColor.a);
              } else {
                // Color mode
                let ditheredR = step(bayerValue, originalColor.r + (params.threshold - 0.5));
                let ditheredG = step(bayerValue, originalColor.g + (params.threshold - 0.5));
                let ditheredB = step(bayerValue, originalColor.b + (params.threshold - 0.5));
                finalColor = vec4f(ditheredR, ditheredG, ditheredB, originalColor.a);
              }

              // Blend with original based on strength
              finalColor = mix(originalColor, finalColor, params.strength);

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
        label: "Dithering Effect Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain"
        }
      });
      return { device, pipeline };
    },
    goLiveEffect: async ({ device, pipeline }, params, imgData) => {
      console.log("Dithering Effect V1", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
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
        size: 16,
        // 4 * float32
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
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      const uniformData = new ArrayBuffer(16);
      const uniformView = new DataView(uniformData);
      uniformView.setFloat32(0, params.threshold / 100, true);
      uniformView.setFloat32(4, params.strength / 100, true);
      let patternTypeValue = 1;
      if (params.patternType === "bayer2x2") patternTypeValue = 0;
      else if (params.patternType === "bayer4x4") patternTypeValue = 1;
      else if (params.patternType === "bayer8x8") patternTypeValue = 2;
      uniformView.setUint32(8, patternTypeValue, true);
      let colorModeValue = params.colorMode === "monochrome" ? 0 : 1;
      uniformView.setUint32(12, colorModeValue, true);
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Dithering Effect Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/glitch.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions3,
  makeStructuredView as makeStructuredView3
} from "npm:webgpu-utils";
var t4 = createTranslator({
  en: {
    title: "Glitch Effect V1",
    intensity: "Intensity",
    slices: "Slices",
    colorShift: "Color Shift",
    angle: "Angle",
    bias: "Direction Bias",
    seed: "Seed",
    reset: "Reset"
  },
  ja: {
    title: "\u30B0\u30EA\u30C3\u30C1\u30A8\u30D5\u30A7\u30AF\u30C8 V1",
    intensity: "\u5F37\u5EA6",
    slices: "\u30B9\u30E9\u30A4\u30B9\u6570",
    colorShift: "\u8272\u30B7\u30D5\u30C8",
    angle: "\u89D2\u5EA6",
    bias: "\u6563\u5E03\u306E\u5BC4\u308A",
    seed: "\u30B7\u30FC\u30C9\u5024",
    reset: "\u30EA\u30BB\u30C3\u30C8"
  }
});
var glitch = definePlugin({
  id: "glitch-effect-v1",
  title: t4("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 0.5
      },
      slices: {
        type: "int",
        default: 20
      },
      colorShift: {
        type: "real",
        default: 1
      },
      angle: {
        type: "real",
        default: 0
      },
      bias: {
        type: "real",
        default: 0
      },
      seed: {
        type: "int",
        default: Math.floor(Math.random() * 1e4)
      }
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onEditParameters: (params) => {
      params.intensity = Math.max(0, Math.min(1, params.intensity));
      params.colorShift = Math.max(0, Math.min(1, params.colorShift));
      params.angle = Math.max(-1, Math.min(1, params.angle));
      params.bias = Math.max(-1, Math.min(1, params.bias));
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t9) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t9),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t9),
        slices: Math.round(lerp(paramsA.slices, paramsB.slices, t9)),
        angle: lerp(paramsA.angle, paramsB.angle, t9),
        bias: lerp(paramsA.bias, paramsB.bias, t9),
        seed: paramsA.seed
        // シード値は補間しない
      };
    },
    renderUI: (params, setParam) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("intensity") }),
          ui.slider({ key: "intensity", dataType: "float", min: 0, max: 1, value: params.intensity })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("slices") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "slices", dataType: "int", min: 1, max: 400, value: params.slices }),
            ui.numberInput({ dataType: "int", key: "slices", value: params.slices, min: 1, max: 400, step: 1 })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: "float", min: 0, max: 100, value: params.colorShift }),
            ui.numberInput({ dataType: "float", key: "colorShift", value: params.colorShift, min: 0, max: 1, step: 0.01 })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "angle", dataType: "float", min: -1, max: 1, value: params.angle }),
            ui.numberInput({ dataType: "float", key: "angle", value: params.angle, min: -1, max: 1, step: 0.01 })
          ]),
          ui.button({ text: t4("reset"), onClick: () => {
            setParam({ angle: 0 });
          } })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("bias") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bias", dataType: "float", min: -1, max: 1, value: params.bias }),
            ui.numberInput({ dataType: "float", key: "bias", value: params.bias, min: -1, max: 1, step: 0.01 })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t4("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "seed", dataType: "int", min: 0, max: 1e4, value: params.seed }),
            ui.numberInput({ dataType: "int", key: "seed", value: params.seed, min: 0, max: 1e4, step: 1 })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, (device) => {
        const code = `
          struct Params {
            intensity: f32,
            colorShift: f32,
            slices: f32,
            angle: f32,
            bias: f32,
            seed: f32,
            dpi: i32,
            baseDpi: i32,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
            let dims = textureDimensions(inputTexture);
            if (id.x >= dims.x || id.y >= dims.y) {
              return;
            }

            let texCoord = vec2f(id.xy) / vec2f(dims);
            var outColor: vec4f;

            var shiftedCoord = texCoord;

            if (params.intensity > 0.0) {
              // \u89D2\u5EA6\u306B\u57FA\u3065\u3044\u3066\u659C\u3081\u306E\u30B9\u30E9\u30A4\u30B9\u3092\u8A08\u7B97
              let angle = params.angle * 3.14159;

              // x\u3068y\u306E\u5EA7\u6A19\u3092\u89D2\u5EA6\u306B\u57FA\u3065\u3044\u3066\u56DE\u8EE2\u3055\u305B\u305F\u5EA7\u6A19\u3067\u30B9\u30E9\u30A4\u30B9\u3092\u6C7A\u5B9A
              let sliceCoord = texCoord.x * sin(angle) + texCoord.y * cos(angle);
              let sliceIndex = floor(sliceCoord * params.slices);

              let seed = params.seed;
              let random = fract(sin(sliceIndex * 43758.5453 + seed) * 43758.5453);

              if (random < params.intensity) {
                let shift = (random - 0.5 + params.bias * 0.5) * params.intensity;

                // \u30B7\u30D5\u30C8\u65B9\u5411\u3082\u89D2\u5EA6\u306B\u5782\u76F4\u306A\u65B9\u5411\u306B
                let shiftAngle = angle;
                let xShift = shift * cos(shiftAngle);
                let yShift = shift * sin(shiftAngle);

                shiftedCoord.x = clamp(texCoord.x + xShift, 0.0, 1.0);
                shiftedCoord.y = clamp(texCoord.y + yShift, 0.0, 1.0);
              }
            }

            let rOffset = params.colorShift;

            let rCoord = clamp(vec2f(shiftedCoord.x + rOffset, shiftedCoord.y), vec2f(0.0), vec2f(1.0));
            let gCoord = shiftedCoord;
            let bCoord = clamp(vec2f(shiftedCoord.x - rOffset, shiftedCoord.y), vec2f(0.0), vec2f(1.0));

            let rC = textureSampleLevel(inputTexture, textureSampler, rCoord, 0.0);
            let gC = textureSampleLevel(inputTexture, textureSampler, gCoord, 0.0);
            let bC = textureSampleLevel(inputTexture, textureSampler, bCoord, 0.0);

            let a = (rC.a + gC.a + bC.a) / 3.0;

            outColor = vec4f(rC.r, gC.g, bC.b, a);

            textureStore(resultTexture, id.xy, outColor);
          }
        `;
        const shader = device.createShaderModule({
          code
        });
        const defs = makeShaderDataDefinitions3(code);
        const pipeline = device.createComputePipeline({
          compute: {
            module: shader,
            entryPoint: "computeMain"
          },
          layout: "auto"
        });
        return { pipeline, defs };
      });
    },
    goLiveEffect: async ({ device, pipeline, defs }, params, imgData, env) => {
      imgData = await paddingImageData(
        imgData,
        params.colorShift + params.bias
      );
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width;
      const inputHeight = imgData.height;
      const uniformValues = makeStructuredView3(defs.uniforms.params);
      const texture = device.createTexture({
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      const resultTexture = device.createTexture({
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
      });
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      const uniformBuffer = device.createBuffer({
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        intensity: params.intensity,
        colorShift: params.colorShift / 100,
        slices: Math.max(1, params.slices),
        angle: params.angle,
        bias: params.bias,
        seed: params.seed,
        dpi: env.dpi,
        baseDpi: env.baseDpi
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView() },
          { binding: 1, resource: resultTexture.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: uniformBuffer } }
        ]
      });
      const stagingBuffer = device.createBuffer({
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      const workgroupsX = Math.ceil(inputWidth / 16);
      const workgroupsY = Math.ceil(inputHeight / 16);
      computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      const commandBuffer = commandEncoder.finish();
      device.queue.submit([commandBuffer]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      const finalImage = await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
      return finalImage;
    }
  }
});

// src/js/src/live-effects/outline.ts
var t5 = createTranslator({
  en: {
    title: "Outline Effect (Morphology)",
    size: "Size",
    color: "Color"
  },
  ja: {
    title: "\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u30A8\u30D5\u30A7\u30AF\u30C8 (\u30E2\u30FC\u30D5\u30A9\u30ED\u30B8\u30FC)",
    size: "\u592A\u3055",
    color: "\u8272"
  }
});
var outlineEffect = definePlugin({
  id: "outline-effect-morphology-v1",
  title: t5("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      size: {
        type: "real",
        default: 3
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 0, a: 1 }
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        size: Math.max(0.1, params.size)
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        color: adjustColor(params.color)
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        size: params.size * scaleFactor
      };
    },
    onInterpolate: (paramsA, paramsB, t9) => {
      return {
        size: lerp(paramsA.size, paramsB.size, t9),
        color: {
          r: lerp(paramsA.color.r, paramsB.color.r, t9),
          g: lerp(paramsA.color.g, paramsB.color.g, t9),
          b: lerp(paramsA.color.b, paramsB.color.b, t9),
          a: lerp(paramsA.color.a, paramsB.color.a, t9)
        }
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.text({ text: t5("size") }),
          ui.slider({
            key: "size",
            dataType: "float",
            min: 0.1,
            max: 200,
            value: params.size
          }),
          ui.numberInput({
            key: "size",
            dataType: "float",
            value: params.size
          })
        ]),
        ui.colorInput({ key: "color", value: params.color })
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then(
        (adapter) => adapter.requestDevice({
          label: "WebGPU(Outline Effect Morphology)"
        })
      );
      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }
      const boundaryShader = device.createShaderModule({
        label: "Outline Boundary Detection Shader",
        code: `
          struct Params {
            size: f32,
            color: vec4f,
            inputDpi: f32,
            baseDpi: f32,
            _padding: array<vec4f, 3>,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var intermediateTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          fn isTransparent(color: vec4f) -> bool {
            return color.a < 0.01;
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // DPI\u5BFE\u5FDC\u306E\u30B5\u30A4\u30BA\u8A08\u7B97
              let scaledSize = params.size * (params.inputDpi / params.baseDpi);

              // \u73FE\u5728\u306E\u30D4\u30AF\u30BB\u30EB\u306E\u900F\u660E\u6027
              let isCurrentTransparent = isTransparent(originalColor);

              var outlineIntensity = 0.0;

              if (scaledSize > 0.0) {
                  let stepSize = 1.0 / dims;
                  // \u6700\u5927\u8DDD\u96E2\u306F\u7DDA\u306E\u592A\u3055\u306B\u57FA\u3065\u304F
                  let maxDist = scaledSize * 1.5;

                  // \u653E\u5C04\u72B6\u306B\u65B9\u5411\u3067\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0\u3057\u3066\u5883\u754C\u3092\u691C\u51FA
                  let dirCount = 64u; // \u3088\u308A\u591A\u304F\u306E\u65B9\u5411\u3092\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
                  let angleStep = 3.14159 * 2.0 / f32(dirCount);

                  for (var i = 0u; i < dirCount; i = i + 1u) {
                      let angle = f32(i) * angleStep;
                      let dir = vec2f(cos(angle), sin(angle));

                      var foundBoundary = false;
                      var boundaryDist = maxDist;

                      // \u3088\u308A\u7D30\u304B\u3044\u30B9\u30C6\u30C3\u30D7\u3067\u30B5\u30F3\u30D7\u30EA\u30F3\u30B0
                      let samplingStep = 0.3; // \u3088\u308A\u7D30\u304B\u3044\u30B9\u30C6\u30C3\u30D7
                      for (var dist = 0.5; dist <= maxDist; dist += samplingStep) {
                          let offset = dir * stepSize * dist;
                          let sampleCoord = texCoord + offset;

                          // \u753B\u50CF\u306E\u7BC4\u56F2\u5916\u306F\u30B9\u30AD\u30C3\u30D7
                          if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                              sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                              continue;
                          }

                          let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);
                          let isSampleTransparent = isTransparent(sampleColor);

                          // \u900F\u660E\u6027\u304C\u7570\u306A\u308C\u3070\u5883\u754C\u3092\u691C\u51FA
                          if (isSampleTransparent != isCurrentTransparent) {
                              foundBoundary = true;
                              boundaryDist = dist;
                              break;
                          }
                      }

                      if (foundBoundary) {
                          // \u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u306E\u5F37\u5EA6\u8A08\u7B97\uFF1A\u5883\u754C\u306B\u8FD1\u3044\u307B\u3069\u5F37\u304F
                          let t = 1.0 - boundaryDist / scaledSize;
                          outlineIntensity = max(outlineIntensity, clamp(t, 0.0, 1.0));
                      }
                  }

                  // \u30D0\u30A4\u30CA\u30EA\u30DE\u30B9\u30AF\u3092\u751F\u6210\u305B\u305A\u3001\u5F37\u5EA6\u3092\u305D\u306E\u307E\u307E\u4FDD\u6301
                  // \u3053\u308C\u306B\u3088\u308A2\u30D1\u30B9\u76EE\u3067\u3088\u308A\u67D4\u8EDF\u306A\u51E6\u7406\u304C\u53EF\u80FD
              }

              // \u7D50\u679C\u3092\u4E2D\u9593\u30C6\u30AF\u30B9\u30C1\u30E3\u306B\u4FDD\u5B58
              // r: \u900F\u660E\u6027\u30D5\u30E9\u30B0\uFF081.0\u306F\u4E0D\u900F\u660E\u30010.0\u306F\u900F\u660E\uFF09
              // g: \u672A\u4F7F\u7528
              // b: \u672A\u4F7F\u7528
              // a: \u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u5F37\u5EA6
              var transparencyFlag = 0.0;
              if (!isCurrentTransparent) {
                  transparencyFlag = 1.0;
              }

              textureStore(
                intermediateTexture,
                id.xy,
                vec4f(transparencyFlag, 0.0, 0.0, outlineIntensity)
              );
          }
        `
      });
      const morphologyShader = device.createShaderModule({
        label: "Outline Morphology Shader",
        code: `
          struct Params {
            size: f32,
            color: vec4f,
            inputDpi: f32,
            baseDpi: f32,
            _padding: array<vec4f, 3>,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var intermediateTexture: texture_2d<f32>;
          @group(0) @binding(2) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(3) var textureSampler: sampler;
          @group(0) @binding(4) var<uniform> params: Params;

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // \u5143\u306E\u753B\u50CF\u3068\u4E2D\u9593\u30C6\u30AF\u30B9\u30C1\u30E3\u304B\u3089\u60C5\u5831\u3092\u53D6\u5F97
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);
              let intermediateValue = textureSampleLevel(intermediateTexture, textureSampler, texCoord, 0.0);

              // \u4E2D\u9593\u30C6\u30AF\u30B9\u30C1\u30E3\u306E\u60C5\u5831\u3092\u5206\u89E3
              var isCurrentOpaque = false;
              if (intermediateValue.r > 0.5) {
                  isCurrentOpaque = true;
              }
              let outlineIntensity = intermediateValue.a;

              // DPI\u5BFE\u5FDC\u306E\u30B5\u30A4\u30BA\u8A08\u7B97
              let scaledSize = params.size * (params.inputDpi / params.baseDpi);

              // \u30E2\u30FC\u30D5\u30A9\u30ED\u30B8\u30FC\u6F14\u7B97\u306E\u305F\u3081\u306E\u69CB\u9020\u5316\u8981\u7D20\uFF08\u30AB\u30FC\u30CD\u30EB\uFF09\u30B5\u30A4\u30BA
              var kernelSize = 1;
              if (scaledSize < 5.0) {
                  kernelSize = 1; // \u7D30\u3044\u7DDA
              } else if (scaledSize < 20.0) {
                  kernelSize = 2; // \u4E2D\u7A0B\u5EA6\u306E\u7DDA
              } else if (scaledSize < 50.0) {
                  kernelSize = 3; // \u3084\u3084\u592A\u3044\u7DDA
              } else {
                  kernelSize = 4; // \u975E\u5E38\u306B\u592A\u3044\u7DDA
              }

              // \u30B9\u30C6\u30C3\u30D71: \u62E1\u5F35\u64CD\u4F5C\uFF08Dilation\uFF09
              // \u3053\u308C\u306B\u3088\u308A\u5C0F\u3055\u306A\u7A74\u3084\u51F9\u307F\u304C\u57CB\u307E\u308A\u307E\u3059
              var dilatedValue = 0.0;

              for (var dy = -kernelSize; dy <= kernelSize; dy += 1) {
                  for (var dx = -kernelSize; dx <= kernelSize; dx += 1) {
                      let offset = vec2f(f32(dx), f32(dy)) / dims;
                      let sampleCoord = texCoord + offset;

                      // \u30C6\u30AF\u30B9\u30C1\u30E3\u306E\u7BC4\u56F2\u5916\u30C1\u30A7\u30C3\u30AF
                      if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                          sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                          continue;
                      }

                      // \u69CB\u9020\u5316\u8981\u7D20\uFF08\u5186\u5F62\u30AB\u30FC\u30CD\u30EB\uFF09\u306E\u6761\u4EF6
                      let dist = length(vec2f(f32(dx), f32(dy)));
                      if (dist > f32(kernelSize)) {
                          continue;
                      }

                      let sampleValue = textureSampleLevel(intermediateTexture, textureSampler, sampleCoord, 0.0);
                      dilatedValue = max(dilatedValue, sampleValue.a);
                  }
              }

              // \u30B9\u30C6\u30C3\u30D72: \u53CE\u7E2E\u64CD\u4F5C\uFF08Erosion\uFF09
              // \u3053\u308C\u306B\u3088\u308A\u7A81\u8D77\u3084\u30AE\u30B6\u30AE\u30B6\u304C\u524A\u3089\u308C\u307E\u3059
              var erodedValue = 1.0;

              // \u53CE\u7E2E\u30AB\u30FC\u30CD\u30EB\u306F\u62E1\u5F35\u3088\u308A\u5C11\u3057\u5C0F\u3055\u304F
              let erosionKernelSize = max(1, kernelSize - 1);

              for (var dy = -erosionKernelSize; dy <= erosionKernelSize; dy += 1) {
                  for (var dx = -erosionKernelSize; dx <= erosionKernelSize; dx += 1) {
                      let offset = vec2f(f32(dx), f32(dy)) / dims;
                      let sampleCoord = texCoord + offset;

                      // \u30C6\u30AF\u30B9\u30C1\u30E3\u306E\u7BC4\u56F2\u5916\u306F\u6700\u5C0F\u5024\u3068\u307F\u306A\u3059
                      if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                          sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                          erodedValue = 0.0;
                          continue;
                      }

                      // \u69CB\u9020\u5316\u8981\u7D20\uFF08\u5186\u5F62\u30AB\u30FC\u30CD\u30EB\uFF09\u306E\u6761\u4EF6
                      let dist = length(vec2f(f32(dx), f32(dy)));
                      if (dist > f32(erosionKernelSize)) {
                          continue;
                      }

                      // \u62E1\u5F35\u6E08\u307F\u5024\u3092\u4F7F\u7528\u3057\u3066\u53CE\u7E2E
                      let sampleValue = textureSampleLevel(intermediateTexture, textureSampler, sampleCoord, 0.0);
                      erodedValue = min(erodedValue, sampleValue.a);
                  }
              }

              // \u6700\u7D42\u7684\u306A\u30E2\u30FC\u30D5\u30A9\u30ED\u30B8\u30FC\u51E6\u7406\u7D50\u679C
              // \u307E\u305A\u62E1\u5F35\u3057\u3066\u304B\u3089\u53CE\u7E2E\u3059\u308B\u306E\u3067\u30AF\u30ED\u30FC\u30BA\u64CD\u4F5C\uFF08Close\uFF09\u306B\u306A\u308B
              var morphValue = 0.0;

              // \u7DDA\u306E\u592A\u3055\u306B\u5FDC\u3058\u3066\u6319\u52D5\u3092\u8ABF\u6574
              if (scaledSize < 5.0) {
                  // \u7D30\u3044\u7DDA\u306F\u5143\u306E\u5024\u3092\u307B\u307C\u7DAD\u6301\uFF08\u8EFD\u5FAE\u306A\u30E2\u30FC\u30D5\u30A9\u30ED\u30B8\u30FC\uFF09
                  morphValue = mix(outlineIntensity, dilatedValue, 0.5);
              } else {
                  // \u592A\u3044\u7DDA\u306F\u30D5\u30EB\u51E6\u7406\uFF08\u30AF\u30ED\u30FC\u30BA\u64CD\u4F5C\uFF09
                  morphValue = erodedValue;
              }

              // \u95BE\u5024\u51E6\u7406\u3067\u30D0\u30A4\u30CA\u30EA\u30DE\u30B9\u30AF\u751F\u6210
              var binaryMask = 0.0;
              let threshold = 0.3;
              if (morphValue >= threshold) {
                  binaryMask = 1.0;
              }

              // \u6700\u7D42\u7684\u306A\u6ED1\u3089\u304B\u3055\u3092\u308F\u305A\u304B\u306B\u8FFD\u52A0
              var finalMask = binaryMask;

              // \u7D50\u679C\u306E\u5408\u6210
              var finalColor = vec4f(0.0, 0.0, 0.0, 0.0);
              if (originalColor.a > 0.01) {
                  // \u4E0D\u900F\u660E\u90E8\u5206\u306F\u5143\u306E\u753B\u50CF\u3092\u8868\u793A\uFF08\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u3092\u4E0A\u66F8\u304D\uFF09
                  finalColor = originalColor;
              } else {
                  // \u900F\u660E\u90E8\u5206\u306F\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u3092\u8868\u793A
                  finalColor = vec4f(
                    params.color.r,
                    params.color.g,
                    params.color.b,
                    finalMask * params.color.a
                  );
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
      const boundaryPipeline = device.createComputePipeline({
        label: "Outline Boundary Pipeline",
        layout: "auto",
        compute: {
          module: boundaryShader,
          entryPoint: "computeMain"
        }
      });
      const morphologyPipeline = device.createComputePipeline({
        label: "Outline Morphology Pipeline",
        layout: "auto",
        compute: {
          module: morphologyShader,
          entryPoint: "computeMain"
        }
      });
      return { device, boundaryPipeline, morphologyPipeline };
    },
    goLiveEffect: async ({ device, boundaryPipeline, morphologyPipeline }, params, imgData, env) => {
      console.log("Outline Effect Morphology V1", params);
      const padding = Math.ceil(params.size);
      imgData = await paddingImageData(imgData, padding);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const inputTexture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const intermediateTexture = device.createTexture({
        label: "Intermediate Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
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
        size: 96,
        // 必要なサイズ (フロート4個 + vec4 + パディング)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const boundaryBindGroup = device.createBindGroup({
        label: "Boundary Detection Bind Group",
        layout: boundaryPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView()
          },
          {
            binding: 1,
            resource: intermediateTexture.createView()
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
      const morphologyBindGroup = device.createBindGroup({
        label: "Morphology Bind Group",
        layout: morphologyPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView()
          },
          {
            binding: 1,
            resource: intermediateTexture.createView()
          },
          {
            binding: 2,
            resource: resultTexture.createView()
          },
          {
            binding: 3,
            resource: sampler
          },
          {
            binding: 4,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      const uniformData = new ArrayBuffer(96);
      const uniformView = new DataView(uniformData);
      uniformView.setFloat32(0, params.size, true);
      uniformView.setFloat32(16, params.color.r, true);
      uniformView.setFloat32(20, params.color.g, true);
      uniformView.setFloat32(24, params.color.b, true);
      uniformView.setFloat32(28, params.color.a, true);
      uniformView.setFloat32(32, env.dpi, true);
      uniformView.setFloat32(36, env.baseDpi, true);
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Morphology Outline Command Encoder"
      });
      const boundaryPass = commandEncoder.beginComputePass({
        label: "Boundary Detection Compute Pass"
      });
      boundaryPass.setPipeline(boundaryPipeline);
      boundaryPass.setBindGroup(0, boundaryBindGroup);
      boundaryPass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      boundaryPass.end();
      const morphologyPass = commandEncoder.beginComputePass({
        label: "Morphology Compute Pass"
      });
      morphologyPass.setPipeline(morphologyPipeline);
      morphologyPass.setBindGroup(0, morphologyBindGroup);
      morphologyPass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      morphologyPass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/halftone.ts
var t6 = createTranslator({
  en: {
    title: "Halftone Effect",
    dotSize: "Dot Size",
    dotInterval: "Dot Interval",
    dotAngle: "Dot Angle",
    dotColor: "Dot Color",
    color: "Color"
  },
  ja: {
    title: "\u30CF\u30FC\u30D5\u30C8\u30FC\u30F3\u30A8\u30D5\u30A7\u30AF\u30C8",
    dotSize: "\u30C9\u30C3\u30C8\u30B5\u30A4\u30BA",
    dotInterval: "\u30C9\u30C3\u30C8\u9593\u9694",
    dotAngle: "\u30C9\u30C3\u30C8\u306E\u89D2\u5EA6",
    dotColor: "\u30C9\u30C3\u30C8\u306E\u8272",
    color: "\u8272"
  }
});
var halftone = definePlugin({
  id: "halftone-effect-v1",
  title: t6("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      size: {
        type: "real",
        default: 4,
        min: 0.5,
        max: 100,
        description: "Dot size in pixels"
      },
      interval: {
        type: "real",
        default: 8,
        min: 4,
        max: 100,
        description: "Dot interval in pixels"
      },
      angle: {
        type: "real",
        default: 0,
        min: 0,
        max: 360,
        description: "Dot array angle in degrees"
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 0, a: 1 }
      }
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        color: adjustColor(params.color)
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        size: params.size * scaleFactor,
        interval: params.interval * scaleFactor,
        angle: params.angle
        // Angle doesn't need scaling
      };
    },
    onInterpolate: (paramsA, paramsB, t9) => {
      return {
        size: lerp(paramsA.size, paramsB.size, t9),
        interval: lerp(paramsA.interval, paramsB.interval, t9),
        angle: lerp(paramsA.angle, paramsB.angle, t9),
        color: {
          r: lerp(paramsA.color.r, paramsB.color.r, t9),
          g: lerp(paramsA.color.g, paramsB.color.g, t9),
          b: lerp(paramsA.color.b, paramsB.color.b, t9),
          a: lerp(paramsA.color.a, paramsB.color.a, t9)
        }
      };
    },
    renderUI: (params, setParam) => {
      const colorStr = toColorCode(params.color);
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t6("dotSize") }),
          ui.slider({
            key: "size",
            dataType: "float",
            min: 0.5,
            max: 100,
            value: params.size
          }),
          ui.numberInput({
            key: "size",
            dataType: "float",
            value: params.size
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t6("dotInterval") }),
          ui.slider({
            key: "interval",
            dataType: "float",
            min: 4,
            max: 100,
            value: params.interval
          }),
          ui.numberInput({
            key: "interval",
            dataType: "float",
            value: params.interval
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t6("dotAngle") }),
          ui.slider({
            key: "angle",
            dataType: "float",
            min: 0,
            max: 360,
            value: params.angle
          }),
          ui.numberInput({
            key: "angle",
            dataType: "float",
            value: params.angle
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t6("dotColor") }),
          ui.group({ direction: "row" }, [
            ui.colorInput({
              key: "color",
              label: t6("color"),
              value: params.color
            }),
            ui.textInput({
              key: "colorInput",
              value: colorStr,
              onChange: (e) => {
                setParam({ color: parseColorCode(e.value) });
              }
            })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then(
        (adapter) => adapter.requestDevice({
          label: "WebGPU(Halftone Effect)"
        })
      );
      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }
      const shader = device.createShaderModule({
        label: "Halftone Effect Shader",
        code: `
          struct Params {
            inputDpi: i32,
            baseDpi: i32,
            size: f32,
            interval: f32,
            angle: f32,
            color: vec4f,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          // Convert RGB to grayscale with alpha consideration
          fn rgbToGray(color: vec3f, alpha: f32) -> f32 {
            return dot(color.rgb, vec3f(0.299, 0.587, 0.114)) * alpha;
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
            let dims = vec2f(textureDimensions(inputTexture));
            let texCoord = vec2f(id.xy) / dims;

            // Calculate DPI scaling factor
            let dpiScale = f32(params.inputDpi) / f32(params.baseDpi);

            // Calculate cell size in pixels
            let cellSize = params.interval * dpiScale;

            // Convert angle from degrees to radians
            let angleRad = params.angle * 3.14159265359 / 180.0;

            // Create rotation matrix
            let cosAngle = cos(angleRad);
            let sinAngle = sin(angleRad);

            // Rotate the texture coordinates
            let centered = texCoord - 0.5;
            let rotated = vec2f(
              centered.x * cosAngle - centered.y * sinAngle,
              centered.x * sinAngle + centered.y * cosAngle
            );
            let rotatedTexCoord = rotated + 0.5;

            // Calculate cell coordinates and position within cell
            let cellCoord = vec2f(
              floor(rotatedTexCoord.x * dims.x / cellSize),
              floor(rotatedTexCoord.y * dims.y / cellSize)
            );

            let posInCell = vec2f(
              fract(rotatedTexCoord.x * dims.x / cellSize),
              fract(rotatedTexCoord.y * dims.y / cellSize)
            );

            // Calculate distance from center of cell
            let cellCenter = vec2f(0.5, 0.5);
            let dist = distance(posInCell, cellCenter);

            // Sample the image at the center of each cell
            let cellCenterInRotated = vec2f(
              (cellCoord.x + 0.5) * cellSize / dims.x,
              (cellCoord.y + 0.5) * cellSize / dims.y
            );

            // Rotate back to sample from the original image
            let cellCenterCentered = cellCenterInRotated - 0.5;
            let cellCenterUnrotated = vec2f(
              cellCenterCentered.x * cosAngle + cellCenterCentered.y * sinAngle,
              -cellCenterCentered.x * sinAngle + cellCenterCentered.y * cosAngle
            );
            let cellCenterCoord = cellCenterUnrotated + 0.5;

            // Clamp to valid texture coordinates
            let clampedCellCenterCoord = clamp(cellCenterCoord, vec2f(0.0), vec2f(1.0));
            let centerColor = textureSampleLevel(inputTexture, textureSampler, clampedCellCenterCoord, 0.0);
            let centerGray = rgbToGray(centerColor.rgb, centerColor.a);

            // Calculate dot size based on brightness
            let dotSizeFactor = centerGray;

            // Apply non-linear mapping for better contrast
            let adjustedFactor = pow(dotSizeFactor, 0.8);

            // Calculate dot radius in normalized cell space
            let sizeInPixels = params.size * dpiScale;
            let normalizedSize = sizeInPixels / cellSize;
            let dotRadius = (1.0 - adjustedFactor) * normalizedSize * 0.5;

            // Limit maximum dot size
            let scaledDotSize = min(dotRadius, 0.4);

            // Apply anti-aliasing at dot edges
            let edgeWidth = 0.01;
            let alpha = 1.0 - smoothstep(scaledDotSize - edgeWidth, scaledDotSize + edgeWidth, dist);

            // Create final color with transparency
            let finalColor = vec4f(params.color.rgb, params.color.a * alpha);

            // Only set color if we're inside or near the dot
            if (alpha > 0.001) {
              textureStore(resultTexture, id.xy, finalColor);
            } else {
              // Completely transparent outside dots
              textureStore(resultTexture, id.xy, vec4f(0.0, 0.0, 0.0, 0.0));
            }
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
        label: "Halftone Effect Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain"
        }
      });
      return { device, pipeline };
    },
    goLiveEffect: async ({ device, pipeline }, params, imgData, env) => {
      console.log("Halftone Effect", params);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const inputTexture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
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
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView()
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
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      const uniformData = new ArrayBuffer(48);
      const view = new DataView(uniformData);
      view.setInt32(0, env.dpi, true);
      view.setInt32(4, env.baseDpi, true);
      view.setFloat32(8, params.size, true);
      view.setFloat32(12, params.interval, true);
      view.setFloat32(16, params.angle, true);
      view.setFloat32(20, 0, true);
      view.setFloat32(32, params.color.r, true);
      view.setFloat32(36, params.color.g, true);
      view.setFloat32(40, params.color.b, true);
      view.setFloat32(44, params.color.a, true);
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Halftone Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Halftone Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/fluid-distortion.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions4,
  makeStructuredView as makeStructuredView4
} from "npm:webgpu-utils";
var t7 = createTranslator({
  en: {
    title: "Fluid Distortion V1",
    intensity: "Intensity",
    speed: "Speed",
    scale: "Scale",
    turbulence: "Turbulence",
    colorShift: "Color Shift",
    timeSeed: "Flow Seed",
    padding: "Padding"
  },
  ja: {
    title: "\u30D5\u30EB\u30A4\u30C9 \u30C7\u30A3\u30B9\u30C8\u30FC\u30B7\u30E7\u30F3 V11",
    intensity: "\u5F37\u5EA6",
    speed: "\u901F\u5EA6",
    scale: "\u30B9\u30B1\u30FC\u30EB",
    turbulence: "\u4E71\u6D41",
    colorShift: "\u8272\u30B7\u30D5\u30C8",
    timeSeed: "\u30D5\u30ED\u30FC\u30B7\u30FC\u30C9",
    padding: "\u30D1\u30C7\u30A3\u30F3\u30B0"
  }
});
var fluidDistortion = definePlugin({
  id: "fluid-distortion-v1",
  title: t7("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 20
      },
      speed: {
        type: "real",
        default: 0.5
      },
      scale: {
        type: "real",
        default: 3
      },
      turbulence: {
        type: "real",
        default: 0.3
      },
      colorShift: {
        type: "real",
        default: 0.1
      },
      padding: {
        type: "int",
        default: 0
      },
      timeSeed: {
        type: "real",
        default: 0
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        intensity: Math.max(0, params.intensity),
        speed: Math.max(0, params.speed),
        scale: Math.max(0.1, params.scale),
        turbulence: Math.max(0, params.turbulence),
        colorShift: Math.max(0, params.colorShift),
        timeSeed: params.timeSeed % 1e3
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        intensity: params.intensity * scaleFactor,
        scale: params.scale * scaleFactor,
        colorShift: params.colorShift
      };
    },
    onInterpolate: (paramsA, paramsB, t9) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t9),
        speed: lerp(paramsA.speed, paramsB.speed, t9),
        scale: lerp(paramsA.scale, paramsB.scale, t9),
        turbulence: lerp(paramsA.turbulence, paramsB.turbulence, t9),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t9),
        timeSeed: lerp(paramsA.timeSeed, paramsB.timeSeed, t9)
      };
    },
    renderUI: (params, setParam) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "intensity",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.intensity
            }),
            ui.numberInput({
              key: "intensity",
              dataType: "float",
              value: params.intensity
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("speed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "speed",
              dataType: "float",
              min: 0,
              max: 5,
              value: params.speed
            }),
            ui.numberInput({
              key: "speed",
              dataType: "float",
              value: params.speed
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("scale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "scale",
              dataType: "float",
              min: 0.1,
              max: 20,
              value: params.scale
            }),
            ui.numberInput({
              key: "scale",
              dataType: "float",
              value: params.scale
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("turbulence") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "turbulence",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.turbulence
            }),
            ui.numberInput({
              key: "turbulence",
              dataType: "float",
              value: params.turbulence
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "colorShift",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.colorShift
            }),
            ui.numberInput({
              key: "colorShift",
              dataType: "float",
              value: params.colorShift
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("timeSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "timeSeed",
              dataType: "float",
              min: 0,
              max: 1e3,
              value: params.timeSeed
            }),
            ui.numberInput({
              key: "timeSeed",
              dataType: "float",
              value: params.timeSeed
            })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t7("padding") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "padding",
              dataType: "int",
              min: 0,
              max: 600,
              value: params.padding
            }),
            ui.numberInput({
              key: "padding",
              dataType: "int",
              value: params.padding
            })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Fluid Distortion)" }
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: i32,
              baseDpi: i32,
              intensity: f32,
              speed: f32,
              scale: f32,
              turbulence: f32,
              colorShift: f32,
              timeSeed: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Simplex noise functions based on https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
            fn permute4(x: vec4f) -> vec4f {
              return ((x * 34.0) + 1.0) * x % 289.0;
            }

            fn taylorInvSqrt4(r: vec4f) -> vec4f {
              return 1.79284291400159 - 0.85373472095314 * r;
            }

            fn noise3D(v: vec3f) -> f32 {
              let C = vec2f(1.0 / 6.0, 1.0 / 3.0);
              let D = vec4f(0.0, 0.5, 1.0, 2.0);

              // First corner
              var i = floor(v + dot(v, C.yyy));
              let x0 = v - i + dot(i, C.xxx);

              // Other corners
              let g = step(x0.yzx, x0.xyz);
              let l = 1.0 - g;
              let i1 = min(g.xyz, l.zxy);
              let i2 = max(g.xyz, l.zxy);

              // x0 = x0 - 0.0 + 0.0 * C.xxx;
              let x1 = x0 - i1 + 1.0 * C.xxx;
              let x2 = x0 - i2 + 2.0 * C.xxx;
              let x3 = x0 - 1.0 + 3.0 * C.xxx;

              // Permutations
              i = i % 289.0;
              let p = permute4(permute4(permute4(
                      i.z + vec4f(0.0, i1.z, i2.z, 1.0)) +
                      i.y + vec4f(0.0, i1.y, i2.y, 1.0)) +
                      i.x + vec4f(0.0, i1.x, i2.x, 1.0));

              // Gradients
              let n_ = 1.0 / 7.0; // N=7
              let ns = n_ * D.wyz - D.xzx;

              let j = p - 49.0 * floor(p * ns.z * ns.z);

              let x_ = floor(j * ns.z);
              let y_ = floor(j - 7.0 * x_);

              let x = x_ * ns.x + ns.yyyy;
              let y = y_ * ns.x + ns.yyyy;
              let h = 1.0 - abs(x) - abs(y);

              let b0 = vec4f(x.xy, y.xy);
              let b1 = vec4f(x.zw, y.zw);

              let s0 = floor(b0) * 2.0 + 1.0;
              let s1 = floor(b1) * 2.0 + 1.0;
              let sh = -step(h, vec4f(0.0));

              let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
              let a1 = b1.xzyw + s1.xzyw * sh.zzww;

              var p0 = vec3f(a0.xy, h.x);
              var p1 = vec3f(a0.zw, h.y);
              var p2 = vec3f(a1.xy, h.z);
              var p3 = vec3f(a1.zw, h.w);

              // Normalise gradients
              let norm = taylorInvSqrt4(vec4f(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
              p0 = p0 * norm.x;
              p1 = p1 * norm.y;
              p2 = p2 * norm.z;
              p3 = p3 * norm.w;

              // Mix final noise value
              var m = max(0.6 - vec4f(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4f(0.0));
              m = m * m;
              return 42.0 * dot(m * m, vec4f(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
            }

            // Function to create fluid-like distortion
            fn fluidDistortion(uv: vec2f, time: f32, scale: f32, turbulence: f32) -> vec2f {
              let t = time * 0.1;

              // Create different frequency noise patterns
              // Base layer - smooth flow
              let baseNoiseX = noise3D(vec3f(uv.x * scale, uv.y * scale, t));
              let baseNoiseY = noise3D(vec3f(uv.x * scale * 1.2, uv.y * scale * 1.2, t * 1.3));

              // Turbulent layer - higher frequency and more chaotic
              let turbNoiseX = noise3D(vec3f(uv.y * scale * 2.5, uv.x * scale * 2.5, t * 1.7));
              let turbNoiseY = noise3D(vec3f(uv.y * scale * 3.0, uv.x * scale * 2.0, t * 1.9));

              // Additional chaotic pattern for extreme turbulence
              let chaosNoiseX = noise3D(vec3f(uv.y * scale * 4.0 + baseNoiseX, uv.x * scale * 3.5, t * 2.3));
              let chaosNoiseY = noise3D(vec3f(uv.x * scale * 4.5 + baseNoiseY, uv.y * scale * 4.0, t * 2.1));

              // Apply non-linear turbulence mixing for more dramatic effect
              let turb = turbulence * turbulence; // Non-linear scaling for stronger effect

              // First interpolate between base and turbulent noise
              let mixedNoiseX = mix(baseNoiseX, turbNoiseX, min(turb, 1.0));
              let mixedNoiseY = mix(baseNoiseY, turbNoiseY, min(turb, 1.0));

              // For high turbulence (>1.0), blend in chaotic patterns using select function
              let extremeFactor = max(0.0, turbulence - 1.0);
              let hasExtremeTurbulence = turbulence > 1.0;

              // Use the select function to conditionally mix in chaotic noise
              let finalNoiseX = select(
                mixedNoiseX,
                mix(mixedNoiseX, chaosNoiseX, extremeFactor),
                hasExtremeTurbulence
              );

              let finalNoiseY = select(
                mixedNoiseY,
                mix(mixedNoiseY, chaosNoiseY, extremeFactor),
                hasExtremeTurbulence
              );

              return vec2f(finalNoiseX, finalNoiseY);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dims = vec2f(textureDimensions(inputTexture));
                let texCoord = vec2f(id.xy) / dims;

                // Calculate DPI ratio to maintain consistent visual effect regardless of DPI
                // baseDpi is reference DPI (usually 72), inputDpi is current image DPI
                let dpiRatio = f32(params.baseDpi) / f32(params.inputDpi);

                // Apply fluid distortion with DPI-aware scaling
                // For fluid noise scale, we need to ensure consistent spatial frequency
                // We divide by dpiRatio so higher DPI will have smaller scale value,
                // resulting in the same visual pattern size
                let scaleFactor = params.scale / dpiRatio;
                let distortionVec = fluidDistortion(
                    texCoord,
                    params.timeSeed * params.speed,
                    scaleFactor,
                    params.turbulence
                );

                // Adjust distortion amount based on turbulence
                // We DON'T multiply by dpiRatio here so that intensity works consistently
                // across different DPI values
                let turbulenceBoost = 1.0 + (params.turbulence * 0.5);
                let distortionAmount = (params.intensity / 1000.0) * turbulenceBoost;
                let distortedCoord = texCoord + distortionVec * distortionAmount;

                // Apply chromatic aberration
                // We still need dpiRatio here for pixel-level effects to have the same
                // visual size regardless of resolution
                let chromaticShift = params.colorShift * 0.01 * (1.0 + params.turbulence * 0.3) * dpiRatio;
                let redOffset = distortedCoord + distortionVec * chromaticShift;
                let blueOffset = distortedCoord - distortionVec * chromaticShift;

                // Sample the texture with the distorted coordinates
                let colorR = textureSampleLevel(inputTexture, textureSampler, redOffset, 0.0).r;
                let colorG = textureSampleLevel(inputTexture, textureSampler, distortedCoord, 0.0).g;
                let colorB = textureSampleLevel(inputTexture, textureSampler, blueOffset, 0.0).b;
                let colorA = textureSampleLevel(inputTexture, textureSampler, distortedCoord, 0.0).a;

                let finalColor = vec4f(colorR, colorG, colorB, colorA);
                textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Fluid Distortion Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions4(code);
          device.addEventListener("lost", (e) => {
            console.error(e);
          });
          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });
          const pipeline = device.createComputePipeline({
            label: "Fluid Distortion Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({ device, pipeline, pipelineDef }, params, imgData, { dpi, baseDpi }) => {
      console.log("Fluid Distortion V1", params);
      const dpiRatio = baseDpi / dpi;
      const inverseDpiRatio = dpi / baseDpi;
      const intensityFactor = params.intensity / 10;
      const scaleFactor = 5 / Math.max(0.5, params.scale);
      const turbulenceFactor = params.turbulence * 1.5;
      const colorShiftFactor = params.colorShift * 2;
      const paddingSize = Math.ceil(
        (200 + (intensityFactor * scaleFactor * (1 + turbulenceFactor) + colorShiftFactor * params.intensity / 20)) * inverseDpiRatio
      );
      const minimumPadding = Math.ceil(5 * inverseDpiRatio);
      const finalPaddingSize = Math.max(minimumPadding, paddingSize);
      console.log(
        "Calculated padding size:",
        finalPaddingSize,
        "DPI:",
        dpi,
        "baseDPI:",
        baseDpi
      );
      imgData = await paddingImageData(imgData, finalPaddingSize);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat"
      });
      const uniformValues = makeStructuredView4(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      uniformValues.set({
        inputDpi: dpi,
        baseDpi,
        intensity: params.intensity,
        speed: params.speed,
        scale: params.scale * dpiRatio,
        turbulence: params.turbulence,
        colorShift: params.colorShift * dpiRatio,
        timeSeed: params.timeSeed
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
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
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      console.time("writeTexture");
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      console.timeEnd("writeTexture");
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Fluid Distortion Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      console.time("execute");
      device.queue.submit([commandEncoder.finish()]);
      console.timeEnd("execute");
      console.time("mapAsync");
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      console.timeEnd("mapAsync");
      console.time("getMappedRange");
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      console.timeEnd("getMappedRange");
      console.time("ImageData");
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      console.timeEnd("ImageData");
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/live-effects/kaleidoscope.ts
import {
  makeShaderDataDefinitions as makeShaderDataDefinitions5,
  makeStructuredView as makeStructuredView5
} from "npm:webgpu-utils";
var t8 = createTranslator({
  en: {
    title: "Kaleidoscope",
    segments: "Segments",
    pattern: "Pattern",
    rotation: "Rotation",
    centerX: "Sample Position X",
    centerY: "Sample Position Y",
    zoom: "Zoom",
    distortion: "Distortion",
    complexity: "Complexity",
    colorShift: "Color Shift",
    cellEffect: "Cell Reflection",
    cellSize: "Cell Size",
    blendMode: "Blend Mode",
    padding: "Padding",
    triangular: "Triangular",
    square: "Square",
    hexagonal: "Hexagonal",
    octagonal: "Octagonal",
    circular: "Circular",
    spiral: "Spiral",
    fractal: "Fractal",
    composite: "Composite",
    normal: "Normal",
    kaleidoscope: "Kaleidoscope",
    mirror: "Mirror",
    rotational: "Rotational"
  },
  ja: {
    title: "\u4E07\u83EF\u93E1",
    segments: "\u5206\u5272\u6570",
    pattern: "\u30D1\u30BF\u30FC\u30F3",
    rotation: "\u56DE\u8EE2",
    centerX: "\u30B5\u30F3\u30D7\u30EB\u4F4D\u7F6E X",
    centerY: "\u30B5\u30F3\u30D7\u30EB\u4F4D\u7F6E Y",
    zoom: "\u30BA\u30FC\u30E0",
    distortion: "\u6B6A\u307F",
    complexity: "\u8907\u96D1\u3055",
    colorShift: "\u8272\u30B7\u30D5\u30C8",
    cellEffect: "\u30BB\u30EB\u53CD\u5C04",
    cellSize: "\u30BB\u30EB\u30B5\u30A4\u30BA",
    blendMode: "\u30D6\u30EC\u30F3\u30C9\u30E2\u30FC\u30C9",
    padding: "\u30D1\u30C7\u30A3\u30F3\u30B0",
    triangular: "\u4E09\u89D2\u5F62",
    square: "\u56DB\u89D2\u5F62",
    hexagonal: "\u516D\u89D2\u5F62",
    octagonal: "\u516B\u89D2\u5F62",
    circular: "\u5186\u5F62",
    spiral: "\u6E26\u5DFB\u304D",
    fractal: "\u30D5\u30E9\u30AF\u30BF\u30EB",
    composite: "\u8907\u5408",
    normal: "\u30CE\u30FC\u30DE\u30EB",
    kaleidoscope: "\u4E07\u83EF\u93E1",
    mirror: "\u30DF\u30E9\u30FC",
    rotational: "\u56DE\u8EE2"
  }
});
var kaleidoscope = definePlugin({
  id: "kaleidoscope",
  title: t8("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      pattern: {
        type: "string",
        enum: [
          "triangular",
          "square",
          "hexagonal",
          "octagonal",
          "circular",
          "spiral",
          "fractal",
          "composite"
        ],
        default: "triangular"
      },
      segments: {
        type: "int",
        default: 6,
        min: 2,
        max: 36
      },
      rotation: {
        type: "real",
        default: 0,
        min: 0,
        max: 360
      },
      centerX: {
        type: "real",
        default: 0.5,
        min: -1,
        max: 2
      },
      centerY: {
        type: "real",
        default: 0.5,
        min: -1,
        max: 2
      },
      zoom: {
        type: "real",
        default: 1,
        min: 0.1,
        max: 5
      },
      distortion: {
        type: "real",
        default: 0,
        min: 0,
        max: 1
      },
      complexity: {
        type: "real",
        default: 0.5,
        min: 0,
        max: 1
      },
      colorShift: {
        type: "real",
        default: 0,
        min: 0,
        max: 1
      },
      cellEffect: {
        type: "real",
        default: 0,
        min: 0,
        max: 1
      },
      cellSize: {
        type: "real",
        default: 0.2,
        min: 0.05,
        max: 1
      },
      blendMode: {
        type: "string",
        enum: ["normal", "kaleidoscope", "mirror", "rotational"],
        default: "normal"
      },
      padding: {
        type: "int",
        default: 0,
        min: 0,
        max: 500
      }
    },
    onEditParameters: (params) => {
      return {
        ...params,
        segments: Math.max(2, Math.min(36, Math.round(params.segments))),
        rotation: (params.rotation % 360 + 360) % 360,
        centerX: Math.max(-1, Math.min(2, params.centerX)),
        centerY: Math.max(-1, Math.min(2, params.centerY)),
        zoom: Math.max(0.1, Math.min(5, params.zoom)),
        distortion: Math.max(0, Math.min(1, params.distortion)),
        complexity: Math.max(0, Math.min(1, params.complexity)),
        colorShift: Math.max(0, Math.min(1, params.colorShift)),
        cellEffect: Math.max(0, Math.min(1, params.cellEffect)),
        cellSize: Math.max(0.05, Math.min(1, params.cellSize)),
        padding: Math.max(0, Math.min(500, Math.round(params.padding)))
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params
        // Ex.
        // color: adjustColor(params.color),
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        padding: Math.round(params.padding * scaleFactor)
      };
    },
    onInterpolate: (paramsA, paramsB, t9) => {
      return {
        pattern: t9 < 0.5 ? paramsA.pattern : paramsB.pattern,
        segments: Math.round(lerp(paramsA.segments, paramsB.segments, t9)),
        rotation: lerp(paramsA.rotation, paramsB.rotation, t9),
        centerX: lerp(paramsA.centerX, paramsB.centerX, t9),
        centerY: lerp(paramsA.centerY, paramsB.centerY, t9),
        zoom: lerp(paramsA.zoom, paramsB.zoom, t9),
        distortion: lerp(paramsA.distortion, paramsB.distortion, t9),
        complexity: lerp(paramsA.complexity, paramsB.complexity, t9),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t9),
        cellEffect: lerp(paramsA.cellEffect, paramsB.cellEffect, t9),
        cellSize: lerp(paramsA.cellSize, paramsB.cellSize, t9),
        blendMode: t9 < 0.5 ? paramsA.blendMode : paramsB.blendMode,
        padding: Math.round(lerp(paramsA.padding, paramsB.padding, t9))
      };
    },
    renderUI: (params, setParam) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("pattern") }),
          ui.select({ key: "pattern", value: params.pattern, options: [
            { label: t8("triangular"), value: "triangular" },
            { label: t8("square"), value: "square" },
            { label: t8("hexagonal"), value: "hexagonal" },
            { label: t8("octagonal"), value: "octagonal" },
            { label: t8("circular"), value: "circular" },
            { label: t8("spiral"), value: "spiral" },
            { label: t8("fractal"), value: "fractal" },
            { label: t8("composite"), value: "composite" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("blendMode") }),
          ui.select({ key: "blendMode", value: params.blendMode, options: [
            { label: t8("normal"), value: "normal" },
            { label: t8("kaleidoscope"), value: "kaleidoscope" },
            { label: t8("mirror"), value: "mirror" },
            { label: t8("rotational"), value: "rotational" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("segments") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "segments", dataType: "int", min: 2, max: 36, value: params.segments }),
            ui.numberInput({ key: "segments", dataType: "int", value: params.segments })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("rotation") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "rotation", dataType: "float", min: 0, max: 360, value: params.rotation }),
            ui.numberInput({ key: "rotation", dataType: "float", value: params.rotation })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("centerX") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "centerX", dataType: "float", min: -1, max: 2, value: params.centerX }),
            ui.numberInput({ key: "centerX", dataType: "float", value: params.centerX })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("centerY") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "centerY", dataType: "float", min: -1, max: 2, value: params.centerY }),
            ui.numberInput({ key: "centerY", dataType: "float", value: params.centerY })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("zoom") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "zoom", dataType: "float", min: 0.1, max: 5, value: params.zoom }),
            ui.numberInput({ key: "zoom", dataType: "float", value: params.zoom })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("distortion") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "distortion", dataType: "float", min: 0, max: 1, value: params.distortion }),
            ui.numberInput({ key: "distortion", dataType: "float", value: params.distortion })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("complexity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "complexity", dataType: "float", min: 0, max: 1, value: params.complexity }),
            ui.numberInput({ key: "complexity", dataType: "float", value: params.complexity })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: "float", min: 0, max: 1, value: params.colorShift }),
            ui.numberInput({ key: "colorShift", dataType: "float", value: params.colorShift })
          ])
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t8("padding") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "padding", dataType: "int", min: 0, max: 500, value: params.padding }),
            ui.numberInput({ key: "padding", dataType: "int", value: params.padding })
          ])
        ])
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Kaleidoscope)" }
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: i32,
              baseDpi: i32,
              segments: i32,
              patternType: i32, // 0: triangular, 1: square, 2: hexagonal, 3: octagonal, 4: circular, 5: spiral, 6: fractal, 7: composite
              rotation: f32,    // in degrees
              centerX: f32,     // normalized 0-1 (sampling position)
              centerY: f32,     // normalized 0-1 (sampling position)
              zoom: f32,        // scale factor
              distortion: f32,  // 0-1
              complexity: f32,  // 0-1
              colorShift: f32,  // 0-1
              cellEffect: f32,  // 0-1
              cellSize: f32,    // cell size for reflection effect
              blendMode: i32    // 0: normal, 1: kaleidoscope, 2: mirror, 3: rotational
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Convert degrees to radians
            fn degToRad(degrees: f32) -> f32 {
              return degrees * 3.14159265359 / 180.0;
            }

            // Rotate a 2D point around a center
            fn rotate2D(point: vec2f, center: vec2f, angle: f32) -> vec2f {
              let s = sin(angle);
              let c = cos(angle);
              let p = point - center;
              return vec2f(
                p.x * c - p.y * s,
                p.x * s + p.y * c
              ) + center;
            }

            // Hash function to generate pseudo-random numbers
            fn hash(n: f32) -> f32 {
              return fract(sin(n) * 43758.5453);
            }

            // Hash function for 2D coordinates
            fn hash2D(p: vec2f) -> f32 {
              return hash(p.x + p.y * 57.0);
            }

            // Random 2D vector
            fn random2D(p: vec2f) -> vec2f {
              return vec2f(
                hash(p.x * 127.1 + p.y * 311.7),
                hash(p.x * 269.5 + p.y * 183.3)
              ) * 2.0 - 1.0;
            }

            // Voronoi/cellular noise for cell-based reflection
            fn voronoi(uv: vec2f, cellSize: f32) -> vec2f {
              let scaledUV = uv / cellSize;
              let cellUV = floor(scaledUV);
              let fractUV = vec2f(fract(scaledUV.x), fract(scaledUV.y));

              var minDist = 8.0;
              var cellPoint = vec2f(0.0, 0.0);
              var cellCenter = vec2f(0.0, 0.0);

              // Check surrounding cells (3x3 grid)
              for (var y = -1.0; y <= 1.0; y += 1.0) {
                for (var x = -1.0; x <= 1.0; x += 1.0) {
                  let cell = cellUV + vec2f(x, y);

                  // Get random point within this cell
                  let cellRandom = random2D(cell);
                  let pointPos = vec2f(x, y) + 0.5 + 0.5 * cellRandom;

                  // Calculate distance to this point
                  let diff = pointPos - fractUV;
                  let dist = length(diff);

                  if (dist < minDist) {
                    minDist = dist;
                    cellPoint = cell + pointPos;
                    cellCenter = cell + vec2f(0.5, 0.5);
                  }
                }
              }

              return vec2f(minDist, distance(cellPoint, cellCenter));
            }

            // Apply cell reflection/refraction effect
            fn applyCellEffect(coord: vec2f, center: vec2f, cellEffect: f32, cellSize: f32) -> vec2f {
              if (cellEffect <= 0.0) {
                return coord;
              }

              let voronoiResult = voronoi(coord, cellSize);
              let cellDistance = voronoiResult.x;
              let centerDistance = voronoiResult.y;

              // Create a refraction-like effect at cell boundaries
              let distortionStrength = smoothstep(0.0, 0.4, cellDistance) * (1.0 - smoothstep(0.4, 0.5, cellDistance));
              let distortionDirection = normalize(coord - center) * (centerDistance * 0.5 + 0.5);

              // Apply the distortion
              return coord + distortionDirection * distortionStrength * cellEffect * 0.1;
            }

            // Generic distortion function
            fn applyDistortion(coord: vec2f, center: vec2f, distortionAmount: f32) -> vec2f {
              if (distortionAmount <= 0.0) {
                return coord;
              }

              let offset = coord - center;
              let distance = length(offset);
              let angle = atan2(offset.y, offset.x);

              // Apply wave distortion
              let wave = sin(distance * 10.0 * distortionAmount) * distortionAmount * 0.1;
              let distortedDistance = distance * (1.0 + wave);

              // Apply twirl distortion
              let twirl = distortionAmount * 5.0 * (1.0 - smoothstep(0.0, 0.5, distance));
              let distortedAngle = angle + twirl;

              return vec2f(
                center.x + cos(distortedAngle) * distortedDistance,
                center.y + sin(distortedAngle) * distortedDistance
              );
            }

            // Spiral transform
            fn spiralTransform(coord: vec2f, center: vec2f, complexity: f32, rotation: f32) -> vec2f {
              let offset = coord - center;
              let distance = length(offset);
              let angle = atan2(offset.y, offset.x) + rotation;

              // Apply logarithmic spiral transformation
              let spiralFactor = 0.1 + complexity * 0.4;
              let spiralAngle = angle + distance * spiralFactor * 10.0;

              return vec2f(
                center.x + cos(spiralAngle) * distance,
                center.y + sin(spiralAngle) * distance
              );
            }

            // Fractal transform using simplified Julia set approach
            fn fractalTransform(coord: vec2f, center: vec2f, complexity: f32, iterations: i32) -> vec2f {
              let z = (coord - center) * 2.0; // Scale to make patterns more visible
              let c = vec2f(
                -0.8 + complexity * 0.6,
                0.156
              );

              var result = z;
              for (var i = 0; i < iterations; i++) {
                if (length(result) > 2.0) {
                  break;
                }

                // z = z^2 + c (complex number math)
                result = vec2f(
                  result.x * result.x - result.y * result.y,
                  2.0 * result.x * result.y
                ) + c;
              }

              return center + result * 0.25; // Scale back down
            }

            // Apply triangular kaleidoscope pattern
            fn triangularPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the angle
              let segmentAngle = 2.0 * 3.14159265359 / f32(segments);
              let segmentIndex = floor(angle / segmentAngle);
              let segmentPosition = angle - segmentAngle * segmentIndex;

              // Mirror alternate segments
              let isEven = segmentIndex % 2.0;
              let finalAngle = select(segmentAngle - segmentPosition, segmentPosition, isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(finalAngle) * distance,
                sin(finalAngle) * distance
              );

              return finalOffset + center;
            }

            // Apply square kaleidoscope pattern
            fn squarePattern(uv: vec2f, center: vec2f, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Mirror across both axes
              let mirroredOffset = vec2f(abs(offset.x), abs(offset.y));

              return mirroredOffset + center;
            }

            // Apply hexagonal kaleidoscope pattern
            fn hexagonalPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              // Hexagonal is a variant of triangular with some adjustments
              let segmentCount = segments * 2; // Double segments for hexagonal effect
              return triangularPattern(uv, center, segmentCount, rotation);
            }

            // Apply octagonal kaleidoscope pattern
            fn octagonalPattern(uv: vec2f, center: vec2f, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the angle into 8 parts
              let segmentAngle = 2.0 * 3.14159265359 / 8.0;
              let segmentIndex = floor(angle / segmentAngle);
              let segmentPosition = angle - segmentAngle * segmentIndex;

              // Mirror every second segment
              let isEven = segmentIndex % 2.0;
              let finalAngle = select(segmentAngle - segmentPosition, segmentPosition, isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(finalAngle) * distance,
                sin(finalAngle) * distance
              );

              return finalOffset + center;
            }

            // Apply circular kaleidoscope pattern
            fn circularPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the radial distance
              let segmentWidth = 0.1; // Adjust based on desired effect
              let segmentIndex = floor(distance / segmentWidth);
              let isEven = segmentIndex % 2.0;

              // Mirror every second circular ring
              let finalDistance = select(distance,
                segmentWidth * (segmentIndex + 1.0) - (distance - segmentWidth * segmentIndex),
                isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(angle) * finalDistance,
                sin(angle) * finalDistance
              );

              return finalOffset + center;
            }

            // Composite pattern that combines multiple patterns
            fn compositePattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32, complexity: f32) -> vec2f {
              // First apply triangular pattern
              let pattern1 = triangularPattern(uv, center, segments, rotation);

              // Then apply circular pattern with slight modification
              let pattern2 = circularPattern(pattern1, center, segments, rotation + 0.3);

              // Mix based on complexity
              let mix = smoothstep(0.3, 0.7, complexity);
              return mix * pattern2 + (1.0 - mix) * pattern1;
            }

            // Blend two coordinates based on blend mode
            fn blendCoordinates(coord1: vec2f, coord2: vec2f, blendMode: i32, factor: f32) -> vec2f {
              if (blendMode == 0) { // Normal
                return coord1;
              } else if (blendMode == 1) { // Kaleidoscope
                return mix(coord1, coord2, factor);
              } else if (blendMode == 2) { // Mirror
                let dist1 = length(coord1);
                let dist2 = length(coord2);
                return select(coord1, coord2, dist1 > dist2);
              } else { // Rotational
                let angle = factor * 6.28318;
                let c = cos(angle);
                let s = sin(angle);
                return c * coord1 + s * coord2;
              }
            }

            // Helper function for float fraction part
            fn fract(x: f32) -> f32 {
              return x - floor(x);
            }

            // Apply HSV color shift
            fn shiftColor(color: vec4f, shift: f32) -> vec4f {
              if (shift <= 0.0) {
                return color;
              }

              // Simple HSV shift (hue rotation)
              // Convert RGB to HSV-like space
              let maxC = max(max(color.r, color.g), color.b);
              let minC = min(min(color.r, color.g), color.b);
              let delta = maxC - minC;

              var h: f32 = 0.0;
              if (delta > 0.0) {
                if (maxC == color.r) {
                  h = 6.0 + (color.g - color.b) / delta;
                } else if (maxC == color.g) {
                  h = 2.0 + (color.b - color.r) / delta;
                } else {
                  h = 4.0 + (color.r - color.g) / delta;
                }
                h = h % 6.0;
              }

              // Apply hue shift
              h = (h + shift * 6.0) % 6.0;

              // Convert back to RGB
              let sector = floor(h);
              let f = h - sector;

              let p = minC;
              let q = minC + (maxC - minC) * (1.0 - f);
              let t = minC + (maxC - minC) * f;

              var newColor: vec3f;

              if (sector == 0.0) {
                newColor = vec3f(maxC, t, p);
              } else if (sector == 1.0) {
                newColor = vec3f(q, maxC, p);
              } else if (sector == 2.0) {
                newColor = vec3f(p, maxC, t);
              } else if (sector == 3.0) {
                newColor = vec3f(p, q, maxC);
              } else if (sector == 4.0) {
                newColor = vec3f(t, p, maxC);
              } else {
                newColor = vec3f(maxC, p, q);
              }

              return vec4f(newColor, color.a);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dims = vec2f(textureDimensions(inputTexture));
                let texCoord = vec2f(id.xy) / dims;

                // Fixed kaleidoscope center at image center
                let kaleidoscopeCenter = vec2f(0.5, 0.5);

                // Sample position based on centerX/Y parameters
                let samplePosition = vec2f(params.centerX, params.centerY);

                // Calculate texture coordinate offset from sample position
                let sampleOffset = kaleidoscopeCenter - samplePosition;

                // Apply zoom and offset to the texture coordinates
                let offsetCoord = (texCoord - kaleidoscopeCenter) / params.zoom + sampleOffset + kaleidoscopeCenter;

                // Apply cellular effect (refraction through cells)
                let cellCoord = applyCellEffect(offsetCoord, kaleidoscopeCenter, params.cellEffect, params.cellSize);

                // Apply distortion if enabled
                let distortedCoord = applyDistortion(cellCoord, kaleidoscopeCenter, params.distortion);

                // Apply appropriate kaleidoscope pattern based on the selected type
                var finalCoord1: vec2f;
                var finalCoord2: vec2f;

                // Generate two different coordinates for blending
                if (params.patternType == 0) {
                    // Triangular
                    finalCoord1 = triangularPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = triangularPattern(distortedCoord, kaleidoscopeCenter, params.segments * 2, degToRad(params.rotation + 30.0));
                } else if (params.patternType == 1) {
                    // Square
                    finalCoord1 = squarePattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation));
                    finalCoord2 = squarePattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation + 45.0));
                } else if (params.patternType == 2) {
                    // Hexagonal
                    finalCoord1 = hexagonalPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = hexagonalPattern(distortedCoord, kaleidoscopeCenter, params.segments + 2, degToRad(params.rotation + 15.0));
                } else if (params.patternType == 3) {
                    // Octagonal
                    finalCoord1 = octagonalPattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation));
                    finalCoord2 = octagonalPattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation + 22.5));
                } else if (params.patternType == 4) {
                    // Circular
                    finalCoord1 = circularPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = circularPattern(distortedCoord, kaleidoscopeCenter, params.segments + 1, degToRad(params.rotation));
                } else if (params.patternType == 5) {
                    // Spiral
                    finalCoord1 = spiralTransform(distortedCoord, kaleidoscopeCenter, params.complexity, degToRad(params.rotation));
                    finalCoord2 = spiralTransform(distortedCoord, kaleidoscopeCenter, params.complexity * 0.7, degToRad(params.rotation + 30.0));
                } else if (params.patternType == 6) {
                    // Fractal
                    let iterations = 2 + i32(params.complexity * 8.0);
                    finalCoord1 = fractalTransform(distortedCoord, kaleidoscopeCenter, params.complexity, iterations);
                    finalCoord2 = fractalTransform(distortedCoord, kaleidoscopeCenter, params.complexity * 1.1, iterations - 1);
                } else {
                    // Composite
                    finalCoord1 = compositePattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation), params.complexity);
                    finalCoord2 = compositePattern(distortedCoord, kaleidoscopeCenter, params.segments + 1, degToRad(params.rotation + 10.0), params.complexity * 0.8);
                }

                // Blend the two coordinates based on blend mode
                let blendedCoord = blendCoordinates(finalCoord1, finalCoord2, params.blendMode, params.complexity);

                // Loop coordinates to create seamless tiling effect
                let loopedCoord = vec2f(
                    blendedCoord.x - floor(blendedCoord.x),
                    blendedCoord.y - floor(blendedCoord.y)
                );

                // Apply one final cell effect for refraction at seams
                let finalCellCoord = applyCellEffect(loopedCoord, kaleidoscopeCenter, params.cellEffect * 0.5, params.cellSize * 0.5);

                // Sample the original texture at the transformed coordinates
                let sampledColor = textureSampleLevel(inputTexture, textureSampler, finalCellCoord, 0.0);

                // Apply color shifting if enabled
                let finalColor = shiftColor(sampledColor, params.colorShift);

                textureStore(resultTexture, id.xy, finalColor);
            }
          `;
          const shader = device.createShaderModule({
            label: "Kaleidoscope Shader",
            code
          });
          const pipelineDef = makeShaderDataDefinitions5(code);
          device.addEventListener("lost", (e) => {
            console.error(e);
          });
          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });
          const pipeline = device.createComputePipeline({
            label: "Kaleidoscope Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain"
            }
          });
          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async ({
      /* RMIT: return value from initLiveEffect -> */
      device,
      pipeline,
      pipelineDef
    }, params, imgData, { dpi, baseDpi }) => {
      console.log("Kaleidoscope Effect", params);
      imgData = await paddingImageData(imgData, params.padding);
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
      });
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "linear",
        minFilter: "linear"
      });
      const uniformValues = makeStructuredView5(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const patternTypeMap = {
        triangular: 0,
        square: 1,
        hexagonal: 2,
        octagonal: 3,
        circular: 4,
        spiral: 5,
        fractal: 6,
        composite: 7
      };
      const blendModeMap = {
        normal: 0,
        kaleidoscope: 1,
        mirror: 2,
        rotational: 3
      };
      uniformValues.set({
        inputDpi: dpi,
        baseDpi,
        segments: params.segments,
        patternType: patternTypeMap[params.pattern] || 0,
        rotation: params.rotation,
        centerX: params.centerX,
        centerY: params.centerY,
        zoom: params.zoom,
        distortion: params.distortion,
        complexity: params.complexity,
        colorShift: params.colorShift,
        cellEffect: params.cellEffect,
        cellSize: params.cellSize,
        blendMode: blendModeMap[params.blendMode] || 0
      });
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);
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
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder"
      });
      const computePass = commandEncoder.beginComputePass({
        label: "Kaleidoscope Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );
      device.queue.submit([commandEncoder.finish()]);
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    }
  }
});

// src/js/src/main.ts
var EFFECTS_DIR = new URL(toFileUrl2(join2(homedir(), ".ai-deno/effects")));
var allPlugins = [
  // blurEffect,
  chromaticAberration,
  directionalBlur,
  dithering,
  fluidDistortion,
  glitch,
  halftone,
  // innerGlow,
  kaleidoscope,
  kirakiraGlow,
  outlineEffect,
  // pixelSort,
  // randomNoiseEffect,
  testBlueFill
];
var effectInits = /* @__PURE__ */ new Map();
var allEffectPlugins = Object.fromEntries(
  allPlugins.filter((p) => !!p.liveEffect).map((p) => [p.id, p])
);
try {
  await Promise.all(
    Object.values(allEffectPlugins).map(
      async (effect) => {
        return retry(3, async () => {
          var _a, _b;
          try {
            effectInits.set(
              effect,
              await ((_b = (_a = effect.liveEffect).initLiveEffect) == null ? void 0 : _b.call(_a)) ?? {}
            );
          } catch (e) {
            throw new Error(
              `[effect: ${effect.id}] Failed to initialize effect`,
              {
                cause: e
              }
            );
          }
        });
      }
    )
  );
} catch (e) {
  console.error(e);
  if (e instanceof AggregateError) {
    const _e = e;
    const logs = _e.errors.map((e2) => `${e2.message}`).join("\n");
    _AI_DENO_.op_ai_alert("[AiDeno] Failed to initialize effects\n\n" + logs);
  }
}
async function loadEffects() {
  ensureDirSync(EFFECTS_DIR);
  logger.log("loadEffects", `${fromFileUrl(EFFECTS_DIR)}/*/meta.json`);
  const metas = [
    ...expandGlobSync(`${fromFileUrl(EFFECTS_DIR)}/*/meta.json`, {
      followSymlinks: true,
      includeDirs: false
    })
  ];
  logger.log("loadEffects metas", metas);
  await Promise.allSettled(
    metas.map((dir) => {
      logger.log("dir", dir);
    })
  );
}
function getLiveEffects() {
  logger.log("allEffectPlugins", allEffectPlugins);
  return Object.values(allEffectPlugins).map((effect) => ({
    id: effect.id,
    title: effect.title,
    version: effect.version
  }));
}
var nodeState = null;
function getEffectViewNode(id, params) {
  var _a, _b;
  const effect = findEffect(id);
  if (!effect) return null;
  params = getParams(id, params);
  params = ((_b = (_a = effect.liveEffect).onEditParameters) == null ? void 0 : _b.call(_a, params)) ?? params;
  let localNodeState = null;
  const setParam = (update) => {
    if (!localNodeState) {
      throw new Error("Unextected null localNodeState");
    }
    const clone = structuredClone(localNodeState.latestParams);
    if (typeof update === "function") {
      update = update(Object.freeze(clone));
    }
    const next = Object.assign({}, localNodeState.latestParams, update);
    localNodeState.latestParams = editLiveEffectParameters(id, next);
  };
  try {
    const tree = effect.liveEffect.renderUI(params, setParam);
    const nodeMap = attachNodeIds(tree);
    nodeState = localNodeState = {
      effectId: effect.id,
      nodeMap,
      latestParams: params
    };
    return tree;
  } catch (e) {
    logger.error(e);
    throw e;
  }
}
function editLiveEffectParameters(id, params) {
  var _a, _b;
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  return ((_b = (_a = effect.liveEffect).onEditParameters) == null ? void 0 : _b.call(_a, params)) ?? params;
}
async function editLiveEffectFireCallback(effectId, event, params) {
  const effect = findEffect(effectId);
  const node = nodeState == null ? void 0 : nodeState.nodeMap.get(event.nodeId);
  if (!effect || !node || !nodeState || nodeState.effectId !== effectId) {
    return {
      updated: false
    };
  }
  console.log(params);
  nodeState.latestParams = structuredClone(params);
  const current = params;
  switch (event.type) {
    case "click": {
      if ("onClick" in node && typeof node.onClick === "function")
        await node.onClick({ type: "click" });
      break;
    }
    case "change": {
      if ("onChange" in node && typeof node.onChange === "function") {
        await node.onChange({
          type: "change",
          value: event.value
        });
      }
    }
  }
  if (isEqual(current, nodeState.latestParams)) {
    return {
      updated: false
    };
  }
  return {
    updated: true,
    params: nodeState.latestParams,
    tree: getEffectViewNode(effectId, nodeState.latestParams)
  };
}
function attachNodeIds(node) {
  const nodeMap = /* @__PURE__ */ new Map();
  const traverseNode = (node2, nodeId = "") => {
    if (node2 == null) return;
    node2.nodeId = nodeId;
    nodeMap.set(nodeId, node2);
    if (node2.type === "group") {
      node2.children.forEach((child, index) => {
        if (child == null) return;
        traverseNode(child, `${node2.nodeId}.${index}-${child.type}`);
      });
    }
  };
  traverseNode(node, ".root");
  return nodeMap;
}
function liveEffectAdjustColors(id, params, adjustCallback) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = structuredClone(getParams(id, params));
  const result = effect.liveEffect.onAdjustColors(params, adjustCallback);
  return {
    hasChanged: !isEqual(result, params),
    params: result
  };
}
function liveEffectScaleParameters(id, params, scaleFactor) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  const result = effect.liveEffect.onScaleParams(params, scaleFactor);
  return {
    hasChanged: result != null,
    params: result ?? params
  };
}
function liveEffectInterpolate(id, params, params2, t9) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  params2 = getParams(id, params2);
  return effect.liveEffect.onInterpolate(params, params2, t9);
}
var goLiveEffect = async (id, params, env, width, height, data) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultParams = getDefaultValus(id);
  const init = effectInits.get(effect);
  if (!init) {
    logger.error("Effect not initialized", id);
    return null;
  }
  logger.log("goLiveEffect", { id, input: { width, height }, env, params });
  logger.log("--- LiveEffect Logs ---");
  try {
    const dpiScale = env.dpi / env.baseDpi;
    const input = {
      data,
      width,
      height
    };
    const result = await effect.liveEffect.goLiveEffect(
      init,
      {
        ...defaultParams,
        ...params
      },
      input,
      {
        ...env
      }
    );
    if (typeof result.width !== "number" || typeof result.height !== "number" || !(result.data instanceof Uint8ClampedArray)) {
      throw new Error("Invalid result from goLiveEffect");
    }
    return result;
  } catch (e) {
    logger.error(e);
    throw e;
  }
};
function getParams(effectId, state) {
  const effect = findEffect(effectId);
  if (!effect) return null;
  const defaultValues = getDefaultValus(effectId);
  return {
    ...defaultValues,
    ...state
  };
}
var getDefaultValus = (effectId) => {
  const effect = findEffect(effectId);
  if (!effect) return null;
  return Object.fromEntries(
    Object.entries(effect.liveEffect.paramSchema).map(([key, value]) => [
      key,
      structuredClone(value.default)
    ])
  );
};
function findEffect(id) {
  const effect = allEffectPlugins[id];
  if (!effect) logger.error(`Effect not found: ${id}`);
  return effect;
}
async function retry(maxRetries, fn) {
  const errors = [];
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (e) {
      errors.push(e);
      retries++;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new AggregateError(errors, "All retries failed");
}
export {
  editLiveEffectFireCallback,
  editLiveEffectParameters,
  getEffectViewNode,
  getLiveEffects,
  goLiveEffect,
  liveEffectAdjustColors,
  liveEffectInterpolate,
  liveEffectScaleParameters,
  loadEffects
};
