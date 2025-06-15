import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag, definePlugin, ColorRGBA } from "../../plugin.ts";
import { createTranslator } from "../../ui/locale.ts";
import { ui } from "../../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
  parseColorCode,
  toColorCode,
} from "../_utils.ts";
import { createGPUDevice, includeOklabMix } from "../_shared.ts";

const t = createTranslator({
  en: {
    title: "Sun Faded Filter V1",
    strength: "Strength",
    sepiaAmount: "Sepia Amount",
    brightness: "Brightness",
    contrast: "Contrast",
  },
  ja: {
    title: "日焼け色落ちフィルター V1",
    strength: "強度",
    sepiaAmount: "セピア量",
    brightness: "明度",
    contrast: "コントラスト",
  },
});

export const sunbrust = definePlugin({
  id: "sunbrust-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      strength: {
        type: "real",
        default: 0.7,
      },
      sepiaAmount: {
        type: "real",
        default: 0.3,
      },
      brightness: {
        type: "real",
        default: 0.9,
      },
      contrast: {
        type: "real",
        default: 0.8,
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        strength: Math.max(0, Math.min(1, params.strength)),
        sepiaAmount: Math.max(0, Math.min(1, params.sepiaAmount)),
        brightness: Math.max(0, Math.min(2, params.brightness)),
        contrast: Math.max(0, Math.min(2, params.contrast)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        strength: lerp(paramsA.strength, paramsB.strength, t),
        sepiaAmount: lerp(paramsA.sepiaAmount, paramsB.sepiaAmount, t),
        brightness: lerp(paramsA.brightness, paramsB.brightness, t),
        contrast: lerp(paramsA.contrast, paramsB.contrast, t),
      };
    },

    renderUI: (params, { setParam, useStateObject }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strength",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.strength,
            }),
            ui.numberInput({
              key: "strength",
              dataType: "float",
              value: params.strength,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("sepiaAmount") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "sepiaAmount",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.sepiaAmount,
            }),
            ui.numberInput({
              key: "sepiaAmount",
              dataType: "float",
              value: params.sepiaAmount,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("brightness") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "brightness",
              dataType: "float",
              min: 0.5,
              max: 1.5,
              value: params.brightness,
            }),
            ui.numberInput({
              key: "brightness",
              dataType: "float",
              value: params.brightness,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("contrast") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "contrast",
              dataType: "float",
              min: 0.3,
              max: 1.5,
              value: params.contrast,
            }),
            ui.numberInput({
              key: "contrast",
              dataType: "float",
              value: params.contrast,
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Sun Faded Filter V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              strength: f32,
              sepiaAmount: f32,
              brightness: f32,
              contrast: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn rgb2gray(color: vec3<f32>) -> f32 {
              return dot(color, vec3<f32>(0.299, 0.587, 0.114));
            }

            fn applySepiaMatrix(color: vec3<f32>) -> vec3<f32> {
              let r = color.r * 0.393 + color.g * 0.769 + color.b * 0.189;
              let g = color.r * 0.349 + color.g * 0.686 + color.b * 0.168;
              let b = color.r * 0.272 + color.g * 0.534 + color.b * 0.131;
              return vec3<f32>(r, g, b);
            }

            fn adjustContrast(color: vec3<f32>, contrast: f32) -> vec3<f32> {
              return ((color - 0.5) * contrast) + 0.5;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let grayValue = rgb2gray(originalColor.rgb);
              let desaturated = mix(originalColor.rgb, vec3<f32>(grayValue), params.strength * 0.6);

              let sepiaColor = applySepiaMatrix(desaturated);
              let withSepia = mix(desaturated, sepiaColor, params.sepiaAmount * params.strength);

              let brightnessAdjusted = withSepia * params.brightness;
              let contrastAdjusted = adjustContrast(brightnessAdjusted, params.contrast);

              let finalColor = vec4<f32>(clamp(contrastAdjusted, vec3<f32>(0.0), vec3<f32>(1.0)), originalColor.a);

              textureStore(resultTexture, id.xy, finalColor);
            }

            ${includeOklabMix()}
          `;

          const shader = device.createShaderModule({
            label: "Sun Faded Filter V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Sun Faded Filter V1 Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain",
            },
          });

          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async (
      { device, pipeline, pipelineDef },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Sun Faded Filter V1", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      const texture = device.createTexture({
        label: "Sun Faded Filter Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Sun Faded Filter Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Sun Faded Filter Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
      });

      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Sun Faded Filter Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        strength: params.strength,
        sepiaAmount: params.sepiaAmount,
        brightness: params.brightness,
        contrast: params.contrast,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Sun Faded Filter Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: texture.createView(),
          },
          {
            binding: 1,
            resource: resultTexture.createView(),
          },
          {
            binding: 2,
            resource: sampler,
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Sun Faded Filter Compute Pass",
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();

      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );

      device.queue.submit([commandEncoder.finish()]);

      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );

      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
