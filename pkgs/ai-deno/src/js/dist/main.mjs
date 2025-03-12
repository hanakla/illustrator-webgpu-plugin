// src/js/src/main.ts
import { expandGlobSync, ensureDirSync } from "jsr:@std/fs@1.0.14";
import { toFileUrl as toFileUrl2, join as join2, fromFileUrl } from "jsr:@std/path@1.0.8";
import { isEqual } from "jsr:@es-toolkit/es-toolkit@1.33.0";
import { homedir } from "node:os";

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
var texts = (t4) => t4;
function useTranslator(texts2) {
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
function lerp(a, b, t4) {
  return a + (b - a) * t4;
}

// src/js/src/live-effects/chromatic-aberration.ts
var t = useTranslator(
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
      }
    },
    editLiveEffectParameters: (params) => params,
    liveEffectInterpolate: (params, paramsB, progress) => ({
      colorMode: params.colorMode,
      strength: lerp(params.strength, paramsB.strength, progress),
      angle: lerp(params.angle, paramsB.angle, progress),
      opacity: lerp(params.opacity, paramsB.opacity, progress),
      blendMode: params.blendMode
    }),
    liveEffectScaleParameters: (params, scale) => ({
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
          ui.select({ key: "colorMode", label: t("colorMode"), value: params.colorMode, options: [
            { value: "rgb", label: "RGB" },
            { value: "cmyk", label: "CMYK" }
          ] })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.slider({ key: "strength", label: t("strength"), dataType: "float", min: 0, max: 200, value: params.strength })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("angle") }),
          ui.slider({ key: "angle", label: t("angle"), dataType: "float", min: 0, max: 360, value: params.angle })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("opacity") }),
          ui.slider({ key: "opacity", label: t("opacity"), dataType: "float", min: 0, max: 100, value: params.opacity })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Blend Mode" }),
          ui.select({ key: "blendMode", label: t("blendMode"), value: params.blendMode, options: [
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
      imgData = await paddingImageData(imgData, params.strength);
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
      main: 2 /* kPostEffectFilter */,
      features: []
    },
    editLiveEffectParameters: (params) => params,
    liveEffectScaleParameters: (params, scaleFactor) => params,
    liveEffectInterpolate: (paramsA, paramsB, t4) => paramsA,
    doLiveEffect: async (init, params, input) => {
      let width = input.width;
      let height = input.height;
      let len = input.data.length;
      global.lastInput = input;
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
            onClick: async () => {
              if (!global.lastInput) {
                alert("No input data");
                return;
              }
              const path = new URL(
                "./test-blue-fill.png",
                toFileUrl(join(Deno.cwd(), "./"))
              );
              const png = await toPng(global.lastInput);
              Deno.writeFile(path, new Uint8Array(await png.arrayBuffer()));
              console.log(`Saved to ${path}`);
            }
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
        // ui.text({ text: "Use new buffer" }),
        ui.checkbox({
          label: "Use new buffer",
          key: "useNewBuffer",
          value: params.useNewBuffer
        }),
        // ui.text({ text: "Fill other channels" }),
        ui.checkbox({
          label: "Fill other channels",
          key: "fillOtherChannels",
          value: params.fillOtherChannels
        }),
        ui.text({ text: "Color" }),
        ui.colorInput({
          key: "color",
          value: params.color
        }),
        ui.text({ text: "Padding" }),
        ui.slider({
          label: "Padding",
          key: "padding",
          dataType: "int",
          min: 0,
          max: 100,
          value: params.padding
        }),
        ui.text({ text: "Opacity" }),
        ui.slider({
          label: "Opacity",
          key: "opacity",
          dataType: "float",
          min: 0,
          max: 100,
          value: params.opacity
        })
      ]);
    }
  }
});

