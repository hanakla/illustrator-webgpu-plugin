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
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

const t = createTranslator({
  en: {
    title: "Outline Effect (Morphology)",
    size: "Size",
    color: "Color",
  },
  ja: {
    title: "アウトラインエフェクト (モーフォロジー)",
    size: "太さ",
    color: "色",
  },
});

export const outline = definePlugin({
  id: "outline-effect-morphology-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      size: {
        type: "real",
        default: 3.0,
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 0, a: 1 },
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        size: Math.max(0.1, params.size),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        color: adjustColor(params.color),
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        size: params.size * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        size: lerp(paramsA.size, paramsB.size, t),
        color: {
          r: lerp(paramsA.color.r, paramsB.color.r, t),
          g: lerp(paramsA.color.g, paramsB.color.g, t),
          b: lerp(paramsA.color.b, paramsB.color.b, t),
          a: lerp(paramsA.color.a, paramsB.color.a, t),
        },
      };
    },

    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.text({ text: t("size") }),
          ui.slider({
            key: "size",
            dataType: "float",
            min: 0.1,
            max: 200,
            value: params.size,
          }),
          ui.numberInput({
            key: "size",
            dataType: "float",
            value: params.size,
          }),
        ]),
        ui.colorInput({ key: "color", value: params.color }),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Outline Effect Morphology)" },
        },
        (device) => {
          // 境界検出用シェーダー
          const boundaryShaderCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              size: f32,
              color: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var intermediateTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn isTransparent(color: vec4f) -> bool {
              return color.a < 0.01;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let adjustedDims = vec2f(textureDimensions(inputTexture));
                let dims = vec2f(params.outputSize);
                let texCoord = vec2f(id.xy) / dims;
                let toInputTexCoord = dims / adjustedDims;

                // Ignore 256 padded pixels
                if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

                let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

                // DPI対応のサイズ計算
                let scaledSize = params.size * params.dpiScale;

                // 現在のピクセルの透明性
                let isCurrentTransparent = isTransparent(originalColor);

                var outlineIntensity = 0.0;

                if (scaledSize > 0.0) {
                    let stepSize = 1.0 / dims;
                    // 最大距離は線の太さに基づく
                    let maxDist = scaledSize * 1.5;

                    // 放射状に方向でサンプリングして境界を検出
                    let dirCount = 32u; // より多くの方向をサンプリング
                    let angleStep = 3.14159 * 2.0 / f32(dirCount);

                    for (var i = 0u; i < dirCount; i = i + 1u) {
                        let angle = f32(i) * angleStep;
                        let dir = vec2f(cos(angle), sin(angle));

                        var foundBoundary = false;
                        var boundaryDist = maxDist;

                        // より細かいステップでサンプリング
                        let samplingStep = 0.3; // より細かいステップ
                        for (var dist = 0.5; dist <= maxDist; dist += samplingStep) {
                            let offset = dir * stepSize * dist;
                            let sampleCoord = texCoord * toInputTexCoord + offset;

                            // 画像の範囲外はスキップ
                            if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                                sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                                continue;
                            }

                            let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);
                            let isSampleTransparent = isTransparent(sampleColor);

                            // 透明性が異なれば境界を検出
                            if (isSampleTransparent != isCurrentTransparent) {
                                foundBoundary = true;
                                boundaryDist = dist;
                                break;
                            }
                        }

                        if (foundBoundary) {
                            // アウトラインの強度計算：境界に近いほど強く
                            let t = 1.0 - boundaryDist / scaledSize;
                            outlineIntensity = max(outlineIntensity, clamp(t, 0.0, 1.0));
                        }
                    }
                }

                // 結果を中間テクスチャに保存
                // r: 透明性フラグ（1.0は不透明、0.0は透明）
                // g: 未使用
                // b: 未使用
                // a: アウトライン強度
                var transparencyFlag = 0.0;
                if (!isCurrentTransparent) {
                    transparencyFlag = 1.0;
                }

                textureStore(
                  intermediateTexture,
                  id.xy,
                  vec4f(transparencyFlag, 0.0, 0.0, outlineIntensity)
                );
            }
          `;

          // モーフォロジー処理シェーダー
          const morphologyShaderCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              size: f32,
              color: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var intermediateTexture: texture_2d<f32>;
            @group(0) @binding(2) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(3) var textureSampler: sampler;
            @group(0) @binding(4) var<uniform> params: Params;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let adjustedDims = vec2f(textureDimensions(inputTexture));
                let dims = vec2f(params.outputSize);
                let texCoord = vec2f(id.xy) / dims;
                let toInputTexCoord = dims / adjustedDims;

                // Ignore 256 padded pixels
                if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

                // 元の画像と中間テクスチャから情報を取得
                let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
                let intermediateValue = textureSampleLevel(intermediateTexture, textureSampler, texCoord, 0.0);

                // 中間テクスチャの情報を分解
                var isCurrentOpaque = false;
                if (intermediateValue.r > 0.5) {
                    isCurrentOpaque = true;
                }
                let outlineIntensity = intermediateValue.a;

                // DPI対応のサイズ計算
                let scaledSize = params.size * params.dpiScale;

                // モーフォロジー演算のための構造化要素（カーネル）サイズ
                var kernelSize = 4;

                // ステップ1: 拡張操作（Dilation）
                // これにより小さな穴や凹みが埋まります
                var dilatedValue = 0.0;

                for (var dy = -kernelSize; dy <= kernelSize; dy += 1) {
                    for (var dx = -kernelSize; dx <= kernelSize; dx += 1) {
                        let offset = vec2f(f32(dx), f32(dy)) / dims;
                        let sampleCoord = texCoord + offset;

                        // テクスチャの範囲外チェック
                        if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                            sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                            continue;
                        }

                        // 構造化要素（円形カーネル）の条件
                        let dist = length(vec2f(f32(dx), f32(dy)));
                        if (dist > f32(kernelSize)) {
                            continue;
                        }

                        let sampleValue = textureSampleLevel(intermediateTexture, textureSampler, sampleCoord, 0.0);
                        dilatedValue = max(dilatedValue, sampleValue.a);
                    }
                }

                // ステップ2: 収縮操作（Erosion）
                // これにより突起やギザギザが削られます
                var erodedValue = 1.0;

                // 収縮カーネルは拡張より少し小さく
                let erosionKernelSize = max(1, kernelSize - 1);

                for (var dy = -erosionKernelSize; dy <= erosionKernelSize; dy += 1) {
                    for (var dx = -erosionKernelSize; dx <= erosionKernelSize; dx += 1) {
                        let offset = vec2f(f32(dx), f32(dy)) / dims;
                        let sampleCoord = texCoord + offset;

                        // テクスチャの範囲外は最小値とみなす
                        if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 ||
                            sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
                            erodedValue = 0.0;
                            continue;
                        }

                        // 構造化要素（円形カーネル）の条件
                        let dist = length(vec2f(f32(dx), f32(dy)));
                        if (dist > f32(erosionKernelSize)) {
                            continue;
                        }

                        // 拡張済み値を使用して収縮
                        let sampleValue = textureSampleLevel(intermediateTexture, textureSampler, sampleCoord, 0.0);
                        erodedValue = min(erodedValue, sampleValue.a);
                    }
                }

                // 最終的なモーフォロジー処理結果
                // まず拡張してから収縮するのでクローズ操作（Close）になる
                var morphValue = 0.0;

                // 線の太さに応じて挙動を調整
                if (scaledSize < 5.0) {
                    // 細い線は元の値をほぼ維持（軽微なモーフォロジー）
                    morphValue = mix(outlineIntensity, dilatedValue, 0.5);
                } else {
                    // 太い線はフル処理（クローズ操作）
                    morphValue = erodedValue;
                }

                // 閾値処理でバイナリマスク生成
                var binaryMask = 0.0;
                let threshold = 0.3;
                if (morphValue >= threshold) {
                    binaryMask = 1.0;
                }

                // 最終的な滑らかさをわずかに追加
                var finalMask = binaryMask;

                // 結果の合成
                var finalColor = vec4f(0.0, 0.0, 0.0, 0.0);
                if (originalColor.a > 0.01) {
                    // 不透明部分は元の画像を表示（アウトラインを上書き）
                    finalColor = originalColor;
                } else {
                    // 透明部分はアウトラインを表示
                    finalColor = vec4f(
                      params.color.r,
                      params.color.g,
                      params.color.b,
                      finalMask * params.color.a
                    );
                }

                textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const boundaryShader = device.createShaderModule({
            label: "Outline Boundary Detection Shader",
            code: boundaryShaderCode,
          });

          const morphologyShader = device.createShaderModule({
            label: "Outline Morphology Shader",
            code: morphologyShaderCode,
          });

          // パイプライン定義を生成
          const boundaryPipelineDef =
            makeShaderDataDefinitions(boundaryShaderCode);
          const morphologyPipelineDef =
            makeShaderDataDefinitions(morphologyShaderCode);

          // エラーハンドリングのイベントリスナーを設定
          device.addEventListener("lost", (e) => {
            console.error(e);
          });

          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });

          // 2つのパイプラインを作成
          const boundaryPipeline = device.createComputePipeline({
            label: "Outline Boundary Pipeline",
            layout: "auto",
            compute: {
              module: boundaryShader,
              entryPoint: "computeMain",
            },
          });

          const morphologyPipeline = device.createComputePipeline({
            label: "Outline Morphology Pipeline",
            layout: "auto",
            compute: {
              module: morphologyShader,
              entryPoint: "computeMain",
            },
          });

          return {
            device,
            boundaryPipeline,
            morphologyPipeline,
            boundaryPipelineDef,
            morphologyPipelineDef,
          };
        }
      );
    },
    goLiveEffect: async (
      {
        device,
        boundaryPipeline,
        morphologyPipeline,
        boundaryPipelineDef,
        morphologyPipelineDef,
      },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Outline Effect Morphology V1", params);

      const dpiScale = dpi / baseDpi;
      const padding = Math.ceil(params.size * dpiScale);
      imgData = await paddingImageData(imgData, padding);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // WebGPUアライメントのためのパディング
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      // 入力テクスチャの作成
      const inputTexture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      // 中間テクスチャの作成
      const intermediateTexture = device.createTexture({
        label: "Intermediate Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      // 結果テクスチャの作成
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

      // 境界検出用のパラメータバッファ作成
      const boundaryUniformValues = makeStructuredView(
        boundaryPipelineDef.uniforms.params
      );
      const boundaryUniformBuffer = device.createBuffer({
        label: "Boundary Params Buffer",
        size: boundaryUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // モーフォロジー用のパラメータバッファ作成
      const morphologyUniformValues = makeStructuredView(
        morphologyPipelineDef.uniforms.params
      );
      const morphologyUniformBuffer = device.createBuffer({
        label: "Morphology Params Buffer",
        size: morphologyUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // 境界検出用バインドグループの作成
      const boundaryBindGroup = device.createBindGroup({
        label: "Boundary Detection Bind Group",
        layout: boundaryPipeline.getBindGroupLayout(0),
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
            resource: { buffer: boundaryUniformBuffer },
          },
        ],
      });

      // モーフォロジー用バインドグループの作成
      const morphologyBindGroup = device.createBindGroup({
        label: "Morphology Bind Group",
        layout: morphologyPipeline.getBindGroupLayout(0),
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
            resource: resultTexture.createView(),
          },
          {
            binding: 3,
            resource: sampler,
          },
          {
            binding: 4,
            resource: { buffer: morphologyUniformBuffer },
          },
        ],
      });

      // 結果読み取り用ステージングバッファ
      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // 境界検出用Uniformバッファにデータを設定
      boundaryUniformValues.set({
        outputSize: [inputWidth, inputHeight],
        dpiScale,
        size: params.size,
        color: [params.color.r, params.color.g, params.color.b, params.color.a],
      });
      device.queue.writeBuffer(
        boundaryUniformBuffer,
        0,
        boundaryUniformValues.arrayBuffer
      );

      // モーフォロジー用Uniformバッファにデータを設定
      morphologyUniformValues.set({
        outputSize: [inputWidth, inputHeight],
        dpiScale,
        size: params.size,
        color: [params.color.r, params.color.g, params.color.b, params.color.a],
      });
      device.queue.writeBuffer(
        morphologyUniformBuffer,
        0,
        morphologyUniformValues.arrayBuffer
      );

      // ソーステクスチャの更新
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // コマンドエンコーダーの作成
      const commandEncoder = device.createCommandEncoder({
        label: "Morphology Outline Command Encoder",
      });

      // 1. 境界検出パスの実行
      const boundaryPass = commandEncoder.beginComputePass({
        label: "Boundary Detection Compute Pass",
      });
      boundaryPass.setPipeline(boundaryPipeline);
      boundaryPass.setBindGroup(0, boundaryBindGroup);
      boundaryPass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      boundaryPass.end();

      // 2. モーフォロジー処理パスの実行
      const morphologyPass = commandEncoder.beginComputePass({
        label: "Morphology Compute Pass",
      });
      morphologyPass.setPipeline(morphologyPipeline);
      morphologyPass.setBindGroup(0, morphologyBindGroup);
      morphologyPass.dispatchWorkgroups(
        Math.ceil(inputWidth / 16),
        Math.ceil(inputHeight / 16)
      );
      morphologyPass.end();

      // 結果をステージングバッファにコピー
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );

      // コマンドの実行
      device.queue.submit([commandEncoder.finish()]);

      // 結果の読み取り
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );

      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
