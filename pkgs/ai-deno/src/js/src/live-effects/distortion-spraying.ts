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
    title: "Spraying Filter V1",
    strength: "Strength (px)",
    seed: "Seed",
    blockSize: "Block Size",
  },
  ja: {
    title: "スプレー V1",
    strength: "強さ (px)",
    seed: "シード",
    blockSize: "ブロックサイズ",
  },
});

export const spraying = definePlugin({
  id: "spraying-filter-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Distortion",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      strength: {
        type: "real",
        default: 5.0,
      },
      seed: {
        type: "int",
        default: 12345,
      },
      blockSize: {
        type: "real",
        default: 1.0,
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        strength: Math.max(0, params.strength),
        seed: Math.max(0, params.seed),
        blockSize: Math.max(1, Math.min(10, params.blockSize)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        strength: params.strength * scaleFactor,
        blockSize: params.blockSize * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        strength: lerp(paramsA.strength, paramsB.strength, t),
        seed: Math.round(lerp(paramsA.seed, paramsB.seed, t)),
        blockSize: lerp(paramsA.blockSize, paramsB.blockSize, t),
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
              max: 100,
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
          ui.text({ text: t("blockSize") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "blockSize",
              dataType: "float",
              min: 1,
              max: 10,
              value: params.blockSize,
            }),
            ui.numberInput({
              key: "blockSize",
              dataType: "float",
              value: params.blockSize,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "seed",
              dataType: "int",
              min: 0,
              max: 99999,
              value: params.seed,
            }),
            ui.numberInput({
              key: "seed",
              dataType: "int",
              value: params.seed,
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Spraying Filter V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              strength: f32,
              seed: u32,
              blockSize: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn hash(p: vec2u, seed: u32) -> u32 {
              var state = p.x ^ (p.y << 8u) ^ seed;
              state = state ^ (state >> 16u);
              state = state * 0x45d9f3bu;
              state = state ^ (state >> 16u);
              state = state * 0x45d9f3bu;
              state = state ^ (state >> 16u);
              return state;
            }

            fn hashToFloat(h: u32) -> f32 {
              return f32(h) / 4294967295.0;
            }

            fn randomOffset(coord: vec2u, seed: u32, strength: f32) -> vec2f {
              let h1 = hash(coord, seed);
              let h2 = hash(coord + vec2u(1u, 0u), seed);

              let angle = hashToFloat(h1) * 6.28318530718;
              let radius = hashToFloat(h2) * strength;

              return vec2f(cos(angle) * radius, sin(angle) * radius);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let blockSize = params.blockSize * params.dpiScale;
              let blockCoord = vec2u(vec2f(id.xy) / blockSize);
              let strengthInCurrentPixels = params.strength * params.dpiScale;

              let blockOffset = randomOffset(blockCoord, params.seed, strengthInCurrentPixels);
              let pixelOffset = randomOffset(id.xy, params.seed + 12345u, strengthInCurrentPixels * 0.3);
              let totalOffset = blockOffset + pixelOffset;

              let sourceCoord = (vec2f(id.xy) + totalOffset) / dims;

              var finalColor: vec4f;

              if (sourceCoord.x >= 0.0 && sourceCoord.x <= 1.0 &&
                  sourceCoord.y >= 0.0 && sourceCoord.y <= 1.0) {
                // Sample straight alpha image - RGB values are not premultiplied by alpha
                let sampledColor = textureSampleLevel(inputTexture, textureSampler, sourceCoord * toInputTexCoord, 0.0);

                // Pass through straight alpha values unchanged
                finalColor = sampledColor;
              } else {
                // For out-of-bounds pixels, use fully transparent black (straight alpha format)
                finalColor = vec4f(0.0, 0.0, 0.0, 0.0);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }

            ${includeOklabMix()}
          `;

          const shader = device.createShaderModule({
            label: "Spraying Filter V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Spraying Filter V1 Pipeline",
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
      console.log("Spraying Filter V1", params);

      const paddingSize = Math.ceil(params.strength * (dpi / baseDpi));
      imgData = await paddingImageData(imgData, paddingSize);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      const texture = device.createTexture({
        label: "Spraying Filter Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Spraying Filter Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Spraying Filter Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Spraying Filter Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        strength: params.strength,
        seed: params.seed,
        blockSize: params.blockSize,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Spraying Filter Main Bind Group",
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

      // Input image data is in straight alpha format (RGB not premultiplied by alpha)
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
        label: "Spraying Filter Compute Pass",
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

      // Output image data remains in straight alpha format
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