// src/js/src/live-effects/directional-blur.ts
var t2 = useTranslator({
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
      main: 2 /* kPostEffectFilter */,
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
    editLiveEffectParameters: (params) => params,
    liveEffectInterpolate: (a, b, progress) => {
      return {
        strength: lerp(a.strength, b.strength, progress),
        angle: lerp(a.angle, b.angle, progress),
        opacity: lerp(a.opacity, b.opacity, progress),
        blurMode: b.blurMode,
        fadeOut: lerp(a.fadeOut, b.fadeOut, progress),
        fadeDirection: lerp(a.fadeDirection, b.fadeDirection, progress)
      };
    },
    liveEffectScaleParameters: (params, scale) => {
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
            label: t2("strength"),
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
            label: t2("direction"),
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
            label: t2("direction"),
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
            label: t2("blurMode"),
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
            label: t2("fadeScale"),
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
            label: t2("fadeDirection"),
            dataType: "float",
            min: -1,
            max: 1,
            value: params.fadeDirection
          })
        ])
      ]);
    },
    initLiveEffect: async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          throw new Error("No GPU adapter found");
        }
        const device = await adapter.requestDevice();
        if (!device) {
          throw new Error("Failed to create WebGPU device");
        }
        const shader = device.createShaderModule({
          code: `
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
        `
        });
        const pipeline = device.createComputePipeline({
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeMain"
          }
        });
        return { device, pipeline };
      } catch (err) {
        console.error("WebGPU initialization error:", err);
        throw err;
      }
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      try {
        imgData = await paddingImageData(imgData, params.strength);
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
        const uniformBuffer = device.createBuffer({
          size: 24,
          // 6 * 4 bytes
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const uniformData = new ArrayBuffer(24);
        const dataView = new DataView(uniformData);
        const zeroArray = new Uint8Array(uniformData);
        zeroArray.fill(0);
        dataView.setFloat32(0, params.strength, true);
        dataView.setFloat32(4, params.angle, true);
        dataView.setFloat32(8, params.opacity, true);
        dataView.setUint32(12, blurModeValue, true);
        dataView.setFloat32(16, params.fadeOut || 0, true);
        dataView.setFloat32(20, params.fadeDirection || 0, true);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData);
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
var kirakiraGlow = definePlugin({
  id: "kirakira-glow-effect-v1",
  title: "KiraKira Glow V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: 2 /* kPostEffectFilter */,
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
      }
    },
    editLiveEffectParameters: (params) => {
      params.strength = Math.max(0, params.strength);
      return params;
    },
    liveEffectScaleParameters(params, scaleFactor) {
      return {
        strength: params.strength * scaleFactor,
        transparentOriginal: params.transparentOriginal
      };
    },
    liveEffectInterpolate: (paramsA, paramsB, t4) => {
      return {
        strength: lerp(paramsA.strength, paramsB.strength, t4),
        transparentOriginal: t4 < 0.5 ? paramsA.transparentOriginal : paramsB.transparentOriginal
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.slider({
            key: "strength",
            label: "Blur Strength",
            dataType: "float",
            min: 0,
            max: 500,
            value: params.strength
          })
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "transparentOriginal",
            label: "Transparent Original",
            value: params.transparentOriginal
          })
        ])
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then(
        (adapter) => adapter.requestDevice({
          label: "WebGPU(Glow Effect)"
        })
      );
      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }
      const shader = device.createShaderModule({
        label: "Glow Effect Shader",
        code: `
          struct Params {
            strength: f32,
            transparentOriginal: u32,
            width: u32,
            height: u32,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          // \u30AC\u30A6\u30B9\u95A2\u6570
          fn gaussian(x: f32, y: f32, sigma: f32) -> f32 {
            let sigma2 = sigma * sigma;
            return exp(-(x * x + y * y) / (2.0 * sigma2)) / (2.0 * 3.14159265359 * sigma2);
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // \u5143\u306E\u8272\u3092\u53D6\u5F97
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // \u30B7\u30B0\u30DE\u306Fstrength\u306E1/3
              let sigma = max(1.0, params.strength / 3.0);
              // \u30AB\u30FC\u30CD\u30EB\u30B5\u30A4\u30BA (\u6700\u592750\u30D4\u30AF\u30BB\u30EB)
              let kernelSize = i32(min(50.0, ceil(params.strength)));

              var totalWeight = 0.0;
              var totalColor = vec3f(0.0);
              var totalAlpha = 0.0;

              // \u30AC\u30A6\u30B9\u307C\u304B\u3057\u8A08\u7B97
              for (var y = -kernelSize; y <= kernelSize; y++) {
                  for (var x = -kernelSize; x <= kernelSize; x++) {
                      let weight = gaussian(f32(x), f32(y), sigma);
                      let sampleCoord = texCoord + vec2f(f32(x) / dims.x, f32(y) / dims.y);

                      if (sampleCoord.x >= 0.0 && sampleCoord.x <= 1.0 &&
                          sampleCoord.y >= 0.0 && sampleCoord.y <= 1.0) {
                          let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);

                          if (sampleColor.a > 0.001) {
                              // \u30A2\u30EB\u30D5\u30A1\u3092\u8003\u616E\u3057\u305F\u6B63\u3057\u3044\u8272\u306E\u51E6\u7406
                              let unpremultipliedColor = sampleColor.rgb / sampleColor.a;
                              totalColor += unpremultipliedColor * weight * sampleColor.a;
                              totalAlpha += sampleColor.a * weight;
                          }
                          totalWeight += weight;
                      }
                  }
              }

              // \u307C\u304B\u3057\u8272\u306E\u8A08\u7B97\u30682\u500D\u306B\u3059\u308B
              var blurredColor = vec4f(0.0);
              if (totalWeight > 0.0 && totalAlpha > 0.001) {
                  // \u30A2\u30EB\u30D5\u30A1\u3067\u5272\u3063\u3066\u6B63\u898F\u5316\u3057\u30662\u500D\u306B
                  let normalizedColor = totalColor / totalAlpha;
                  blurredColor = vec4f(normalizedColor, totalAlpha / totalWeight);
              }

              // \u6700\u7D42\u7684\u306A\u8272\u306E\u5408\u6210
              var finalColor: vec4f;

              if (params.transparentOriginal != 0u) {
                  // \u5143\u753B\u50CF\u3092\u900F\u660E\u306B\u3057\u3001\u307C\u304B\u3057\u305F\u753B\u50CF\u306E\u307F\u8868\u793A
                  finalColor = blurredColor;

                  // \u5143\u753B\u50CF\u304C\u5B58\u5728\u3059\u308B\u90E8\u5206\u3092\u900F\u660E\u306B\u3059\u308B
                  if (originalColor.a > 0.0) {
                      finalColor.a = finalColor.a * (1.0 - originalColor.a);
                  }
              } else {
                  // \u307E\u305A\u307C\u304B\u3057\u305F\u753B\u50CF\u3092\u63CF\u753B
                  finalColor = blurredColor;

                  // \u305D\u306E\u4E0A\u306B\u5143\u753B\u50CF\u3092\u91CD\u306D\u308B
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
      device.addEventListener("lost", (e) => {
        console.error(e);
      });
      device.addEventListener("uncapturederror", (e) => {
        console.error(e.error);
      });
      const pipeline = device.createComputePipeline({
        label: "Glow Effect Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain"
        }
      });
      return { device, pipeline };
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      console.log("Glow Effect V1", params);
      const padding = Math.ceil(params.strength);
      imgData = await paddingImageData(imgData, padding);
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
        // float(strength) + uint(transparentOriginal) + uint(width) + uint(height)
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
      uniformView.setFloat32(0, params.strength, true);
      uniformView.setUint32(4, params.transparentOriginal ? 1 : 0, true);
      uniformView.setUint32(8, inputWidth, true);
      uniformView.setUint32(12, inputHeight, true);
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
        label: "Glow Effect Compute Pass"
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

// src/js/src/live-effects/dithering.ts
var dithering = definePlugin({
  id: "dithering-effect-v1",
  title: "Dithering Effect V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: 2 /* kPostEffectFilter */,
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
    editLiveEffectParameters: (params) => {
      return params;
    },
    liveEffectScaleParameters(params, scaleFactor) {
      return {
        threshold: params.threshold,
        strength: params.strength,
        patternType: params.patternType,
        colorMode: params.colorMode
      };
    },
    liveEffectInterpolate: (paramsA, paramsB, t4) => {
      return {
        threshold: lerp(paramsA.threshold, paramsB.threshold, t4),
        strength: lerp(paramsA.strength, paramsB.strength, t4),
        patternType: t4 < 0.5 ? paramsA.patternType : paramsB.patternType,
        colorMode: t4 < 0.5 ? paramsA.colorMode : paramsB.colorMode
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
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
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

// src/js/src/live-effects/pixel-sort.ts
var t3 = useTranslator({
  en: {
    title: "Pixel Sort V1",
    algorithm: "Algorithm",
    methodBitonic: "Bitonic Sort",
    sortAmount: "Sort Amount",
    direction: "Direction",
    horizontal: "Horizontal",
    vertical: "Vertical",
    startPoint: "Start Point",
    thresholdMin: "Threshold Min",
    thresholdMax: "Threshold Max",
    sliceLeft: "Slice Left",
    sliceRight: "Slice Right",
    sliceTop: "Slice Top",
    sliceBottom: "Slice Bottom"
  },
  ja: {
    title: "\u30D4\u30AF\u30BB\u30EB\u30BD\u30FC\u30C8 V1",
    algorithm: "\u30A2\u30EB\u30B4\u30EA\u30BA\u30E0",
    methodBitonic: "\u30D0\u30A4\u30C8\u30CB\u30C3\u30AF\u30BD\u30FC\u30C8",
    sortAmount: "\u30BD\u30FC\u30C8\u91CF",
    direction: "\u65B9\u5411",
    horizontal: "\u6A2A",
    vertical: "\u7E26",
    startPoint: "\u59CB\u70B9",
    thresholdMin: "\u8F1D\u5EA6\u306E\u3057\u304D\u3044\u5024(\u6700\u5C0F)",
    thresholdMax: "\u8F1D\u5EA6\u306E\u3057\u304D\u3044\u5024(\u6700\u5927)",
    sliceLeft: "\u5DE6\u30B9\u30E9\u30A4\u30B9",
    sliceRight: "\u53F3\u30B9\u30E9\u30A4\u30B9",
    sliceTop: "\u4E0A\u30B9\u30E9\u30A4\u30B9",
    sliceBottom: "\u4E0B\u30B9\u30E9\u30A4\u30B9"
  }
});
var pixelSort = definePlugin({
  id: "pixel-sort-v1",
  title: t3("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: 2 /* kPostEffectFilter */,
      features: []
    },
    paramSchema: {
      sortAmount: {
        type: "real",
        default: 50
      },
      direction: {
        type: "string",
        enum: ["horizontal", "vertical"],
        default: "horizontal"
      },
      startPoint: {
        type: "real",
        default: 0
      },
      thresholdMin: {
        type: "real",
        default: 0
      },
      thresholdMax: {
        type: "real",
        default: 100
      },
      algorithm: {
        type: "string",
        enum: ["bitonic"],
        default: "bitonic"
      },
      sliceLeft: {
        type: "real",
        default: 0
      },
      sliceRight: {
        type: "real",
        default: 100
      },
      sliceTop: {
        type: "real",
        default: 0
      },
      sliceBottom: {
        type: "real",
        default: 100
      }
    },
    editLiveEffectParameters: (params) => {
      return {
        sortAmount: Math.max(0, Math.min(100, params.sortAmount)),
        direction: params.direction,
        startPoint: Math.max(0, Math.min(100, params.startPoint)),
        thresholdMin: Math.max(0, Math.min(100, params.thresholdMin)),
        thresholdMax: Math.max(0, Math.min(100, params.thresholdMax)),
        algorithm: params.algorithm,
        sliceLeft: Math.max(0, Math.min(100, params.sliceLeft)),
        sliceRight: Math.max(0, Math.min(100, params.sliceRight)),
        sliceTop: Math.max(0, Math.min(100, params.sliceTop)),
        sliceBottom: Math.max(0, Math.min(100, params.sliceBottom))
      };
    },
    liveEffectScaleParameters(params, scaleFactor) {
      return params;
    },
    liveEffectInterpolate: (paramsA, paramsB, t4) => {
      return {
        sortAmount: lerp(paramsA.sortAmount, paramsB.sortAmount, t4),
        direction: t4 < 0.5 ? paramsA.direction : paramsB.direction,
        startPoint: lerp(paramsA.startPoint, paramsB.startPoint, t4),
        thresholdMin: lerp(paramsA.thresholdMin, paramsB.thresholdMin, t4),
        thresholdMax: lerp(paramsA.thresholdMax, paramsB.thresholdMax, t4),
        algorithm: "bitonic",
        sliceLeft: lerp(paramsA.sliceLeft, paramsB.sliceLeft, t4),
        sliceRight: lerp(paramsA.sliceRight, paramsB.sliceRight, t4),
        sliceTop: lerp(paramsA.sliceTop, paramsB.sliceTop, t4),
        sliceBottom: lerp(paramsA.sliceBottom, paramsB.sliceBottom, t4)
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("algorithm") }),
          ui.select({
            key: "algorithm",
            label: t3("algorithm"),
            value: params.algorithm,
            options: [{ value: "bitonic", label: t3("methodBitonic") }]
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("sortAmount") }),
          ui.slider({
            key: "sortAmount",
            label: t3("sortAmount"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sortAmount
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("direction") }),
          ui.select({
            key: "direction",
            label: t3("direction"),
            value: params.direction,
            options: [
              { value: "horizontal", label: t3("horizontal") },
              { value: "vertical", label: t3("vertical") }
            ]
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("startPoint") }),
          ui.slider({
            key: "startPoint",
            label: t3("startPoint"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.startPoint
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("thresholdMin") }),
          ui.slider({
            key: "thresholdMin",
            label: t3("thresholdMin"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.thresholdMin
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("thresholdMax") }),
          ui.slider({
            key: "thresholdMax",
            label: t3("thresholdMax"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.thresholdMax
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("sliceLeft") }),
          ui.slider({
            key: "sliceLeft",
            label: t3("sliceLeft"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sliceLeft
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("sliceRight") }),
          ui.slider({
            key: "sliceRight",
            label: t3("sliceRight"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sliceRight
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("sliceTop") }),
          ui.slider({
            key: "sliceTop",
            label: t3("sliceTop"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sliceTop
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t3("sliceBottom") }),
          ui.slider({
            key: "sliceBottom",
            label: t3("sliceBottom"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sliceBottom
          })
        ])
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then(
        (adapter) => adapter.requestDevice({
          label: "WebGPU(Pixel Sort)"
        })
      );
      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }
      const shader = device.createShaderModule({
        label: "Pixel Sort Shader",
        code: `
          struct Params {
            sortAmount: f32,
            direction: u32,
            startPoint: f32,
            thresholdMin: f32,
            thresholdMax: f32,
            algorithm: u32,
            sliceLeft: f32,
            sliceRight: f32,
            sliceTop: f32,
            sliceBottom: f32,
            padding: u32,
          }

          @group(0) @binding(0) var inputTexture: texture_storage_2d<rgba8unorm, read>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(3) var<uniform> params: Params;

          // \u5171\u6709\u30E1\u30E2\u30EA - \u30EF\u30FC\u30AF\u30B0\u30EB\u30FC\u30D7\u5185\u3067\u30D4\u30AF\u30BB\u30EB\u30C7\u30FC\u30BF\u3092\u5171\u6709
          var<workgroup> groupCache: array<vec4f, 2048>;

          // \u8F1D\u5EA6\u8A08\u7B97\uFF08\u30A2\u30EB\u30D5\u30A1\u3092\u8003\u616E\u3057\u306A\u3044\uFF09
          fn getLuminance(color: vec4f) -> f32 {
            return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
          }

          // \u8F1D\u5EA6\u306E\u95BE\u5024\u5224\u5B9A
          fn isInThresholdRange(color: vec4f, minThreshold: f32, maxThreshold: f32) -> bool {
            let lum = getLuminance(color);
            return lum >= minThreshold && lum <= maxThreshold;
          }

          // 2\u3064\u306E\u30D4\u30AF\u30BB\u30EB\u3092\u6BD4\u8F03\u3057\u3066\u5165\u308C\u66FF\u3048
          fn compareAndSwap(a: u32, b: u32, ascending: bool) {
            let col_a = groupCache[a];
            let col_b = groupCache[b];

            let lum_a = getLuminance(col_a);
            let lum_b = getLuminance(col_b);

            let shouldSwap = (lum_a > lum_b) == ascending;

            if (shouldSwap) {
              groupCache[a] = col_b;
              groupCache[b] = col_a;
            }
          }

          @compute @workgroup_size(256, 1, 1)
          fn computeMain(@builtin(global_invocation_id) globalId: vec3u,
                          @builtin(local_invocation_id) localId: vec3u,
                          @builtin(workgroup_id) workgroupId: vec3u) {
            let dims = textureDimensions(inputTexture);

            // \u65B9\u5411\u306B\u5FDC\u3058\u305F\u51E6\u7406\u5BFE\u8C61\u306E\u9577\u3055\u3068\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u8A08\u7B97
            let lineLength = select(dims.y, dims.x, params.direction == 0u);
            let lineId = select(workgroupId.y, workgroupId.x, params.direction == 0u);

            // \u51E6\u7406\u306E\u7BC4\u56F2\u8A2D\u5B9A
            let startPoint = f32(params.startPoint / 100.0 * f32(lineLength));
            let thresholdMin = params.thresholdMin / 100.0;
            let thresholdMax = params.thresholdMax / 100.0;
            let sliceLeft = params.sliceLeft / 100.0;
            let sliceRight = params.sliceRight / 100.0;
            let sliceTop = params.sliceTop / 100.0;
            let sliceBottom = params.sliceBottom / 100.0;

            // \u30BD\u30FC\u30C8\u3059\u308B\u7BC4\u56F2\u3092\u5236\u9650\u3059\u308B
            let sortSize = i32(params.sortAmount / 100.0 * f32(lineLength - startPoint));
            if (sortSize <= 1) {
              return; // \u30BD\u30FC\u30C8\u30B5\u30A4\u30BA\u304C\u5C0F\u3055\u3059\u304E\u308B\u5834\u5408\u306F\u51E6\u7406\u3057\u306A\u3044
            }

            // \u6700\u5927\u30BD\u30FC\u30C8\u8981\u7D20\u6570 (2\u306E\u3079\u304D\u4E57\u306B\u5207\u308A\u4E0A\u3052)
            var maxSortSize = 1;
            while (maxSortSize < sortSize) {
              maxSortSize *= 2;
            }

            // \u5404\u30B9\u30EC\u30C3\u30C9\u304C\u30ED\u30FC\u30C9\u3059\u308B\u30D4\u30AF\u30BB\u30EB\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9
            for (var i = i32(localId.x); i < maxSortSize; i += 256) {
              // \u30B9\u30E9\u30A4\u30B9\u7BC4\u56F2\u3084\u958B\u59CB\u30DD\u30A4\u30F3\u30C8\u306E\u5224\u5B9A\u3092\u8003\u616E
              let pixelIdx = startPoint + i;
              if (pixelIdx >= lineLength) {
                // \u7BC4\u56F2\u5916\u306F\u51E6\u7406\u3057\u306A\u3044\u3001\u30C7\u30D5\u30A9\u30EB\u30C8\u5024\u3067\u57CB\u3081\u308B
                groupCache[i] = vec4f(0.0, 0.0, 0.0, 0.0);
                continue;
              }

              // \u30C6\u30AF\u30B9\u30C1\u30E3\u5EA7\u6A19\u306E\u8A08\u7B97
              var pos: vec2i;
              if (params.direction == 0u) { // \u6C34\u5E73\u65B9\u5411
                pos = vec2i(pixelIdx, lineId);
              } else { // \u5782\u76F4\u65B9\u5411
                pos = vec2i(lineId, pixelIdx);
              }

              // \u30B9\u30E9\u30A4\u30B9\u7BC4\u56F2\u30C1\u30A7\u30C3\u30AF
              let texCoord = vec2f(pos) / vec2f(dims);
              if (texCoord.x < sliceLeft || texCoord.x > sliceRight ||
                  texCoord.y < sliceTop || texCoord.y > sliceBottom) {
                // \u7BC4\u56F2\u5916\u306F\u51E6\u7406\u3057\u306A\u3044\u3001\u30C7\u30D5\u30A9\u30EB\u30C8\u5024\u3067\u57CB\u3081\u308B
                groupCache[i] = vec4f(0.0, 0.0, 0.0, 0.0);
                continue;
              }

              // \u30D4\u30AF\u30BB\u30EB\u3092\u8AAD\u307F\u53D6\u308A
              let color = textureLoad(inputTexture, pos);

              // \u95BE\u5024\u5224\u5B9A
              if (isInThresholdRange(color, thresholdMin, thresholdMax)) {
                groupCache[i] = color;
              } else {
                // \u8F1D\u5EA6\u304C\u7BC4\u56F2\u5916\u306E\u30D4\u30AF\u30BB\u30EB\u306F\u51E6\u7406\u3057\u306A\u3044\u305F\u3081\u306B\u30DE\u30FC\u30AF
                groupCache[i] = vec4f(color.rgb, 0.0); // \u30A2\u30EB\u30D5\u30A1\u30920\u306B\u3059\u308B
              }
            }

            // \u30D0\u30EA\u30A2\u3067\u540C\u671F - \u5168\u30B9\u30EC\u30C3\u30C9\u304C\u30C7\u30FC\u30BF\u3092\u30ED\u30FC\u30C9\u3057\u7D42\u308F\u308B\u307E\u3067\u5F85\u6A5F
            workgroupBarrier();

            // \u30D0\u30A4\u30C8\u30CB\u30C3\u30AF\u30BD\u30FC\u30C8\u306E\u5B9F\u88C5
            let maxLevel = 31 - firstLeadingBit(u32(maxSortSize));

            // \u5404\u30D5\u30A7\u30FC\u30BA\u3067\u306E\u30BD\u30FC\u30C8
            for (var phase = 0; phase < maxLevel; phase++) {
              // \u6BD4\u8F03\u30B5\u30A4\u30BA\u306E\u8A08\u7B97
              for (var compSize = 1 << phase; compSize > 0; compSize >>= 1) {
                // \u30D0\u30EA\u30A2\u3067\u540C\u671F
                workgroupBarrier();

                // \u5404\u30B9\u30EC\u30C3\u30C9\u304C\u51E6\u7406\u3059\u308B\u30D4\u30AF\u30BB\u30EB\u30DA\u30A2\u306E\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u8A08\u7B97
                for (var idx = i32(localId.x); idx < maxSortSize / 2; idx += 256) {
                  // \u5BFE\u5FDC\u3059\u308B\u30DA\u30A2\u3092\u53D6\u5F97
                  let a = idx * 2;
                  let halfBlock = compSize;
                  let blockStart = (a / (halfBlock * 2)) * (halfBlock * 2);
                  let blockOffset = a % (halfBlock * 2);

                  let b = blockStart + select(blockOffset < halfBlock
                              , blockOffset + halfBlock
                              , blockOffset - halfBlock);

                  // \u6607\u9806/\u964D\u9806\u3092\u6C7A\u5B9A
                  let blockId = a / (compSize * 2);
                  let ascending = (blockId % 2) == 0;

                  // \u30DA\u30A2\u306E\u6BD4\u8F03\u3068\u30B9\u30EF\u30C3\u30D7
                  compareAndSwap(u32(a), u32(b), ascending);
                }
              }
            }

            // \u30D0\u30EA\u30A2\u3067\u540C\u671F - \u30BD\u30FC\u30C8\u5B8C\u4E86\u307E\u3067\u5F85\u6A5F
            workgroupBarrier();

            // \u7D50\u679C\u3092\u66F8\u304D\u623B\u3059
            for (var i = i32(localId.x); i < maxSortSize; i += 256) {
              let pixelIdx = startPoint + i;
              if (pixelIdx >= lineLength) {
                continue; // \u7BC4\u56F2\u5916\u306F\u51E6\u7406\u3057\u306A\u3044
              }

              // \u30C6\u30AF\u30B9\u30C1\u30E3\u5EA7\u6A19\u306E\u8A08\u7B97
              var pos: vec2i;
              if (params.direction == 0u) { // \u6C34\u5E73\u65B9\u5411
                pos = vec2i(pixelIdx, lineId);
              } else { // \u5782\u76F4\u65B9\u5411
                pos = vec2i(lineId, pixelIdx);
              }

              // \u5143\u306E\u30D4\u30AF\u30BB\u30EB\u3092\u8AAD\u307F\u53D6\u308A
              let originalColor = textureLoad(inputTexture, pos);

              // \u30B9\u30E9\u30A4\u30B9\u7BC4\u56F2\u30C1\u30A7\u30C3\u30AF
              let texCoord = vec2f(pos) / vec2f(dims);
              if (texCoord.x < sliceLeft || texCoord.x > sliceRight ||
                  texCoord.y < sliceTop || texCoord.y > sliceBottom) {
                textureStore(resultTexture, pos, originalColor);
                continue;
              }

              // \u30BD\u30FC\u30C8\u5F8C\u306E\u30D4\u30AF\u30BB\u30EB
              let sortedColor = groupCache[i];

              // \u30A2\u30EB\u30D5\u30A1\u5024\u304C0\u306E\u30D4\u30AF\u30BB\u30EB\u306F\u51E6\u7406\u5BFE\u8C61\u5916\u3060\u3063\u305F\u30D4\u30AF\u30BB\u30EB
              if (sortedColor.a > 0.0) {
                textureStore(resultTexture, pos, sortedColor);
              } else {
                // \u51E6\u7406\u5BFE\u8C61\u5916\u306E\u30D4\u30AF\u30BB\u30EB\u306F\u5143\u306E\u5024\u3092\u4FDD\u6301
                textureStore(resultTexture, pos, originalColor);
              }
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
        label: "Pixel Sort Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain"
        }
      });
      return { device, pipeline };
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      const outputWidth = imgData.width, outputHeight = imgData.height;
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width, inputHeight = imgData.height;
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
      });
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING
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
            resource: texture.createView()
          },
          {
            binding: 1,
            resource: resultTexture.createView()
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
      view.setFloat32(0, params.sortAmount, true);
      view.setUint32(4, params.direction === "horizontal" ? 0 : 1, true);
      view.setFloat32(8, params.startPoint, true);
      view.setFloat32(12, params.thresholdMin, true);
      view.setFloat32(16, params.thresholdMax, true);
      view.setUint32(20, params.algorithm === "bitonic" ? 1 : 0, true);
      view.setFloat32(24, params.sliceLeft, true);
      view.setFloat32(28, params.sliceRight, true);
      view.setFloat32(32, params.sliceTop, true);
      view.setFloat32(36, params.sliceBottom, true);
      view.setUint32(40, 0, true);
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
        label: "Pixel Sort Compute Pass"
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      let dispatchX, dispatchY;
      if (params.direction === "horizontal") {
        dispatchY = inputHeight;
        dispatchX = 1;
      } else {
        dispatchX = inputWidth;
        dispatchY = 1;
      }
      computePass.dispatchWorkgroups(dispatchX, dispatchY);
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
var glitch = definePlugin({
  id: "glitch-effect-v1",
  title: "Glitch Effect V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: 2 /* kPostEffectFilter */,
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
        default: 0.3
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
    editLiveEffectParameters: (params) => {
      params.intensity = Math.max(0, Math.min(1, params.intensity));
      params.colorShift = Math.max(0, Math.min(1, params.colorShift));
      params.angle = Math.max(-1, Math.min(1, params.angle));
      params.bias = Math.max(-1, Math.min(1, params.bias));
      return params;
    },
    liveEffectScaleParameters(params, scaleFactor) {
      return params;
    },
    liveEffectInterpolate: (paramsA, paramsB, t4) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t4),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t4),
        slices: Math.round(lerp(paramsA.slices, paramsB.slices, t4)),
        angle: lerp(paramsA.angle, paramsB.angle, t4),
        bias: lerp(paramsA.bias, paramsB.bias, t4),
        seed: paramsA.seed
        // シード値は補間しない
      };
    },
    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: "Intensity" }),
          ui.slider({
            key: "intensity",
            label: "Intensity",
            dataType: "float",
            min: 0,
            max: 1,
            value: params.intensity
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Slices" }),
          ui.slider({
            key: "slices",
            label: "Slices",
            dataType: "int",
            min: 1,
            max: 100,
            value: params.slices
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Color Shift" }),
          ui.slider({
            key: "colorShift",
            label: "Color Shift",
            dataType: "float",
            min: 0,
            max: 1,
            value: params.colorShift
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Angle" }),
          ui.slider({
            key: "angle",
            label: "Angle",
            dataType: "float",
            min: -1,
            max: 1,
            value: params.angle
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Direction Bias" }),
          ui.slider({
            key: "bias",
            label: "Direction Bias",
            dataType: "float",
            min: -1,
            max: 1,
            value: params.bias
          })
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Seed" }),
          ui.slider({
            key: "seed",
            label: "Seed",
            dataType: "int",
            min: 0,
            max: 1e4,
            value: params.seed
          })
        ])
      ]);
    },
    initLiveEffect: async () => {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("WebGPU adapter not available");
      }
      const device = await adapter.requestDevice();
      const shader = device.createShaderModule({
        code: `
          struct Params {
            intensity: f32,
            colorShift: f32,
            slices: f32,
            angle: f32,
            bias: f32,
            seed: f32,
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
              // \u30B7\u30FC\u30C9\u5024\u3092\u4F7F\u7528\u3057\u3066\u30E9\u30F3\u30C0\u30E0\u5024\u3092\u8A08\u7B97
              let seed = params.seed;
              let random = fract(sin(sliceIndex * 43758.5453 + seed) * 43758.5453);

              if (random < params.intensity) {
                let shift = (random - 0.5 + params.bias * 0.5) * params.intensity * 0.2;

                // \u30B7\u30D5\u30C8\u65B9\u5411\u3082\u89D2\u5EA6\u306B\u5782\u76F4\u306A\u65B9\u5411\u306B
                let shiftAngle = angle + 3.14159 * 0.5; // \u5782\u76F4\u65B9\u5411\uFF0890\u5EA6\u56DE\u8EE2\uFF09
                let xShift = shift * cos(shiftAngle);
                let yShift = shift * sin(shiftAngle);

                shiftedCoord.x = clamp(texCoord.x + xShift, 0.0, 1.0);
                shiftedCoord.y = clamp(texCoord.y + yShift, 0.0, 1.0);
              }
            }

            let rOffset = params.colorShift * 0.05;

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
        `
      });
      const pipeline = device.createComputePipeline({
        compute: {
          module: shader,
          entryPoint: "computeMain"
        },
        layout: "auto"
      });
      return { device, pipeline };
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      imgData = await paddingImageData(imgData, params.colorShift);
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
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
      });
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      const uniformBuffer = device.createBuffer({
        size: 32,
        // 5つのf32値 + パディング = 32バイト (WebGPUでは16バイトアライメントが推奨)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const uniformData = new Float32Array([
        params.intensity,
        params.colorShift,
        Math.max(1, params.slices),
        params.angle,
        params.bias,
        params.seed,
        0,
        // パディング
        0
        // パディング
      ]);
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
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);
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

