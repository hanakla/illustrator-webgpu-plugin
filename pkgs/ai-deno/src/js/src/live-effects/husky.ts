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
    title: "Blur & Bleed Effect",
    direction: "Direction",
    angle: "Angle",
    horizontalEnabled: "Horizontal Enabled",
    verticalEnabled: "Vertical Enabled",
    blurIntensity: "Blur Intensity",
    bleedIntensity: "Bleed Intensity",
    randomSeed: "Random Seed",
    maxOffset: "Maximum Offset",
  },
  ja: {
    title: "にじみ・かすれエフェクト",
    direction: "方向",
    angle: "角度",
    horizontalEnabled: "横方向有効化",
    verticalEnabled: "縦方向有効化",
    blurIntensity: "かすれ強度",
    bleedIntensity: "にじみ強度",
    randomSeed: "ランダムシード",
    maxOffset: "最大オフセット",
  },
});

export const husky = definePlugin({
  id: "husky-effect-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      angle: {
        type: "real",
        default: 0.0,
      },
      horizontalEnabled: {
        type: "bool",
        default: true,
      },
      verticalEnabled: {
        type: "bool",
        default: true,
      },
      blurIntensity: {
        type: "real",
        default: 0.5,
      },
      bleedIntensity: {
        type: "real",
        default: 0.5,
      },
      maxOffset: {
        type: "real",
        default: 10.0,
      },
      randomSeed: {
        type: "real",
        default: 0.5,
      },
    },
    onEditParameters: (params) => {
      // パラメータの正規化
      return {
        ...params,
        angle: Math.max(0, Math.min(360, params.angle)),
        blurIntensity: Math.max(0, Math.min(1, params.blurIntensity)),
        bleedIntensity: Math.max(0, Math.min(1, params.bleedIntensity)),
        maxOffset: Math.max(0, Math.min(50, params.maxOffset)),
        randomSeed: Math.max(0, Math.min(1, params.randomSeed)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      // 色調整が必要なパラメータがない場合はそのまま返す
      return params;
    },
    onScaleParams(params, scaleFactor) {
      // パラメータのスケーリング
      return {
        ...params,
        angle: params.angle,
        horizontalEnabled: params.horizontalEnabled,
        verticalEnabled: params.verticalEnabled,
        blurIntensity: params.blurIntensity,
        bleedIntensity: params.bleedIntensity,
        maxOffset: params.maxOffset * scaleFactor,
        randomSeed: params.randomSeed,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // パラメータの補間
      return {
        angle: lerp(paramsA.angle, paramsB.angle, t),
        horizontalEnabled:
          t < 0.5 ? paramsA.horizontalEnabled : paramsB.horizontalEnabled,
        verticalEnabled:
          t < 0.5 ? paramsA.verticalEnabled : paramsB.verticalEnabled,
        blurIntensity: lerp(paramsA.blurIntensity, paramsB.blurIntensity, t),
        bleedIntensity: lerp(paramsA.bleedIntensity, paramsB.bleedIntensity, t),
        maxOffset: lerp(paramsA.maxOffset, paramsB.maxOffset, t),
        randomSeed: lerp(paramsA.randomSeed, paramsB.randomSeed, t),
      };
    },
    renderUI: (params, { setParam }) => {
      // UI レンダリング
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("direction") }),
          ui.group({ direction: "col" }, [
            ui.text({ text: t("angle") }),
            ui.group({ direction: "row" }, [
              ui.slider({ key: "angle", dataType: 'float', min: 0, max: 360, value: params.angle }),
              ui.numberInput({ key: "angle", dataType: 'float', value: params.angle }),
            ]),
          ]),
          ui.group({ direction: "row" }, [
            ui.checkbox({ key: "horizontalEnabled", value: params.horizontalEnabled, label: t("horizontalEnabled") }),
            ui.checkbox({ key: "verticalEnabled", value: params.verticalEnabled, label: t("verticalEnabled") }),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blurIntensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "blurIntensity", dataType: 'float', min: 0, max: 1, value: params.blurIntensity }),
            ui.numberInput({ key: "blurIntensity", dataType: 'float', value: params.blurIntensity }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("bleedIntensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bleedIntensity", dataType: 'float', min: 0, max: 1, value: params.bleedIntensity }),
            ui.numberInput({ key: "bleedIntensity", dataType: 'float', value: params.bleedIntensity }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("maxOffset") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "maxOffset", dataType: 'float', min: 0, max: 50, value: params.maxOffset }),
            ui.numberInput({ key: "maxOffset", dataType: 'float', value: params.maxOffset }),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("randomSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "randomSeed", dataType: 'float', min: 0, max: 1, value: params.randomSeed }),
            ui.numberInput({ key: "randomSeed", dataType: 'float', value: params.randomSeed }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Husky Effect)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              angle: f32,
              horizontalEnabled: i32,
              verticalEnabled: i32,
              blurIntensity: f32,
              bleedIntensity: f32,
              maxOffset: f32,
              randomSeed: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn random(co: vec2f) -> f32 {
              return fract(sin(dot(co, vec2f(12.9898, 78.233))) * 43758.5453);
            }

            fn noise(p: vec2f, seed: f32) -> f32 {
              let pi = floor(p);
              let pf = fract(p);

              let seedVec = vec2f(seed, seed * 1.374);

              let n00 = random(pi + seedVec);
              let n10 = random(pi + vec2f(1.0, 0.0) + seedVec);
              let n01 = random(pi + vec2f(0.0, 1.0) + seedVec);
              let n11 = random(pi + vec2f(1.0, 1.0) + seedVec);

              let u = pf * pf * (3.0 - 2.0 * pf);

              let nx0 = mix(n00, n10, u.x);
              let nx1 = mix(n01, n11, u.x);

              return mix(nx0, nx1, u.y);
            }

            fn fractalNoise(p: vec2f, seed: f32) -> f32 {
              var value = 0.0;
              var amplitude = 0.5;
              var frequency = 1.0;
              let octaves = 4;
              let lacunarity = 2.0;
              let persistence = 0.5;

              for (var i = 0; i < octaves; i = i + 1) {
                value = value + noise(p * frequency, seed + f32(i) * 13.371) * amplitude;
                amplitude = amplitude * persistence;
                frequency = frequency * lacunarity;
              }

              return value;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              // 処理範囲チェック
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // オリジナルの色を取得
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              if (params.blurIntensity <= 0.0 && params.bleedIntensity <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let angleRad = params.angle * 3.14159265359 / 180.0;

              let dirX = cos(angleRad);
              let dirY = sin(angleRad);

              var horizEnabled = 0.0;
              var vertEnabled = 0.0;

              if (params.horizontalEnabled != 0) {
                horizEnabled = 1.0;
              }

              if (params.verticalEnabled != 0) {
                vertEnabled = 1.0;
              }

              let direction = vec2f(
                dirX * horizEnabled,
                dirY * vertEnabled
              );

              let noiseScale = 3.0;
              let noiseSeed = params.randomSeed * 100.0;

              let noiseUV = texCoord * noiseScale;

              var finalColor = originalColor;

              if (params.blurIntensity > 0.0) {
                let blurNoiseValue = fractalNoise(noiseUV, noiseSeed) * 2.0 - 1.0;
                let offsetScale = params.maxOffset * params.dpiScale * 0.5;  // 効果を大きく
                let blurOffset = direction * blurNoiseValue * params.blurIntensity * offsetScale;

                var blurredColor = vec4f(0.0, 0.0, 0.0, 0.0);
                var totalWeight = 0.0;
                let sampleCount = 6;

                for (var i = 0; i < sampleCount; i = i + 1) {
                  let t = f32(i) / f32(sampleCount - 1);
                  let weight = 1.0 - abs(t - 0.5) * 2.0;

                  let sampleOffset = blurOffset * (t - 0.5) * 2.0;
                  let sampleCoord = texCoord + sampleOffset / dims;

                  var validSample = false;
                  if (sampleCoord.x >= 0.0 &&
                      sampleCoord.x <= 1.0 &&
                      sampleCoord.y >= 0.0 &&
                      sampleCoord.y <= 1.0) {
                    validSample = true;
                  }

                  if (validSample) {
                    let sampleColor = textureSampleLevel(
                      inputTexture,
                      textureSampler,
                      sampleCoord,
                      0.0
                    );

                    blurredColor = blurredColor + sampleColor * weight;
                    totalWeight = totalWeight + weight;
                  }
                }

                if (totalWeight > 0.0) {
                  blurredColor = blurredColor / totalWeight;
                  finalColor = blurredColor;
                }
              }

              if (params.bleedIntensity > 0.0) {
                let redNoiseValue = fractalNoise(noiseUV + vec2f(1.234, 5.678), noiseSeed);
                let greenNoiseValue = fractalNoise(noiseUV + vec2f(4.321, 8.765), noiseSeed + 10.0);
                let blueNoiseValue = fractalNoise(noiseUV + vec2f(7.890, 1.234), noiseSeed + 20.0);

                let redOffset = (redNoiseValue * 2.0 - 1.0) * params.bleedIntensity;
                let greenOffset = (greenNoiseValue * 2.0 - 1.0) * params.bleedIntensity * 0.7;
                let blueOffset = (blueNoiseValue * 2.0 - 1.0) * params.bleedIntensity;

                let offsetScale = params.maxOffset * params.dpiScale * 0.4;  // 効果を大きく

                let redTexCoord = texCoord + direction * redOffset * offsetScale / dims;
                let greenTexCoord = texCoord + direction * greenOffset * offsetScale / dims;
                let blueTexCoord = texCoord + direction * blueOffset * offsetScale / dims;

                var validRedSample = false;
                if (redTexCoord.x >= 0.0 &&
                    redTexCoord.x <= 1.0 &&
                    redTexCoord.y >= 0.0 &&
                    redTexCoord.y <= 1.0) {
                  validRedSample = true;
                }

                var validGreenSample = false;
                if (greenTexCoord.x >= 0.0 &&
                    greenTexCoord.x <= 1.0 &&
                    greenTexCoord.y >= 0.0 &&
                    greenTexCoord.y <= 1.0) {
                  validGreenSample = true;
                }

                var validBlueSample = false;
                if (blueTexCoord.x >= 0.0 &&
                    blueTexCoord.x <= 1.0 &&
                    blueTexCoord.y >= 0.0 &&
                    blueTexCoord.y <= 1.0) {
                  validBlueSample = true;
                }

                var redValue = finalColor.r;
                var greenValue = finalColor.g;
                var blueValue = finalColor.b;

                if (validRedSample) {
                  let redSample = textureSampleLevel(inputTexture, textureSampler, redTexCoord, 0.0);
                  redValue = redSample.r;
                }

                if (validGreenSample) {
                  let greenSample = textureSampleLevel(inputTexture, textureSampler, greenTexCoord, 0.0);
                  greenValue = greenSample.g;
                }

                if (validBlueSample) {
                  let blueSample = textureSampleLevel(inputTexture, textureSampler, blueTexCoord, 0.0);
                  blueValue = blueSample.b;
                }

                finalColor = vec4f(redValue, greenValue, blueValue, finalColor.a);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Husky Effect Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Husky Effect Pipeline",
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
      console.log("Husky Effect V1", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // WebGPUアライメントのためのパディングを追加
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      // 入力テクスチャの作成
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      // 出力テクスチャの作成
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      // サンプラーの作成
      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // ユニフォームバッファの作成と設定
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // パラメータをシェーダーに設定
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        angle: params.angle,
        horizontalEnabled: params.horizontalEnabled ? 1 : 0,
        verticalEnabled: params.verticalEnabled ? 1 : 0,
        blurIntensity: params.blurIntensity,
        bleedIntensity: params.bleedIntensity,
        diffusionRadius: params.diffusionRadius,
        inkAbsorption: params.inkAbsorption,
        edgeEnhance: params.edgeEnhance,
        randomSeed: params.randomSeed,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      // バインドグループの作成
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

      // ステージングバッファの作成
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // 入力テクスチャへデータを書き込み
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // コマンドエンコーダの作成と実行
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Husky Effect Compute Pass",
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      computePass.end();

      // 結果をステージングバッファにコピー
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );

      device.queue.submit([commandEncoder.finish()]);

      // 結果を読み取って返す
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );

      // パディングを除去して元のサイズに戻す
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
