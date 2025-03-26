import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

const t = createTranslator({
  en: {
    title: "Directional Blur",
    strength: "Size (px)",
    direction: "Direction",
    opacity: "Opacity",
    blurMode: "Blur Mode",
    behind: "Behind",
    front: "Front",
    both: "Both",
    originalEmphasis: "Original Emphasis",
    fadeScale: "Scale to fade",
    fadeDirection: "Direction to fade",
  },
  ja: {
    title: "方向性ブラー",
    strength: "大きさ (px)",
    direction: "方向",
    opacity: "不透明度",
    blurMode: "ブラーモード",
    behind: "後方",
    front: "前方",
    both: "両方",
    originalEmphasis: "元画像の強調",
    fadeScale: "縮小率",
    fadeDirection: "縮小方向",
  },
});

export const directionalBlur = definePlugin({
  id: "directional-blur-v1",
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
        default: 5.0,
      },
      angle: {
        type: "real",
        default: 0.0,
      },
      opacity: {
        type: "real",
        default: 100.0,
      },
      blurMode: {
        type: "string",
        enum: ["both", "behind", "front"],
        default: "both",
      },
      originalEmphasis: {
        type: "real",
        default: 0.0,
      },
      fadeOut: {
        type: "real",
        default: 0.0,
      },
      fadeDirection: {
        type: "real",
        default: 0.0,
      },
    },
    onAdjustColors: (params, adjustColor) => params,
    onEditParameters: (params) => params,
    onInterpolate: (a, b, progress) => {
      return {
        strength: lerp(a.strength, b.strength, progress),
        angle: lerp(a.angle, b.angle, progress),
        opacity: lerp(a.opacity, b.opacity, progress),
        blurMode: b.blurMode,
        originalEmphasis: lerp(
          a.originalEmphasis || 0.0,
          b.originalEmphasis || 0.0,
          progress
        ),
        fadeOut: lerp(a.fadeOut, b.fadeOut, progress),
        fadeDirection: lerp(a.fadeDirection, b.fadeDirection, progress),
      };
    },
    onScaleParams: (params, scale) => {
      return {
        strength: params.strength * scale,
        angle: params.angle,
        opacity: params.opacity,
        blurMode: params.blurMode,
        originalEmphasis: params.originalEmphasis,
        fadeOut: params.fadeOut,
        fadeDirection: params.fadeDirection,
      };
    },

    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strength",
              dataType: "float",
              min: 0,
              max: 500,
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
          ui.text({ text: t("direction") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "angle",
              dataType: "float",
              min: 0,
              max: 360,
              value: params.angle,
            }),
            ui.numberInput({
              key: "angle",
              dataType: "float",
              value: params.angle,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("opacity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "opacity",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.opacity,
            }),
            ui.numberInput({
              key: "opacity",
              dataType: "float",
              value: params.opacity,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blurMode") }),
          ui.select({
            key: "blurMode",
            value: params.blurMode,
            options: [
              { value: "both", label: t("both") },
              { value: "behind", label: t("behind") },
              { value: "front", label: t("front") },
            ],
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("originalEmphasis") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "originalEmphasis",
              dataType: "float",
              min: 0.0,
              max: 1.0,
              value: params.originalEmphasis || 0.0,
            }),
            ui.numberInput({
              key: "originalEmphasis",
              dataType: "float",
              value: params.originalEmphasis || 0.0,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("fadeScale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "fadeOut",
              dataType: "float",
              min: 0.0,
              max: 1.0,
              value: params.fadeOut,
            }),
            ui.numberInput({
              key: "fadeOut",
              dataType: "float",
              value: params.fadeOut,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("fadeDirection") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "fadeDirection",
              dataType: "float",
              min: -1.0,
              max: 1.0,
              value: params.fadeDirection,
            }),
            ui.numberInput({
              key: "fadeDirection",
              dataType: "float",
              value: params.fadeDirection,
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Directional Blur V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              strength: f32,
              angle: f32,
              opacity: f32,
              blurMode: u32,
              originalEmphasis: f32, // 元画像の強調度（0.0～1.0）
              fadeOut: f32,     // 縮小率：サンプル番号が増えるほど図像が小さくなる
              fadeDirection: f32, // 縮小方向：上寄り/下寄り
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
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              let normalizedOpacity = min(params.opacity * 1.5, 100.0) / 100.0;

              if (params.strength <= 0.0 || params.opacity <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // Keep the strength in pixel space
              let adjustedStrength = params.strength * params.dpiScale;
              let pixelOffset = getOffset(params.angle) * adjustedStrength;
              let texOffset = pixelOffset / dims;

              let numSamples = max(i32(adjustedStrength), 5);

              // ブラー計算のための変数
              var blurredColorRGB = vec3f(0.0);  // RGB成分
              var blurredAlpha = 0.0;            // アルファ成分
              var totalRgbWeight = 0.0;          // RGB用の重み
              var totalAlphaWeight = 0.0;        // アルファ用の重み

              var startSample = -numSamples;
              var endSample = numSamples;

              // blurMode: 0=both, 1=behind, 2=front
              if (params.blurMode == 1u) { // behind
                startSample = 0;
                endSample = numSamples;  // 正の方向にブラー（元の画像の背後）
              } else if (params.blurMode == 2u) { // front
                startSample = -numSamples;
                endSample = 0;  // 負の方向にブラー（元の画像の前方）
              }

              for (var i = startSample; i <= endSample; i++) {
                // 中央のサンプル（i = 0）は元の画像をそのまま使用
                if (i == 0) {
                  // 中心サンプルは直接追加
                  blurredColorRGB += originalColor.rgb * originalColor.a;
                  blurredAlpha += originalColor.a;
                  totalRgbWeight += 1.0;
                  totalAlphaWeight += 1.0;
                  continue;
                }

                let blurIntensity = 1.5;
                let sampleOffset = f32(i) / f32(numSamples) * blurIntensity;

                let normalizedDistance = f32(abs(i)) / f32(numSamples);
                let baseCoord = texCoord + texOffset * sampleOffset;

                var sampleCoord = baseCoord;
                if (params.fadeOut > 0.0) {
                  // 縮小率の計算（0.0～1.0）
                  let scale = max(1.0 - (normalizedDistance * params.fadeOut), 0.01);

                  // 画像中心を原点として拡大縮小
                  let center = vec2f(0.5, 0.5);
                  sampleCoord = center + (baseCoord - center) / scale;

                  // 縮小方向の適用（上下方向のシフト）
                  if (params.fadeDirection != 0.0) {
                    // 正の値：下方向、負の値：上方向
                    let shift = (1.0 - scale) * 0.5 * params.fadeDirection;
                    sampleCoord.y += shift;
                  }
                }

                sampleCoord = clamp(sampleCoord, vec2f(0.0), vec2f(1.0));
                let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord * toInputTexCoord, 0.0);

                let sigma = 0.5;
                let weight = gaussianWeight(normalizedDistance, sigma);

                // サンプル色をプリマルチプライド形式で蓄積
                blurredColorRGB += sampleColor.rgb * sampleColor.a * weight;
                blurredAlpha += sampleColor.a * weight;

                totalRgbWeight += weight;
                totalAlphaWeight += weight;
              }

              var finalColor = originalColor;

              if (totalAlphaWeight > 0.0) {
                // アルファを正規化
                let normalizedAlpha = blurredAlpha / totalAlphaWeight;

                // RGB値を正規化（プリマルチプライド状態）
                var normalizedRGB = vec3f(0.0);
                if (totalRgbWeight > 0.0) {
                  normalizedRGB = blurredColorRGB / vec3f(totalRgbWeight);
                }

                // プリマルチプライドからストレートアルファに戻す
                // (normalizedAlphaが0に近い場合は変換しない)
                var unpremultipliedRGB = normalizedRGB;
                if (normalizedAlpha > 0.001) {
                  unpremultipliedRGB = normalizedRGB / vec3f(normalizedAlpha);
                }

                let blurredColor = vec4f(unpremultipliedRGB, normalizedAlpha);

                finalColor = mix(originalColor, blurredColor, normalizedOpacity);

                let emphasisFactor = params.originalEmphasis * originalColor.a;
                let blendedRGB = mix(finalColor.rgb, originalColor.rgb, emphasisFactor);
                finalColor = vec4f(blendedRGB, finalColor.a);
              } else {
                finalColor = originalColor;
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Directional Blur V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Directional Blur V1 Pipeline",
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
      console.log("Directional Blur V1", params);

      const dpiScale = dpi / baseDpi;

      // Compute padding for blur overflow
      const paddingSize = Math.ceil(params.strength * dpiScale);
      imgData = await paddingImageData(imgData, paddingSize);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Don't change it
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Directional Blur Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Directional Blur Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Directional Blur Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      // blurModeを数値に変換
      let blurModeValue = 0; // デフォルトは "both"
      if (params.blurMode === "behind") {
        blurModeValue = 1;
      } else if (params.blurMode === "front") {
        blurModeValue = 2;
      }

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Directional Blur Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Set uniform values with DPI scaling
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        strength: params.strength,
        angle: params.angle,
        opacity: params.opacity,
        blurMode: blurModeValue,
        originalEmphasis: params.originalEmphasis || 0.0,
        fadeOut: params.fadeOut || 0.0,
        fadeDirection: params.fadeDirection || 0.0,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Directional Blur Main Bind Group",
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
        label: "Directional Blur Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        {
          bytesPerRow: bufferInputWidth * 4,
          rowsPerImage: bufferInputHeight,
        },
        [bufferInputWidth, bufferInputHeight]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Directional Blur Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Directional Blur Compute Pass",
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

      // Read back and display the result
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
