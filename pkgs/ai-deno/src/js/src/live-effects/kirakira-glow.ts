import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./utils.ts";

export const kirakiraGlow = definePlugin({
  id: "kirakira-glow-effect-v1",
  title: "KiraKira Glow V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      strength: {
        type: "real",
        default: 10.0,
      },
      transparentOriginal: {
        type: "bool",
        default: false,
      },
    },
    editLiveEffectParameters: (params) => {
      params.strength = Math.max(0, params.strength);
      return params;
    },
    liveEffectScaleParameters(params, scaleFactor) {
      return {
        strength: params.strength * scaleFactor,
        transparentOriginal: params.transparentOriginal,
      };
    },
    liveEffectInterpolate: (paramsA, paramsB, t) => {
      return {
        strength: lerp(paramsA.strength, paramsB.strength, t),
        transparentOriginal:
          t < 0.5 ? paramsA.transparentOriginal : paramsB.transparentOriginal,
      };
    },

    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.slider({
            key: "strength",
            label: "Blur Strength",
            dataType: "float",
            min: 0,
            max: 500,
            value: params.strength,
          }),
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "transparentOriginal",
            label: "Transparent Original",
            value: params.transparentOriginal,
          }),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then((adapter) =>
        adapter!.requestDevice({
          label: "WebGPU(Glow Effect)",
        })
      );

      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }

      const shader = device.createShaderModule({
        label: "Glow Effect Shader",
        code: `
          struct Params {
            strength: f32,
            transparentOriginal: u32,
            width: u32,
            height: u32,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          // ガウス関数
          fn gaussian(x: f32, y: f32, sigma: f32) -> f32 {
            let sigma2 = sigma * sigma;
            return exp(-(x * x + y * y) / (2.0 * sigma2)) / (2.0 * 3.14159265359 * sigma2);
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // 元の色を取得
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // シグマはstrengthの1/3
              let sigma = max(1.0, params.strength / 3.0);
              // カーネルサイズ (最大50ピクセル)
              let kernelSize = i32(min(50.0, ceil(params.strength)));

              var totalWeight = 0.0;
              var totalColor = vec3f(0.0);
              var totalAlpha = 0.0;

              // ガウスぼかし計算
              for (var y = -kernelSize; y <= kernelSize; y++) {
                  for (var x = -kernelSize; x <= kernelSize; x++) {
                      let weight = gaussian(f32(x), f32(y), sigma);
                      let sampleCoord = texCoord + vec2f(f32(x) / dims.x, f32(y) / dims.y);

                      if (sampleCoord.x >= 0.0 && sampleCoord.x <= 1.0 &&
                          sampleCoord.y >= 0.0 && sampleCoord.y <= 1.0) {
                          let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);

                          if (sampleColor.a > 0.001) {
                              // アルファを考慮した正しい色の処理
                              let unpremultipliedColor = sampleColor.rgb / sampleColor.a;
                              totalColor += unpremultipliedColor * weight * sampleColor.a;
                              totalAlpha += sampleColor.a * weight;
                          }
                          totalWeight += weight;
                      }
                  }
              }

              // ぼかし色の計算と2倍にする
              var blurredColor = vec4f(0.0);
              if (totalWeight > 0.0 && totalAlpha > 0.001) {
                  // アルファで割って正規化して2倍に
                  let normalizedColor = totalColor / totalAlpha;
                  blurredColor = vec4f(normalizedColor, totalAlpha / totalWeight);
              }

              // 最終的な色の合成
              var finalColor: vec4f;

              if (params.transparentOriginal != 0u) {
                  // 元画像を透明にし、ぼかした画像のみ表示
                  finalColor = blurredColor;

                  // 元画像が存在する部分を透明にする
                  if (originalColor.a > 0.0) {
                      finalColor.a = finalColor.a * (1.0 - originalColor.a);
                  }
              } else {
                  // まずぼかした画像を描画
                  finalColor = blurredColor;

                  // その上に元画像を重ねる
                  if (originalColor.a > 0.0) {
                      finalColor = vec4f(
                          mix(finalColor.rgb, originalColor.rgb, originalColor.a),
                          max(finalColor.a, originalColor.a)
                      );
                  }
              }

              textureStore(resultTexture, id.xy, finalColor);
          }
      `,
      });

      device.addEventListener("lost", (e) => {
        console.error(e);
      });

      device.addEventListener("uncapturederror", (e) => {
        console.error(e.error);
      });

      const pipeline = device.createComputePipeline({
        label: "Glow Effect Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain",
        },
      });

      return { device, pipeline };
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      console.log("Glow Effect V1", params);

      // strengthと同じサイズのパディングを適用
      const padding = Math.ceil(params.strength);
      imgData = await paddingImageData(imgData, padding);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // WebGPUのアライメント要件に合わせたパディング
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      // テクスチャの作成
      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
      });

      // ユニフォームバッファの作成
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: 16, // float(strength) + uint(transparentOriginal) + uint(width) + uint(height)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

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

      // ユニフォームの更新
      const uniformData = new ArrayBuffer(16);
      const uniformView = new DataView(uniformData);
      uniformView.setFloat32(0, params.strength, true);
      uniformView.setUint32(4, params.transparentOriginal ? 1 : 0, true);
      uniformView.setUint32(8, inputWidth, true);
      uniformView.setUint32(12, inputHeight, true);

      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // ソーステクスチャの更新
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // 計算シェーダーの実行
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Glow Effect Compute Pass",
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

      // 結果の読み戻しと表示
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
