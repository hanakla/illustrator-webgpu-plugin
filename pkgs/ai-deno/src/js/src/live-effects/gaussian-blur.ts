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
    title: "Gaussian Blur",
    radius: "Blur Radius (px)",
    strength: "Blur Strength",
  },
  ja: {
    title: "ガウスブラー",
    radius: "ぼかし半径 (px)",
    strength: "ぼかし強度",
  },
});

export const gaussianBlur = definePlugin({
  id: "gaussian-blur-v1",
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
    },
    onEditParameters: (params) => {
      return {
        ...params,
        radius: Math.max(0, Math.min(200, params.radius)),
        strength: Math.max(0, Math.min(2, params.strength)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        radius: Math.round(params.radius * scaleFactor),
        strength: params.strength,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        radius: Math.round(lerp(paramsA.radius, paramsB.radius, t)),
        strength: lerp(paramsA.strength, paramsB.strength, t),
      };
    },
    renderUI: (params, setParam) => {
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
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Gaussian Blur)" },
        },
        (device) => {
          // 縦方向ブラーのシェーダー
          const verticalBlurCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              radius: i32,
              strength: f32,
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

              // アルファとRGBを分けて計算するために変数を分ける
              let centerWeight = gaussianWeight(0.0, sigma);

              // アルファ計算用
              var totalWeightAlpha = centerWeight;
              var resultAlpha = originalColor.a * centerWeight;

              // RGB計算用（アルファで重み付け）
              var totalWeightRGB = centerWeight * originalColor.a;
              // アルファが0の場合でもRGB値を保持する（プリマルチプライドから戻す）
              var resultRGB: vec3f;
              if (originalColor.a > 0.0) {
                resultRGB = originalColor.rgb * centerWeight * originalColor.a;
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

                // アルファ値の計算
                resultAlpha += (sampleUp.a + sampleDown.a) * weight;
                totalWeightAlpha += weight * 2.0;

                // RGB値の計算（アルファで重み付け）
                // アルファが0でなければRGBを考慮
                if (sampleUp.a > 0.0) {
                  resultRGB += sampleUp.rgb * weight * sampleUp.a;
                  totalWeightRGB += weight * sampleUp.a;
                }

                if (sampleDown.a > 0.0) {
                  resultRGB += sampleDown.rgb * weight * sampleDown.a;
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
              alphaOnly: i32,
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

              // アルファとRGBを分けて計算するために変数を分ける
              let centerWeight = gaussianWeight(0.0, sigma);

              // アルファ計算用
              var totalWeightAlpha = centerWeight;
              var resultAlpha = originalColor.a * centerWeight;

              // RGB計算用（アルファで重み付け）
              var totalWeightRGB = centerWeight * originalColor.a;
              // アルファが0の場合でもRGB値を保持する（プリマルチプライドから戻す）
              var resultRGB: vec3f;
              if (originalColor.a > 0.0) {
                resultRGB = originalColor.rgb * centerWeight * originalColor.a;
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

                // アルファ値の計算
                resultAlpha += (sampleRight.a + sampleLeft.a) * weight;
                totalWeightAlpha += weight * 2.0;

                // RGB値の計算（アルファで重み付け）
                // アルファが0でなければRGBを考慮
                if (sampleRight.a > 0.0) {
                  resultRGB += sampleRight.rgb * weight * sampleRight.a;
                  totalWeightRGB += weight * sampleRight.a;
                }

                if (sampleLeft.a > 0.0) {
                  resultRGB += sampleLeft.rgb * weight * sampleLeft.a;
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
                finalRGB = originalColor.rgb;
              }

              let finalColor = vec4f(finalRGB, resultAlpha);
              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const verticalShader = device.createShaderModule({
            label: "Gaussian Blur Vertical Shader",
            code: verticalBlurCode,
          });

          const horizontalShader = device.createShaderModule({
            label: "Gaussian Blur Horizontal Shader",
            code: horizontalBlurCode,
          });

          const verticalPipelineDef =
            makeShaderDataDefinitions(verticalBlurCode);
          const horizontalPipelineDef =
            makeShaderDataDefinitions(horizontalBlurCode);

          const verticalPipeline = device.createComputePipeline({
            label: "Gaussian Blur Vertical Pipeline",
            layout: "auto",
            compute: {
              module: verticalShader,
              entryPoint: "computeMain",
            },
          });

          const horizontalPipeline = device.createComputePipeline({
            label: "Gaussian Blur Horizontal Pipeline",
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
      console.log("Gaussian Blur V1", params);

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
        label: "Gaussian Blur Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      // 中間テクスチャ（縦方向ブラーの結果を保存）
      const intermediateTexture = device.createTexture({
        label: "Gaussian Blur Intermediate Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      // 結果テクスチャ
      const resultTexture = device.createTexture({
        label: "Gaussian Blur Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      // サンプラー
      const sampler = device.createSampler({
        label: "Gaussian Blur Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
      });

      // 縦方向パスのユニフォームバッファ
      const verticalUniformValues = makeStructuredView(
        verticalPipelineDef.uniforms.params
      );
      const verticalUniformBuffer = device.createBuffer({
        label: "Gaussian Blur Vertical Params Buffer",
        size: verticalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // 横方向パスのユニフォームバッファ
      const horizontalUniformValues = makeStructuredView(
        horizontalPipelineDef.uniforms.params
      );
      const horizontalUniformBuffer = device.createBuffer({
        label: "Gaussian Blur Horizontal Params Buffer",
        size: horizontalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // ユニフォーム値を設定
      verticalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        strength: params.strength,
      });

      horizontalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        strength: params.strength,
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

      // 縦方向パスのバインドグループ
      const verticalBindGroup = device.createBindGroup({
        label: "Gaussian Blur Vertical Bind Group",
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
        label: "Gaussian Blur Horizontal Bind Group",
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
        ],
      });

      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // 入力テクスチャにデータを書き込み
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      // コマンドエンコーダを作成
      const commandEncoder = device.createCommandEncoder({
        label: "Gaussian Blur Command Encoder",
      });

      // 縦方向パスを実行
      const verticalPass = commandEncoder.beginComputePass({
        label: "Gaussian Blur Vertical Pass",
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
        label: "Gaussian Blur Horizontal Pass",
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
