// src/js/src/main.ts
import { expandGlobSync, ensureDirSync } from "jsr:@std/fs@1.0.14";
import { toFileUrl, join, fromFileUrl } from "jsr:@std/path@1.0.8";
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
  button: () => ({
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
var texts = (t3) => t3;
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
function lerp(a, b, t3) {
  return a + (b - a) * t3;
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
    editLiveEffectParameters: (params) => params,
    liveEffectScaleParameters: (params, scaleFactor) => params,
    liveEffectInterpolate: (paramsA, paramsB, t3) => paramsA,
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
      ui.button({
        text: "Test",
        onClick: () => console.log("Hi from TestBlueFill")
      }),
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
    ])
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

// src/js/src/live-effects/glow.ts
var glow = definePlugin({
  id: "glow-effect-v1",
  title: "Glow Effect V1",
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
    liveEffectInterpolate: (paramsA, paramsB, t3) => {
      return {
        strength: lerp(paramsA.strength, paramsB.strength, t3),
        transparentOriginal: t3 < 0.5 ? paramsA.transparentOriginal : paramsB.transparentOriginal
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
    liveEffectInterpolate: (paramsA, paramsB, t3) => {
      return {
        threshold: lerp(paramsA.threshold, paramsB.threshold, t3),
        strength: lerp(paramsA.strength, paramsB.strength, t3),
        patternType: t3 < 0.5 ? paramsA.patternType : paramsB.patternType,
        colorMode: t3 < 0.5 ? paramsA.colorMode : paramsB.colorMode
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

// src/js/src/main.ts
var EFFECTS_DIR = new URL(toFileUrl(join(homedir(), ".ai-deno/effects")));
var allPlugins = [
  // randomNoiseEffect,
  // blurEffect,
  glow,
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
}
function getLiveEffects() {
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
    if (typeof update === "function") {
      update = update(structuredClone(localNodeState.latestParams));
    }
    Object.assign(localNodeState.latestParams, update);
    localNodeState.latestParams = editLiveEffectParameters(
      id,
      localNodeState.latestParams
    );
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
    console.error(e);
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
  var _a;
  const effect = findEffect(effectId);
  if (!effect) return {};
  if (!nodeState || nodeState.effectId !== effectId) return {};
  const node = nodeState.nodeMap.get(event.nodeId);
  if (!node) {
    return {};
  }
  switch (event.type) {
    case "click":
      if ("onClick" in node) await ((_a = node.onClick) == null ? void 0 : _a.call(node, { type: "click" }));
      break;
  }
  return nodeState.latestParams;
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
function liveEffectInterpolate(id, params, params2, t3) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);
  params = getParams(id, params);
  params2 = getParams(id, params2);
  return effect.liveEffect.liveEffectInterpolate(params, params2, t3);
}
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
    console.error(e);
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
  if (!effect) console.error(`Effect not found: ${id}`);
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
  liveEffectInterpolate,
  liveEffectScaleParameters,
  loadEffects
};
