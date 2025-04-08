import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../types.ts";
import { definePlugin, ColorRGBA } from "../types.ts";
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
    makeOriginalTransparent: "Make Original Transparent",
    useCustomColor: "Use Custom Blur Color",
    customColor: "Custom Blur Color",
  },
  ja: {
    title: "キラキラブラー",
    radius: "ぼかし半径 (px)",
    strength: "ぼかし強度",
    sparkle: "きらめき強度",
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
    renderUI: (params, setParam) => {
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
          // 縦方向ブラーのシェーダー
          const verticalBlurCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              radius: i32,
              strength: f32,
              sparkle: f32,
              makeOriginalTransparent: i32,
              useCustomColor: i32,
              customColor: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

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

              // DPIスケールを考慮したブラー半径とシグマの計算
              let radiusScaled = f32(params.radius) * params.dpiScale;
              let sigma = radiusScaled * 0.33 * params.strength;

              if (sigma <= 0.0) {
                let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // カスタム色を使用するかどうかでサンプリング色を決定
              var sampledRGB: vec3f;
              if (params.useCustomColor != 0) {
                // カスタム色を使用する場合
                sampledRGB = params.customColor.rgb;
              } else {
                // 元画像の色を使用する場合
                sampledRGB = originalColor.rgb;
              }

              // アルファ値は常に元画像から取得
              let sampledAlpha = originalColor.a;

              // アルファとRGBを分けて計算するために変数を分ける
              let centerWeight = gaussianWeight(0.0, sigma);

              // アルファ計算用
              var totalWeightAlpha = centerWeight;
              var resultAlpha = sampledAlpha * centerWeight;

              // RGB計算用（アルファで重み付け）
              var totalWeightRGB = centerWeight * sampledAlpha;
              // アルファが0の場合でもRGB値を保持する（プリマルチプライドから戻す）
              var resultRGB: vec3f;
              if (sampledAlpha > 0.0) {
                resultRGB = sampledRGB * centerWeight * sampledAlpha;
              } else {
                // アルファが0の場合は周囲から色を推測するため初期値は0
                resultRGB = vec3f(0.0);
              }

              let pixelStep = 1.0 / dims.y;
              let radiusScaledInt = i32(ceil(radiusScaled));

              for (var i = 1; i <= radiusScaledInt; i = i + 1) {
                let offset = f32(i);
                let weight = gaussianWeight(offset, sigma);

                let offsetUp = vec2f(0.0, pixelStep * offset);
                let offsetDown = vec2f(0.0, -pixelStep * offset);

                let upCoord = texCoord * toInputTexCoord + offsetUp;
                let downCoord = texCoord * toInputTexCoord + offsetDown;

                let sampleUp = textureSampleLevel(inputTexture, textureSampler, upCoord, 0.0);
                let sampleDown = textureSampleLevel(inputTexture, textureSampler, downCoord, 0.0);

                // カスタム色または元画像の色を使用
                var sampleUpRGB: vec3f;
                var sampleDownRGB: vec3f;

                if (params.useCustomColor != 0) {
                  sampleUpRGB = params.customColor.rgb;
                  sampleDownRGB = params.customColor.rgb;
                } else {
                  sampleUpRGB = sampleUp.rgb;
                  sampleDownRGB = sampleDown.rgb;
                }

                // アルファ値の計算
                resultAlpha += (sampleUp.a + sampleDown.a) * weight;
                totalWeightAlpha += weight * 2.0;

                // RGB値の計算（アルファで重み付け）
                // アルファが0でなければRGBを考慮
                if (sampleUp.a > 0.0) {
                  resultRGB += sampleUpRGB * weight * sampleUp.a;
                  totalWeightRGB += weight * sampleUp.a;
                }

                if (sampleDown.a > 0.0) {
                  resultRGB += sampleDownRGB * weight * sampleDown.a;
                  totalWeightRGB += weight * sampleDown.a;
                }
              }

              // 最終的なアルファ値を計算
              resultAlpha = resultAlpha / totalWeightAlpha;

              // RGB値の計算（アルファ重みで正規化）
              var finalRGB: vec3f;
              if (totalWeightRGB > 0.0) {
                finalRGB = resultRGB / totalWeightRGB;
              } else {
                // アルファがすべて0なら、元の色を使用
                finalRGB = originalColor.rgb;
              }

              let finalColor = vec4f(finalRGB, resultAlpha);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          // 横方向ブラーのシェーダー
          const horizontalBlurCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              radius: i32,
              strength: f32,
              sparkle: f32,
              makeOriginalTransparent: i32,
              useCustomColor: i32,
              customColor: vec4f,
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

              // 元画像を取得
              let originalColor = textureSampleLevel(originalTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // DPIスケールを考慮したブラー半径とシグマの計算
              let radiusScaled = f32(params.radius) * params.dpiScale;
              let sigma = radiusScaled * 0.33 * params.strength;

              if (sigma <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let intermediateColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // カスタム色を使用するかどうかでサンプリング色を決定
              var sampledRGB: vec3f;
              if (params.useCustomColor != 0) {
                // カスタム色を使用する場合
                sampledRGB = params.customColor.rgb;
              } else {
                // 元画像の色を使用する場合
                sampledRGB = intermediateColor.rgb;
              }

              // アルファ値は常に中間テクスチャから取得
              let sampledAlpha = intermediateColor.a;

              // アルファとRGBを分けて計算するために変数を分ける
              let centerWeight = gaussianWeight(0.0, sigma);

              // アルファ計算用
              var totalWeightAlpha = centerWeight;
              var resultAlpha = sampledAlpha * centerWeight;

              // RGB計算用（アルファで重み付け）
              var totalWeightRGB = centerWeight * sampledAlpha;
              // アルファが0の場合でもRGB値を保持する（プリマルチプライドから戻す）
              var resultRGB: vec3f;
              if (sampledAlpha > 0.0) {
                resultRGB = sampledRGB * centerWeight * sampledAlpha;
              } else {
                // アルファが0の場合は周囲から色を推測するため初期値は0
                resultRGB = vec3f(0.0);
              }

              let pixelStep = 1.0 / dims.x;
              let radiusScaledInt = i32(ceil(radiusScaled));

              for (var i = 1; i <= radiusScaledInt; i = i + 1) {
                let offset = f32(i);
                let weight = gaussianWeight(offset, sigma);

                let offsetRight = vec2f(pixelStep * offset, 0.0);
                let offsetLeft = vec2f(-pixelStep * offset, 0.0);

                let rightCoord = texCoord * toInputTexCoord + offsetRight;
                let leftCoord = texCoord * toInputTexCoord + offsetLeft;

                let sampleRight = textureSampleLevel(inputTexture, textureSampler, rightCoord, 0.0);
                let sampleLeft = textureSampleLevel(inputTexture, textureSampler, leftCoord, 0.0);

                // カスタム色または中間テクスチャの色を使用
                var sampleRightRGB: vec3f;
                var sampleLeftRGB: vec3f;

                if (params.useCustomColor != 0) {
                  sampleRightRGB = params.customColor.rgb;
                  sampleLeftRGB = params.customColor.rgb;
                } else {
                  sampleRightRGB = sampleRight.rgb;
                  sampleLeftRGB = sampleLeft.rgb;
                }

                // アルファ値の計算
                resultAlpha += (sampleRight.a + sampleLeft.a) * weight;
                totalWeightAlpha += weight * 2.0;

                // RGB値の計算（アルファで重み付け）
                // アルファが0でなければRGBを考慮
                if (sampleRight.a > 0.0) {
                  resultRGB += sampleRightRGB * weight * sampleRight.a;
                  totalWeightRGB += weight * sampleRight.a;
                }

                if (sampleLeft.a > 0.0) {
                  resultRGB += sampleLeftRGB * weight * sampleLeft.a;
                  totalWeightRGB += weight * sampleLeft.a;
                }
              }

              // 最終的なアルファ値を計算
              resultAlpha = resultAlpha / totalWeightAlpha;

              // RGB値の計算（アルファ重みで正規化）
              var finalRGB: vec3f;
              if (totalWeightRGB > 0.0) {
                finalRGB = resultRGB / totalWeightRGB;
              } else {
                // アルファがすべて0なら、元の色を使用
                finalRGB = intermediateColor.rgb;
              }

              // 基本的なブラー結果
              let blurColor = vec4f(finalRGB, resultAlpha);

              // きらめき効果を適用（値を最大2倍まで増幅）
              let sparkleMultiplier = 1.0 + params.sparkle;
              let sparkledColor = vec4f(blurColor.rgb * sparkleMultiplier, blurColor.a);

              // 元画像の透明度に基づいて合成
              // 元画像が不透明な部分ほど元画像の色を使用
              let blendFactor = originalColor.a;
              let blendedRGB = mix(sparkledColor.rgb, originalColor.rgb, blendFactor);

                              // 「元画像を透明にする」設定に基づいてアルファを調整
              var resultColor: vec4f;
              if (params.makeOriginalTransparent != 0) {
                // 合成したRGBを使用し、元画像が不透明だった部分のアルファを0に
                let resultAlpha = select(sparkledColor.a, 0.0, originalColor.a > 0.0);
                resultColor = vec4f(blendedRGB, resultAlpha);
              } else {
                // 通常の合成：元画像の不透明部分は元画像の色、透明部分はブラー+きらめき効果
                resultColor = vec4f(blendedRGB, max(originalColor.a, sparkledColor.a));
              }

              // 結果は0.0～1.0の範囲に制限
              resultColor = clamp(resultColor, vec4f(0.0), vec4f(1.0));

              textureStore(resultTexture, id.xy, resultColor);
            }
          `;

          const verticalShader = device.createShaderModule({
            label: "Kirakira Blur Vertical Shader",
            code: verticalBlurCode,
          });

          const horizontalShader = device.createShaderModule({
            label: "Kirakira Blur Horizontal Shader",
            code: horizontalBlurCode,
          });

          const verticalPipelineDef =
            makeShaderDataDefinitions(verticalBlurCode);
          const horizontalPipelineDef =
            makeShaderDataDefinitions(horizontalBlurCode);

          const verticalPipeline = device.createComputePipeline({
            label: "Kirakira Blur Vertical Pipeline",
            layout: "auto",
            compute: {
              module: verticalShader,
              entryPoint: "computeMain",
            },
          });

          const horizontalPipeline = device.createComputePipeline({
            label: "Kirakira Blur Horizontal Pipeline",
            layout: "auto",
            compute: {
              module: horizontalShader,
              entryPoint: "computeMain",
            },
          });

          return {
            device,
            verticalPipeline,
            horizontalPipeline,
            verticalPipelineDef,
            horizontalPipelineDef,
          };
        }
      );
    },
    goLiveEffect: async (
      {
        device,
        verticalPipeline,
        horizontalPipeline,
        verticalPipelineDef,
        horizontalPipelineDef,
      },
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
        magFilter: "linear",
        minFilter: "linear",
      });

      // 縦方向パスのユニフォームバッファ
      const verticalUniformValues = makeStructuredView(
        verticalPipelineDef.uniforms.params
      );
      const verticalUniformBuffer = device.createBuffer({
        label: "Kirakira Blur Vertical Params Buffer",
        size: verticalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // 横方向パスのユニフォームバッファ
      const horizontalUniformValues = makeStructuredView(
        horizontalPipelineDef.uniforms.params
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
        makeOriginalTransparent: params.makeOriginalTransparent ? 1 : 0,
        useCustomColor: params.useCustomColor ? 1 : 0,
        customColor: [
          params.customColor.r,
          params.customColor.g,
          params.customColor.b,
          params.customColor.a,
        ],
      });

      horizontalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        strength: params.strength,
        sparkle: params.sparkle,
        makeOriginalTransparent: params.makeOriginalTransparent ? 1 : 0,
        useCustomColor: params.useCustomColor ? 1 : 0,
        customColor: [
          params.customColor.r,
          params.customColor.g,
          params.customColor.b,
          params.customColor.a,
        ],
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
      const verticalBindGroup = device.createBindGroup({
        label: "Kirakira Blur Vertical Bind Group",
        layout: verticalPipeline.getBindGroupLayout(0),
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
        ],
      });

      // 横方向パスのバインドグループ
      const horizontalBindGroup = device.createBindGroup({
        label: "Kirakira Blur Horizontal Bind Group",
        layout: horizontalPipeline.getBindGroupLayout(0),
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
            resource: inputTexture.createView(),
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
      verticalPass.setPipeline(verticalPipeline);
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
      horizontalPass.setPipeline(horizontalPipeline);
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
