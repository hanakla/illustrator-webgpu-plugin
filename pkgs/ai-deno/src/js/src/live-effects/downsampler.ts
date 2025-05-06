import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../plugin.ts";
import { definePlugin, ColorRGBA } from "../plugin.ts";
import { createTranslator } from "../ui/locale.ts";
import { ChangeEventHandler, ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
  parseColorCode,
  toColorCode,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

// Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Downsampler V1",
    mode: "Sampling Quality",
    bilinear: "Standard",
    bicubic: "Smooth",
    blocksX: "Horizontal Block Size",
    blocksY: "Vertical Block Size",
    linkAxes: "Link Axes",
  },
  ja: {
    title: "ダウンサンプラー V1",
    mode: "サンプリング品質",
    bilinear: "ふつう",
    bicubic: "なめらか",
    blocksX: "横方向ブロックサイズ",
    blocksY: "縦方向ブロックサイズ",
    linkAxes: "縦横連動",
  },
});

const MAX_BLOCKS = 96.0;

export const downsampler = definePlugin({
  id: "downsampler-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      blocksX: {
        type: "real",
        default: 2.0,
      },
      blocksY: {
        type: "real",
        default: 2.0,
      },
      linkAxes: {
        type: "bool",
        default: true,
      },
      mode: {
        type: "string",
        enum: ["bilinear", "bicubic"],
        default: "bilinear",
      },
    },
    onEditParameters: (params) => {
      // パラメータをそのまま返す
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      // No colors to adjust
      return params;
    },
    onScaleParams(params, scaleFactor) {
      // No need to scale parameters
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // パラメータ間の補間
      return {
        blocksX: lerp(paramsA.blocksX, paramsB.blocksX, t),
        blocksY: lerp(paramsA.blocksY, paramsB.blocksY, t),
        linkAxes: t < 0.5 ? paramsA.linkAxes : paramsB.linkAxes,
        mode: t < 0.5 ? paramsA.mode : paramsB.mode,
      };
    },

    renderUI: (params, { setParam }) => {
      const onChangeBlocksX: ChangeEventHandler = ({ value }) => {
        setParam({ blocksX: value });
        if (params.linkAxes) setParam({ blocksY: value });
      };

      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("mode") }),
          ui.select({
            key: "mode",
            value: params.mode,
            options: [
              { label: t("bilinear"), value: "bilinear" },
              { label: t("bicubic"), value: "bicubic" }
            ]
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blocksX") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "blocksX",
              dataType: 'float',
              min: 1.0,
              max: MAX_BLOCKS,
              value: params.blocksX,
              onChange: onChangeBlocksX,
            }),
            ui.numberInput({ key: "blocksX", dataType: 'float', value: params.blocksX }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blocksY") }),
          ui.group({ direction: "row", }, [
            ui.slider({
              key: "blocksY",
              dataType: 'float',
              disabled: params.linkAxes,
              min: 1.0,
              max: MAX_BLOCKS,
              value: params.blocksY,
            }),
            ui.numberInput({
              key: "blocksY",
              dataType: 'float',
              disabled: params.linkAxes,
              value: params.blocksY,
            }),
          ]),
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({ key: "linkAxes", value: params.linkAxes, label:t("linkAxes")  }),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Downsampler)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              blocksX: f32,
              blocksY: f32,
              mode: i32, // 0: bilinear, 1: bicubic
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let textureDims = vec2f(textureDimensions(inputTexture));
              let outputDims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / outputDims;
              let toInputTexCoord = outputDims / textureDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let blocksX = params.blocksX;
              let blocksY = params.blocksY;

              let blockX = floor(texCoord.x * blocksX);
              let blockY = floor(texCoord.y * blocksY);

              let scaledCoordX = (blockX + 0.5) / blocksX;
              let scaledCoordY = (blockY + 0.5) / blocksY;

              // Base sampling coordinate (block center)
              let downscaledCoord = vec2f(scaledCoordX, scaledCoordY);
              let finalSampleCoord = downscaledCoord * toInputTexCoord;

              var finalColor: vec4f;
              finalColor = textureSampleLevel(inputTexture, textureSampler, finalSampleCoord, 0.0);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Downsampler Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Downsampler Pipeline",
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
      const modeValue = params.mode === "bilinear" ? 0 : 1;

      // Maintain original dimensions - we're not actually resizing the output
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      // Ensure proper WebGPU alignment
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width;
      const inputHeight = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      // Result texture is same size as input
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Texture Sampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        blocksX: params.blocksX,
        blocksY: params.blocksY,
        mode: modeValue,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
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
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Downsampler Compute Pass",
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

      // Read back and display the result
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );

      // Remove padding and return properly sized image
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
