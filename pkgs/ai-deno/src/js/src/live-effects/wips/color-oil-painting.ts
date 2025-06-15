/*
 * Oil Painting Filter - WebGPU implementation
 *
 * Algorithm based on ImageFilters.js Oil filter
 * Original work Copyright (c) 2011 ARAKI Hayato
 * Licensed under the MIT License
 * Source: https://github.com/arahaya/ImageFilters.js
 * License: https://raw.githubusercontent.com/arahaya/ImageFilters.js/master/MIT-LICENSE
 *
 * WebGPU implementation and modifications for this plugin system
 */

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
    title: "Oil Painting V1",
    range: "Brush Range",
    levels: "Color Levels",
  },
  ja: {
    title: "油絵調 V1",
    range: "ブラシ範囲",
    levels: "色レベル",
  },
});

export const oilPainting = definePlugin({
  id: "oil-painting-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      range: {
        type: "int",
        default: 3,
      },
      levels: {
        type: "int",
        default: 20,
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        range: Math.max(1, Math.min(5, params.range)),
        levels: Math.max(2, Math.min(256, params.levels)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        range: Math.round(params.range * scaleFactor),
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        range: Math.round(lerp(paramsA.range, paramsB.range, t)),
        levels: Math.round(lerp(paramsA.levels, paramsB.levels, t)),
      };
    },

    renderUI: (params, { setParam, useStateObject }) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("range")}),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "range", dataType: 'int', min: 1, max: 5, value: params.range }),
            ui.numberInput({ key: "range", dataType: 'int', value: params.range }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("levels")}),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "levels", dataType: 'int', min: 2, max: 256, value: params.levels }),
            ui.numberInput({ key: "levels", dataType: 'int', value: params.levels }),
          ]),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Oil Painting V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              range: i32,
              levels: i32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let currentPos = vec2i(id.xy);
              let range = params.range;
              let levels = params.levels;

              // Color histograms and totals for each channel (fixed size for WGSL)
              var rh: array<i32, 256>;
              var gh: array<i32, 256>;
              var bh: array<i32, 256>;
              var rt: array<f32, 256>;
              var gt: array<f32, 256>;
              var bt: array<f32, 256>;

              // Initialize arrays up to levels count
              for (var i = 0; i < 256; i++) {
                rh[i] = 0;
                gh[i] = 0;
                bh[i] = 0;
                rt[i] = 0.0;
                gt[i] = 0.0;
                bt[i] = 0.0;
              }

              // Sample surrounding pixels within image bounds
              for (var row = -range; row <= range; row++) {
                for (var col = -range; col <= range; col++) {
                  let samplePos = currentPos + vec2i(col, row);

                  // Check bounds before sampling
                  if (samplePos.x >= 0 && samplePos.y >= 0 &&
                      samplePos.x < i32(dims.x) && samplePos.y < i32(dims.y)) {

                    let sampleCoord = (vec2f(samplePos) + 0.5) / dims;
                    let inputSampleCoord = sampleCoord * toInputTexCoord;
                    let sampleColor = textureSampleLevel(inputTexture, textureSampler, inputSampleCoord, 0.0);

                    // Convert to 0-255 range and quantize
                    let sr = i32(clamp(sampleColor.r * 255.0, 0.0, 255.0));
                    let sg = i32(clamp(sampleColor.g * 255.0, 0.0, 255.0));
                    let sb = i32(clamp(sampleColor.b * 255.0, 0.0, 255.0));

                    // Quantize to levels
                    let ri = min((sr * levels) / 256, levels - 1);
                    let gi = min((sg * levels) / 256, levels - 1);
                    let bi = min((sb * levels) / 256, levels - 1);

                    // Update histograms
                    rt[ri] += sampleColor.r;
                    gt[gi] += sampleColor.g;
                    bt[bi] += sampleColor.b;
                    rh[ri] += 1;
                    gh[gi] += 1;
                    bh[bi] += 1;
                  }
                }
              }

              // Find most frequent levels (only check up to levels count)
              var maxR = 0;
              var maxG = 0;
              var maxB = 0;

              for (var i = 1; i < levels; i++) {
                if (rh[i] > rh[maxR]) {
                  maxR = i;
                }
                if (gh[i] > gh[maxG]) {
                  maxG = i;
                }
                if (bh[i] > bh[maxB]) {
                  maxB = i;
                }
              }

              // Calculate average colors for most frequent levels
              var finalColor: vec4f;
              if (rh[maxR] > 0) {
                finalColor.r = rt[maxR] / f32(rh[maxR]);
              } else {
                finalColor.r = 0.0;
              }

              if (gh[maxG] > 0) {
                finalColor.g = gt[maxG] / f32(gh[maxG]);
              } else {
                finalColor.g = 0.0;
              }

              if (bh[maxB] > 0) {
                finalColor.b = bt[maxB] / f32(bh[maxB]);
              } else {
                finalColor.b = 0.0;
              }

              // Preserve original alpha
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              finalColor.a = originalColor.a;

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Oil Painting V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Oil Painting V1 Pipeline",
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
      console.log("Oil Painting V1", params);

      // Add padding for the filter range
      const paddingSize = params.range;
      imgData = await paddingImageData(imgData, paddingSize);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Add WebGPU alignment padding
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Oil Painting Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Oil Painting Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Oil Painting Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Oil Painting Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        range: params.range,
        levels: params.levels,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Oil Painting Main Bind Group",
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

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Oil Painting Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Oil Painting Compute Pass",
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

      // Read back results
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
