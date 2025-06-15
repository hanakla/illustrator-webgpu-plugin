import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag, definePlugin, ColorRGBA } from "../plugin.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
  parseColorCode,
  toColorCode,
} from "./_utils.ts";
import { createGPUDevice, includeOklabMix } from "./_shared.ts";

const t = createTranslator({
  en: {
    title: "Posterization V1",
    levels: "Levels",
    strength: "Strength",
  },
  ja: {
    title: "階調化 V1",
    levels: "階調数",
    strength: "強度",
  },
});

export const posterization = definePlugin({
  id: "posterization-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Color",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      levels: {
        type: "int",
        default: 8,
      },
      strength: {
        type: "real",
        default: 1.0,
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        levels: Math.max(2, Math.min(256, params.levels)),
        strength: Math.max(0, Math.min(1, params.strength)),
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
        levels: Math.round(lerp(paramsA.levels, paramsB.levels, t)),
        strength: lerp(paramsA.strength, paramsB.strength, t),
      };
    },

    renderUI: (params, { setParam, useStateObject }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("levels") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "levels",
              dataType: "int",
              min: 2,
              max: 32,
              value: params.levels,
            }),
            ui.numberInput({
              key: "levels",
              dataType: "int",
              value: params.levels,
            }),
          ]),
        ]),
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
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Posterization V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              levels: i32,
              strength: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn posterizeChannel(value: f32, levels: f32) -> f32 {
              return floor(value * (levels - 1.0) + 0.5) / (levels - 1.0);
            }

            fn posterizeColor(color: vec3f, levels: f32) -> vec3f {
              return vec3f(
                posterizeChannel(color.r, levels),
                posterizeChannel(color.g, levels),
                posterizeChannel(color.b, levels)
              );
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // Handle straight alpha: avoid processing nearly transparent pixels
              if (originalColor.a < 0.001) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let levels = f32(params.levels);
              let posterizedRGB = posterizeColor(originalColor.rgb, levels);

              let finalColor = vec4f(
                mix(originalColor.rgb, posterizedRGB, params.strength),
                originalColor.a
              );

              textureStore(resultTexture, id.xy, finalColor);
            }

            ${includeOklabMix()}
          `;

          const shader = device.createShaderModule({
            label: "Posterization V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Posterization V1 Pipeline",
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
      console.log("Posterization V1", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      const texture = device.createTexture({
        label: "Posterization Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Posterization Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Posterization Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Posterization Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        levels: params.levels,
        strength: params.strength,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Posterization Main Bind Group",
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
        label: "Posterization Compute Pass",
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
