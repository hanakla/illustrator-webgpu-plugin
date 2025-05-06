import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../plugin.ts";
import { definePlugin, ColorRGBA } from "../plugin.ts";
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
import { createGPUDevice } from "./_shared.ts";

const t = createTranslator({
  en: {
    title: "Kirakira Blur",
    radius: "Blur Radius (px)",
    strength: "Blur Strength",
    sparkle: "Sparkle Intensity",
    blendOpacity: "Blur Opacity",
    makeOriginalTransparent: "Make Original Transparent",
    useCustomColor: "Use Custom Blur Color",
    customColor: "Custom Blur Color",
  },
  ja: {
    title: "キラキラブラー",
    radius: "ぼかし半径 (px)",
    strength: "ぼかし強度",
    sparkle: "きらめき強度",
    blendOpacity: "ブラー不透明度",
    makeOriginalTransparent: "元画像を透明にする",
    useCustomColor: "カスタムブラー色を使用",
    customColor: "カスタムブラー色",
  },
});

export const kirakiraBlur = definePlugin({
  id: "kirakira-blur-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      radius: {
        type: "int",
        default: 10,
      },
      strength: {
        type: "real",
        default: 1.0,
      },
      sparkle: {
        type: "real",
        default: 0.5,
      },
      blendOpacity: {
        type: "real",
        default: 1.0,
      },
      makeOriginalTransparent: {
        type: "bool",
        default: false,
      },
      useCustomColor: {
        type: "bool",
        default: false,
      },
      customColor: {
        type: "color",
        default: {
          r: 1.0,
          g: 1.0,
          b: 1.0,
          a: 1.0,
        },
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        radius: Math.max(0, Math.min(200, params.radius)),
        strength: Math.max(0, Math.min(2, params.strength)),
        blendOpacity: Math.max(0, Math.min(1, params.blendOpacity)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        customColor: adjustColor(params.customColor),
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        radius: Math.round(params.radius * scaleFactor),
        strength: params.strength,
        sparkle: params.sparkle,
        blendOpacity: params.blendOpacity,
        makeOriginalTransparent: params.makeOriginalTransparent,
        useCustomColor: params.useCustomColor,
        customColor: params.customColor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        radius: Math.round(lerp(paramsA.radius, paramsB.radius, t)),
        strength: lerp(paramsA.strength, paramsB.strength, t),
        sparkle: lerp(paramsA.sparkle, paramsB.sparkle, t),
        blendOpacity: lerp(paramsA.blendOpacity, paramsB.blendOpacity, t),
        makeOriginalTransparent:
          t < 0.5
            ? paramsA.makeOriginalTransparent
            : paramsB.makeOriginalTransparent,
        useCustomColor:
          t < 0.5 ? paramsA.useCustomColor : paramsB.useCustomColor,
        customColor: {
          r: lerp(paramsA.customColor.r, paramsB.customColor.r, t),
          g: lerp(paramsA.customColor.g, paramsB.customColor.g, t),
          b: lerp(paramsA.customColor.b, paramsB.customColor.b, t),
          a: lerp(paramsA.customColor.a, paramsB.customColor.a, t),
        },
      };
    },
    renderUI: (params, { setParam }) => {
      const customColorStr = toColorCode(params.customColor);

      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("radius") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "radius", dataType: 'int', min: 1, max: 200, value: params.radius }),
            ui.numberInput({ key: "radius", dataType: 'int', value: params.radius }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "strength", dataType: 'float', min: 0, max: 2, value: params.strength }),
            ui.numberInput({ key: "strength", dataType: 'float', value: params.strength }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("sparkle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "sparkle", dataType: 'float', min: 0, max: 1, value: params.sparkle }),
            ui.numberInput({ key: "sparkle", dataType: 'float', value: params.sparkle }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blendOpacity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "blendOpacity", dataType: 'float', min: 0, max: 1, value: params.blendOpacity }),
            ui.numberInput({ key: "blendOpacity", dataType: 'float', value: params.blendOpacity }),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "useCustomColor", value: params.useCustomColor, label: t("useCustomColor") }),
          ui.group({ direction: "row", disabled: !params.useCustomColor }, [
            ui.text({ text: t("customColor") }),
            ui.colorInput({ key: "customColor", value: params.customColor }),
            ui.textInput({ key: "customColorText", value: customColorStr, onChange: (e) => {
              setParam({ customColor: parseColorCode(e.value)! })
            }}),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "makeOriginalTransparent", value: params.makeOriginalTransparent, label: t("makeOriginalTransparent") }),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Kirakira Blur)" },
        },
        (device) => {
          // 共通ブラーシェーダー
          const commonBlurCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              radius: i32,
              strength: f32,
              sparkle: f32,
              blendOpacity: f32,
              makeOriginalTransparent: i32,
              useCustomColor: i32,
              customColor: vec4f,
              direction: i32,  // 0: vertical, 1: horizontal
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;
            @group(0) @binding(4) var originalTexture: texture_2d<f32>;

            fn gaussianWeight(offset: f32, sigma: f32) -> f32 {
              let gaussianExp = -0.5 * (offset * offset) / (sigma * sigma);
              return exp(gaussianExp) / (2.5066282746 * sigma);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // Get original texture color (used for horizontal pass)
              var originalColor = vec4f(0.0);
              if (params.direction == 1) {
                originalColor = textureSampleLevel(originalTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              }

              // DPI-scaled blur radius and sigma calculation
              let radiusScaled = f32(params.radius) * params.dpiScale;
              let sigma = radiusScaled * 0.33 * params.strength;

              if (sigma <= 0.0) {
                // If no blur, return original or intermediate color
                let sourceColor = select(
                  textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0),
                  originalColor,
                  params.direction == 1
                );
                textureStore(resultTexture, id.xy, sourceColor);
                return;
              }

              let intermediateColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // Determine color to use based on custom color setting
              var sampledRGB: vec3f;
              if (params.useCustomColor != 0) {
                sampledRGB = params.customColor.rgb;
              } else {
                sampledRGB = intermediateColor.rgb;
              }

              // Alpha is always from intermediate texture
              let sampledAlpha = intermediateColor.a;

              // Center weight for Gaussian blur
              let centerWeight = gaussianWeight(0.0, sigma);

              // Alpha calculation
              var totalWeightAlpha = centerWeight;
              var resultAlpha = sampledAlpha * centerWeight;

              // RGB calculation (weighted by alpha)
              var totalWeightRGB = centerWeight * sampledAlpha;
              var resultRGB: vec3f;
              if (sampledAlpha > 0.0) {
                resultRGB = sampledRGB * centerWeight * sampledAlpha;
              } else {
                resultRGB = vec3f(0.0);
              }

              // Determine step direction based on direction parameter
              var pixelStep: vec2f;
              if (params.direction == 1) {
                pixelStep = vec2f(1.0 / dims.x, 0.0); // Horizontal step
              } else {
                pixelStep = vec2f(0.0, 1.0 / dims.y); // Vertical step
              }

              let radiusScaledInt = i32(ceil(radiusScaled));

              // Process blur samples
              for (var i = 1; i <= radiusScaledInt; i = i + 1) {
                let offset = f32(i);
                let weight = gaussianWeight(offset, sigma);

                let offsetPos = pixelStep * offset;
                let offsetNeg = -pixelStep * offset;

                let posCoord = texCoord * toInputTexCoord + offsetPos;
                let negCoord = texCoord * toInputTexCoord + offsetNeg;

                let samplePos = textureSampleLevel(inputTexture, textureSampler, posCoord, 0.0);
                let sampleNeg = textureSampleLevel(inputTexture, textureSampler, negCoord, 0.0);

                // Color sampling based on custom color setting
                var samplePosRGB: vec3f;
                var sampleNegRGB: vec3f;

                if (params.useCustomColor != 0) {
                  samplePosRGB = params.customColor.rgb;
                  sampleNegRGB = params.customColor.rgb;
                } else {
                  samplePosRGB = samplePos.rgb;
                  sampleNegRGB = sampleNeg.rgb;
                }

                // Alpha calculation
                resultAlpha += (samplePos.a + sampleNeg.a) * weight;
                totalWeightAlpha += weight * 2.0;

                // RGB calculation (weighted by alpha)
                if (samplePos.a > 0.0) {
                  resultRGB += samplePosRGB * weight * samplePos.a;
                  totalWeightRGB += weight * samplePos.a;
                }

                if (sampleNeg.a > 0.0) {
                  resultRGB += sampleNegRGB * weight * sampleNeg.a;
                  totalWeightRGB += weight * sampleNeg.a;
                }
              }

              // Calculate final alpha
              resultAlpha = resultAlpha / totalWeightAlpha;

              // Calculate final RGB (normalized by alpha weights)
              var finalRGB: vec3f;
              if (totalWeightRGB > 0.0) {
                finalRGB = resultRGB / totalWeightRGB;
              } else {
                finalRGB = intermediateColor.rgb;
              }

              // Basic blur result
              var finalColor = vec4f(finalRGB, resultAlpha);

              // Apply additional effects for horizontal pass only
              if (params.direction == 1) {
                // Apply sparkle effect (amplify values up to 2x)
                let sparkleMultiplier = 1.0 + params.sparkle;
                // Apply blendOpacity to the blur color's alpha
                let sparkledColor = vec4f(finalColor.rgb * sparkleMultiplier, finalColor.a * params.blendOpacity);

                // Blend with original based on original alpha
                let blendFactor = originalColor.a;
                let blendedRGB = mix(sparkledColor.rgb, originalColor.rgb, blendFactor);

                // Adjust alpha based on makeOriginalTransparent setting
                if (params.makeOriginalTransparent != 0) {
                  // Use blended RGB but set alpha to 0 where original was opaque
                  let resultAlpha = select(sparkledColor.a, 0.0, originalColor.a > 0.0);
                  finalColor = vec4f(blendedRGB, resultAlpha);
                } else {
                  // Normal blend: use original color for opaque parts, blur+sparkle for transparent parts
                  // Apply blendOpacity to control how visible the blur effect is
                  finalColor = vec4f(blendedRGB, max(originalColor.a, sparkledColor.a));
                }

                // Clamp results to valid range
                finalColor = clamp(finalColor, vec4f(0.0), vec4f(1.0));
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          // 共通シェーダーを作成
          const shader = device.createShaderModule({
            label: "Kirakira Blur Common Shader",
            code: commonBlurCode,
          });

          const pipelineDef = makeShaderDataDefinitions(commonBlurCode);

          // 単一のパイプラインを作成
          const pipeline = device.createComputePipeline({
            label: "Kirakira Blur Pipeline",
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
      console.log("Kirakira Blur V1", params);

      // DPIを考慮したパディングサイズの計算
      const dpiRatio = dpi / baseDpi;
      const paddingSize = Math.ceil(params.radius * dpiRatio);
      imgData = await paddingImageData(imgData, paddingSize);

      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      // WebGPU向けのアライメントパディングを追加
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // 入力テクスチャ
      const inputTexture = device.createTexture({
        label: "Kirakira Blur Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      // 中間テクスチャ（縦方向ブラーの結果を保存）
      const intermediateTexture = device.createTexture({
        label: "Kirakira Blur Intermediate Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      // 結果テクスチャ
      const resultTexture = device.createTexture({
        label: "Kirakira Blur Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      // サンプラー
      const sampler = device.createSampler({
        label: "Kirakira Blur Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // 縦方向パス（direction = 0）のユニフォームバッファ
      const verticalUniformValues = makeStructuredView(
        pipelineDef.uniforms.params
      );
      const verticalUniformBuffer = device.createBuffer({
        label: "Kirakira Blur Vertical Params Buffer",
        size: verticalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // 横方向パス（direction = 1）のユニフォームバッファ
      const horizontalUniformValues = makeStructuredView(
        pipelineDef.uniforms.params
      );
      const horizontalUniformBuffer = device.createBuffer({
        label: "Kirakira Blur Horizontal Params Buffer",
        size: horizontalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // ユニフォーム値を設定
      verticalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        strength: params.strength,
        sparkle: params.sparkle,
        blendOpacity: params.blendOpacity,
        makeOriginalTransparent: params.makeOriginalTransparent ? 1 : 0,
        useCustomColor: params.useCustomColor ? 1 : 0,
        customColor: [
          params.customColor.r,
          params.customColor.g,
          params.customColor.b,
          params.customColor.a,
        ],
        direction: 0, // 縦方向パス
      });

      horizontalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        strength: params.strength,
        sparkle: params.sparkle,
        blendOpacity: params.blendOpacity,
        makeOriginalTransparent: params.makeOriginalTransparent ? 1 : 0,
        useCustomColor: params.useCustomColor ? 1 : 0,
        customColor: [
          params.customColor.r,
          params.customColor.g,
          params.customColor.b,
          params.customColor.a,
        ],
        direction: 1, // 横方向パス
      });

      device.queue.writeBuffer(
        verticalUniformBuffer,
        0,
        verticalUniformValues.arrayBuffer
      );
      device.queue.writeBuffer(
        horizontalUniformBuffer,
        0,
        horizontalUniformValues.arrayBuffer
      );

      // 入力テクスチャにデータを書き込み
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      // 縦方向パスのバインドグループ
      // 注：縦方向パスでもbinding 4は必要だが、使用はしない
      const verticalBindGroup = device.createBindGroup({
        label: "Kirakira Blur Vertical Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView(),
          },
          {
            binding: 1,
            resource: intermediateTexture.createView(),
          },
          {
            binding: 2,
            resource: sampler,
          },
          {
            binding: 3,
            resource: { buffer: verticalUniformBuffer },
          },
          {
            binding: 4,
            resource: inputTexture.createView(), // 縦方向パスでは使用しないが、バインドは必要
          },
        ],
      });

      // 横方向パスのバインドグループ
      const horizontalBindGroup = device.createBindGroup({
        label: "Kirakira Blur Horizontal Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: intermediateTexture.createView(),
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
            resource: { buffer: horizontalUniformBuffer },
          },
          {
            binding: 4,
            resource: inputTexture.createView(), // 元画像（横方向パスで使用）
          },
        ],
      });

      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // コマンドエンコーダを作成
      const commandEncoder = device.createCommandEncoder({
        label: "Kirakira Blur Command Encoder",
      });

      // 縦方向パスを実行
      const verticalPass = commandEncoder.beginComputePass({
        label: "Kirakira Blur Vertical Pass",
      });
      verticalPass.setPipeline(pipeline);
      verticalPass.setBindGroup(0, verticalBindGroup);
      verticalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      verticalPass.end();

      // 横方向パスを実行
      const horizontalPass = commandEncoder.beginComputePass({
        label: "Kirakira Blur Horizontal Pass",
      });
      horizontalPass.setPipeline(pipeline);
      horizontalPass.setBindGroup(0, horizontalBindGroup);
      horizontalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      horizontalPass.end();

      // 結果をステージングバッファにコピー
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );

      // コマンドをキューに送信して実行
      device.queue.submit([commandEncoder.finish()]);

      // 結果を読み取り
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );

      // パディングを取り除いて最終的な結果を返す
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
