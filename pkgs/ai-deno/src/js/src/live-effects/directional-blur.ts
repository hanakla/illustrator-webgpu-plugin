import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./utils.ts";

export const directionalBlur = definePlugin({
  id: "directional-blur-v1",
  title: "Directional Blur V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: StyleFilterFlag.kPostEffectFilter,
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
      fadeOut: {
        type: "real",
        default: 0.0,
      },
      fadeDirection: {
        type: "real",
        default: 0.0,
      },
    },
    editLiveEffectParameters: (params) => params,
    liveEffectInterpolate: (a, b, progress) => {
      return {
        strength: lerp(a.strength, b.strength, progress),
        angle: lerp(a.angle, b.angle, progress),
        opacity: lerp(a.opacity, b.opacity, progress),
        blurMode: b.blurMode,
        fadeOut: lerp(a.fadeOut, b.fadeOut, progress),
        fadeDirection: lerp(a.fadeDirection, b.fadeDirection, progress),
      };
    },
    liveEffectScaleParameters: (params, scale) => {
      return {
        strength: params.strength * scale,
        angle: params.angle,
        opacity: params.opacity,
        blurMode: params.blurMode,
        fadeOut: params.fadeOut,
        fadeDirection: params.fadeDirection,
      };
    },

    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.text({ text: "Directional Blur" }),
          ui.slider({
            key: "strength",
            label: "Strength (px)",
            dataType: "float",
            min: 0,
            max: 500,
            value: params.strength,
          }),
        ]),
        ui.group({ direction: "row" }, [
          ui.text({ text: "Direction" }),
          ui.slider({
            key: "angle",
            label: "Angle",
            dataType: "float",
            min: 0,
            max: 360,
            value: params.angle,
          }),
        ]),
        ui.group({ direction: "row" }, [
          ui.text({ text: "Opacity" }),
          ui.slider({
            key: "opacity",
            label: "Opacity",
            dataType: "float",
            min: 0,
            max: 100,
            value: params.opacity,
          }),
        ]),
        ui.group({ direction: "row" }, [
          ui.text({ text: "Blur Mode" }),
          ui.select({
            key: "blurMode",
            label: "Blur Mode",
            value: params.blurMode,
            options: ["both", "behind", "front"],
          }),
        ]),
        ui.group({ direction: "row" }, [
          ui.text({ text: "縮小率" }),
          ui.slider({
            key: "fadeOut",
            label: "縮小率",
            dataType: "float",
            min: 0.0,
            max: 1.0,
            value: params.fadeOut,
          }),
        ]),
        ui.group({ direction: "row" }, [
          ui.text({ text: "縮小方向" }),
          ui.slider({
            key: "fadeDirection",
            label: "縮小方向",
            dataType: "float",
            min: -1.0,
            max: 1.0,
            value: params.fadeDirection,
          }),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          throw new Error("No GPU adapter found");
        }

        const device = await adapter.requestDevice();
        if (!device) {
          throw new Error("Failed to create WebGPU device");
        }

        const shader = device.createShaderModule({
          code: `
          struct Params {
              strength: f32,
              angle: f32,
              opacity: f32,
              blurMode: u32,
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
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // 元の画像を取得
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // strength = 0 または opacity = 0 なら元の画像をそのまま返す
              if (params.strength <= 0.0 || params.opacity <= 0.0) {
                  textureStore(resultTexture, id.xy, originalColor);
                  return;
              }

              // 方向ベクトルの計算
              let pixelOffset = getOffset(params.angle) * params.strength;
              let texOffset = pixelOffset / dims;

              // strengthに応じたサンプル数の自動計算
              // より多くのサンプルを使用してブラーを滑らかに
              let numSamples = max(i32(params.strength), 5);

              // ブラー処理
              var blurredColor = vec4f(0.0);
              var totalWeight = 0.0;

              // ブラーモードに応じてサンプリング範囲を調整
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

              // 中央と両方向にサンプリング
              for (var i = startSample; i <= endSample; i++) {
                  // 中央のサンプル（i = 0）は元の画像をそのまま使用
                  if (i == 0) {
                      blurredColor += originalColor;
                      totalWeight += 1.0;
                      continue;
                  }

                  // サンプリング位置の計算
                  let blurIntensity = 1.5; // ブラーの強度を上げるための係数
                  let sampleOffset = f32(i) / f32(numSamples) * blurIntensity;

                  // サンプル距離（0.0～1.0に正規化）
                  let normalizedDistance = f32(abs(i)) / f32(numSamples);

                  // 基本的なサンプリング座標（ブラー方向）
                  let baseCoord = texCoord + texOffset * sampleOffset;

                  // 縮小効果の適用
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

                  // サンプリング座標を0.0～1.0の範囲にクランプ
                  sampleCoord = clamp(sampleCoord, vec2f(0.0), vec2f(1.0));

                  // サンプリング
                  let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);

                  // 重み計算
                  let sigma = 0.5; // 固定値を大きくしてぼかし効果を強化（元は0.3）
                  let weight = gaussianWeight(normalizedDistance, sigma);

                  // 合計に加算
                  blurredColor += sampleColor * weight;
                  totalWeight += weight;
              }

              // 正規化
              var finalColor = originalColor;
              if (totalWeight > 0.0) {
                  blurredColor = blurredColor / totalWeight;

                  // behindモードの場合は元の画像を強調
                  if (params.blurMode == 1u) { // behind
                      // behindモードでは、元の画像が優先される単純なブレンド
                      let behindOpacity = min(params.opacity * 0.7, 70.0) / 100.0; // 上限を引き上げ
                      finalColor = mix(originalColor, blurredColor, behindOpacity);
                  } else {
                      // 通常のブレンド
                      finalColor = mix(originalColor, blurredColor, params.opacity / 100.0);
                  }
              }

              textureStore(resultTexture, id.xy, finalColor);
          }
        `,
        });

        const pipeline = device.createComputePipeline({
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeMain",
          },
        });

        return { device, pipeline };
      } catch (err) {
        console.error("WebGPU initialization error:", err);
        throw err;
      }
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      try {
        // Make padding for blur overflow
        imgData = await paddingImageData(imgData, params.strength);
        const outputWidth = imgData.width;
        const outputHeight = imgData.height;

        imgData = await addWebGPUAlignmentPadding(imgData);
        const inputWidth = imgData.width;
        const inputHeight = imgData.height;

        // テクスチャ作成
        const texture = device.createTexture({
          size: [inputWidth, inputHeight],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        const resultTexture = device.createTexture({
          size: [inputWidth, inputHeight],
          format: "rgba8unorm",
          usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
        });

        const sampler = device.createSampler({
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

        // ユニフォームバッファ
        const uniformBuffer = device.createBuffer({
          size: 24, // 6 * 4 bytes
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // バッファデータを設定
        const uniformData = new ArrayBuffer(24);
        const dataView = new DataView(uniformData);

        // 値を0で初期化
        const zeroArray = new Uint8Array(uniformData);
        zeroArray.fill(0);

        // パラメータをセット
        dataView.setFloat32(0, params.strength, true);
        dataView.setFloat32(4, params.angle, true);
        dataView.setFloat32(8, params.opacity, true);
        dataView.setUint32(12, blurModeValue, true);
        dataView.setFloat32(16, params.fadeOut || 0.0, true);
        dataView.setFloat32(20, params.fadeDirection || 0.0, true);

        device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        // バインドグループの作成
        const bindGroup = device.createBindGroup({
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

        // テクスチャに画像データを書き込む
        device.queue.writeTexture(
          { texture },
          imgData.data,
          { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
          [inputWidth, inputHeight]
        );

        // コンピュートシェーダー実行
        const commandEncoder = device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(inputWidth / 16),
          Math.ceil(inputHeight / 16)
        );
        computePass.end();

        // 結果を読み取るためのステージングバッファ
        const stagingBuffer = device.createBuffer({
          size: inputWidth * inputHeight * 4,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        commandEncoder.copyTextureToBuffer(
          { texture: resultTexture },
          {
            buffer: stagingBuffer,
            bytesPerRow: inputWidth * 4,
            rowsPerImage: inputHeight,
          },
          [inputWidth, inputHeight]
        );

        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // バッファからデータを読み取る
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const copyArrayBuffer = stagingBuffer.getMappedRange();
        const resultData = new Uint8Array(copyArrayBuffer.slice(0));
        stagingBuffer.unmap();

        // 結果を新しいImageDataに変換
        const resultImageData = await removeWebGPUAlignmentPadding(
          new ImageData(
            new Uint8ClampedArray(resultData),
            inputWidth,
            inputHeight
          ),
          outputWidth,
          outputHeight
        );

        return resultImageData;
      } catch (err) {
        console.error("WebGPU processing error:", err);
        return imgData;
      }
    },
  },
});