// src/js/src/logger.ts
var enableLogger = _AI_DENO_.op_aideno_debug_enabled();
console.log("[deno_ai(js)] enableLogger", enableLogger);
var logger = {
  log: (...args) => {
    if (!enableLogger) return;
    console.log("[deno_ai(js)]", ...args);
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

// src/js/src/main.ts
var EFFECTS_DIR = new URL(toFileUrl2(join2(homedir(), ".ai-deno/effects")));
var allPlugins = [
  // randomNoiseEffect,
  // blurEffect,
  glitch,
  pixelSort,
  kirakiraGlow,
  dithering,
  chromaticAberration,
  directionalBlur,
  testBlueFill
];
var effectInits = /* @__PURE__ */ new Map();
var allEffectPlugins = Object.fromEntries(
  allPlugins.filter((p) => !!p.liveEffect).map((p) => [p.id, p])
);
await Promise.all(
  Object.values(allEffectPlugins).map(
    async (effect) => {
      await retry(3, async () => {
        var _a, _b;
        effectInits.set(
          effect,
          await ((_b = (_a = effect.liveEffect).initLiveEffect) == null ? void 0 : _b.call(_a)) ?? {}
        );
      });
    }
  )
);
async function loadEffects() {
  ensureDirSync(EFFECTS_DIR);
  logger.log(
    "[deno_ai(js)] loadEffects",
    `${fromFileUrl(EFFECTS_DIR)}/*/meta.json`
  );
  const metas = [
    ...expandGlobSync(`${fromFileUrl(EFFECTS_DIR)}/*/meta.json`, {
      followSymlinks: true,
      includeDirs: false
    })
  ];
  logger.log("[deno_ai(js)] loadEffects metas", metas);
  await Promise.allSettled(
    metas.map((dir) => {
      logger.log("dir", dir);
    })
  );
}
function getLiveEffects() {
  logger.log("[deno_ai(js)] allEffectPlugins", allEffectPlugins);
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
  params = ((_b = (_a = effect.liveEffect).editLiveEffectParameters) == null ? void 0 : _b.call(_a, params)) ?? params;
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
  return ((_b = (_a = effect.liveEffect).editLiveEffectParameters) == null ? void 0 : _b.call(_a, params)) ?? params;
}
async function editLiveEffectFireCallback(effectId, event) {
  const effect = findEffect(effectId);
  const node = nodeState == null ? void 0 : nodeState.nodeMap.get(event.nodeId);
  if (!effect || !node || !nodeState || nodeState.effectId !== effectId) {
    return {
      updated: false
    };
  }
  const current = nodeState.latestParams;
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
    params: nodeState.latestParams
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
  params = getParams(id, params);
  const result = effect.liveEffect.liveEffectAdjustColors(
    params,
    adjustCallback
  );
  return {
    hasChanged: !isEqual(result, params),
    params: result
  };
}
function liveEffectScaleParameters(id, params, scaleFactor) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  const result = effect.liveEffect.liveEffectScaleParameters(
    params,
    scaleFactor
  );
  return {
    hasChanged: result != null,
    params: result ?? params
  };
}
function liveEffectInterpolate(id, params, params2, t4) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  params2 = getParams(id, params2);
  return effect.liveEffect.liveEffectInterpolate(params, params2, t4);
}
var doLiveEffect = async (id, state, width, height, data) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);
  const init = effectInits.get(effect);
  if (!init) {
    logger.error("Effect not initialized", id);
    return null;
  }
  logger.log("[deno_ai(js)] doLiveEffect", id, state, width, height);
  try {
    const result = await effect.liveEffect.doLiveEffect(
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
  doLiveEffect,
  editLiveEffectFireCallback,
  editLiveEffectParameters,
  getEffectViewNode,
  getLiveEffects,
  liveEffectAdjustColors,
  liveEffectInterpolate,
  liveEffectScaleParameters,
  loadEffects
};
