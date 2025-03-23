import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { createGPUDevice } from "./_shared.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";

const t = createTranslator({
  en: {
    title: "KiraKira Glow V1",
    strength: "Blur Strength",
    transparentOriginal: "Transparent original",
    highQuality: "High quality mode",
  },
  ja: {
    title: "キラキラグロー V1",
    strength: "ぼかし強度",
    transparentOriginal: "元画像を透明にする",
    highQuality: "高品質モード",
  },
});

export const kirakiraGlow = definePlugin({
  id: "kirakira-glow-effect-v1",
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
        default: 10.0,
      },
      transparentOriginal: {
        type: "bool",
        default: false,
      },
      highQuality: {
        type: "bool",
        default: false,
      },
    },
    onEditParameters: (params) => {
      params.strength = Math.max(0, params.strength);
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        strength: params.strength * scaleFactor,
        transparentOriginal: params.transparentOriginal,
        highQuality: params.highQuality,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        strength: lerp(paramsA.strength, paramsB.strength, t),
        transparentOriginal:
          t < 0.5 ? paramsA.transparentOriginal : paramsB.transparentOriginal,
        highQuality: t < 0.5 ? paramsA.highQuality : paramsB.highQuality,
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
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "transparentOriginal",
            label: t("transparentOriginal"),
            value: params.transparentOriginal,
          }),
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "highQuality",
            label: t("highQuality"),
            value: params.highQuality,
          }),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, async (device) => {
        const shader = device.createShaderModule({
          label: "Optimized Glow Effect Shader",
          code: mainShaderCode(),
        });

        const defs = makeShaderDataDefinitions(mainShaderCode());

        const downsamplePipeline = device.createComputePipeline({
          label: "Downsample Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeDownsample",
          },
        });

        const horizontalBlurPipeline = device.createComputePipeline({
          label: "Horizontal Blur Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeHorizontalBlur",
          },
        });

        const verticalBlurPipeline = device.createComputePipeline({
          label: "Vertical Blur Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeVerticalBlur",
          },
        });

        const compositePipeline = device.createComputePipeline({
          label: "Composite Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeFinalComposite",
          },
        });

        return {
          defs,
          downsamplePipeline,
          horizontalBlurPipeline,
          verticalBlurPipeline,
          compositePipeline,
        };
      });
    },
    goLiveEffect: async (
      {
        device,
        downsamplePipeline,
        horizontalBlurPipeline,
        verticalBlurPipeline,
        compositePipeline,
        defs,
      },
      params,
      imgData,
      env
    ) => {
      const dpiScale = env.dpi / env.baseDpi;

      const padding = Math.ceil(params.strength * dpiScale);
      imgData = await paddingImageData(imgData, padding);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      let downscaleFactor = 1;
      if (!params.highQuality) {
        if (inputWidth > 8192) downscaleFactor = 8;
        else if (inputWidth > 4096) downscaleFactor = 4;
        else if (inputWidth > 2048) downscaleFactor = 2;
      } else {
        if (inputWidth > 8192) downscaleFactor = 4;
        else if (inputWidth > 4096) downscaleFactor = 2;
      }

      const smallWidth = Math.ceil(inputWidth / downscaleFactor);
      const smallHeight = Math.ceil(inputHeight / downscaleFactor);

      // テクスチャの作成
      const inputTexture = device.createTexture({
        label: "KiraKiraGlow_InputTexture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      // 中間処理用テクスチャ
      const tempTexture = device.createTexture({
        label: "KiraKiraGlow_TempTexture",
        size: [smallWidth, smallHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.STORAGE_BINDING |
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_SRC |
          GPUTextureUsage.COPY_DST,
      });

      // 結果テクスチャ
      const resultTexture = device.createTexture({
        label: "KiraKiraGlow_ResultTexture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.STORAGE_BINDING |
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_SRC |
          GPUTextureUsage.COPY_DST,
      });

      const sampler = device.createSampler({
        label: "KiraKiraGlow_Sampler",
        magFilter: "linear",
        minFilter: "linear",
      });

      const uniformData = makeStructuredView(defs.uniforms.params);
      uniformData.set({
        strength: params.strength,
        transparentOriginal: params.transparentOriginal ? 1 : 0,
        highQuality: params.highQuality ? 1 : 0,
        width: inputWidth,
        height: inputHeight,
        downscaleFactor,
      });

      const uniformBuffer = device.createBuffer({
        label: "KiraKiraGlow_UniformBuffer",
        size: uniformData.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformData.arrayBuffer);

      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // ダウンサンプルバインドグループ
      const downsampleBindGroup = device.createBindGroup({
        label: "KiraKiraGlow_DownsampleBindGroup",
        layout: downsamplePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: tempTexture.createView() },
          { binding: 3, resource: sampler },
        ],
      });

      // 水平ブラーバインドグループ
      const horizontalBlurBindGroup = device.createBindGroup({
        label: "KiraKiraGlow_HorizontalBlurBindGroup",
        layout: horizontalBlurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 1, resource: tempTexture.createView() },
          { binding: 2, resource: resultTexture.createView() },
          { binding: 3, resource: sampler },
          { binding: 4, resource: { buffer: uniformBuffer } },
        ],
      });

      // 水平ブラー読み取り用バインドグループ
      const horizontalBlurReadGroup = device.createBindGroup({
        label: "KiraKiraGlow_HorizontalBlurReadGroup",
        layout: horizontalBlurPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: tempTexture.createView() }],
      });

      // 垂直ブラーバインドグループ
      const verticalBlurBindGroup = device.createBindGroup({
        label: "KiraKiraGlow_VerticalBlurBindGroup",
        layout: verticalBlurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 1, resource: tempTexture.createView() },
          { binding: 2, resource: resultTexture.createView() },
          { binding: 3, resource: sampler },
          { binding: 4, resource: { buffer: uniformBuffer } },
        ],
      });

      // 垂直ブラー読み取り用バインドグループ
      const verticalBlurReadGroup = device.createBindGroup({
        label: "KiraKiraGlow_VerticalBlurReadGroup",
        layout: verticalBlurPipeline.getBindGroupLayout(1),
        entries: [{ binding: 1, resource: resultTexture.createView() }],
      });

      // 最終合成バインドグループ
      const compositeBindGroup = device.createBindGroup({
        label: "KiraKiraGlow_CompositeBindGroup",
        layout: compositePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: tempTexture.createView() },
          { binding: 2, resource: resultTexture.createView() },
          { binding: 3, resource: sampler },
          { binding: 4, resource: { buffer: uniformBuffer } },
        ],
      });

      // 最終合成読み取り用バインドグループ
      const compositeReadGroup = device.createBindGroup({
        label: "KiraKiraGlow_CompositeReadGroup",
        layout: compositePipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: tempTexture.createView() }],
      });

      // コマンドエンコーダーの作成と実行
      const commandEncoder = device.createCommandEncoder({
        label: "KiraKiraGlow_CommandEncoder",
      });

      // ステップ1: ダウンサンプリング
      {
        const computePass = commandEncoder.beginComputePass({
          label: "KiraKiraGlow_DownsamplePass",
        });
        computePass.setPipeline(downsamplePipeline);
        computePass.setBindGroup(0, downsampleBindGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(smallWidth / 16),
          Math.ceil(smallHeight / 16)
        );
        computePass.end();
      }

      // ステップ2: 水平方向のブラー
      {
        const computePass = commandEncoder.beginComputePass({
          label: "KiraKiraGlow_HorizontalBlurPass",
        });
        computePass.setPipeline(horizontalBlurPipeline);
        computePass.setBindGroup(0, horizontalBlurBindGroup);
        computePass.setBindGroup(1, horizontalBlurReadGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(smallWidth / 16),
          Math.ceil(smallHeight / 16)
        );
        computePass.end();
      }

      // ステップ3: 垂直方向のブラー
      {
        const computePass = commandEncoder.beginComputePass({
          label: "KiraKiraGlow_VerticalBlurPass",
        });
        computePass.setPipeline(verticalBlurPipeline);
        computePass.setBindGroup(0, verticalBlurBindGroup);
        computePass.setBindGroup(1, verticalBlurReadGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(smallWidth / 16),
          Math.ceil(smallHeight / 16)
        );
        computePass.end();
      }

      // ステップ4: 最終合成
      {
        const computePass = commandEncoder.beginComputePass({
          label: "KiraKiraGlow_CompositePass",
        });
        computePass.setPipeline(compositePipeline);
        computePass.setBindGroup(0, compositeBindGroup);
        computePass.setBindGroup(1, compositeReadGroup);
        computePass.dispatchWorkgroups(
          Math.ceil(inputWidth / 16),
          Math.ceil(inputHeight / 16)
        );
        computePass.end();
      }

      const stagingBuffer = device.createBuffer({
        label: "KiraKiraGlow_StagingBuffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );

      device.queue.submit([commandEncoder.finish()]);

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

function mainShaderCode() {
  return `
    struct Params {
      strength: f32,
      transparentOriginal: u32,
      highQuality: u32,
      width: u32,
      height: u32,
      downscaleFactor: u32,
    }

    @group(0) @binding(0) var inputTexture: texture_2d<f32>;
    @group(0) @binding(1) var tempTexture: texture_storage_2d<rgba8unorm, write>;
    @group(0) @binding(2) var resultTexture: texture_storage_2d<rgba8unorm, write>;
    @group(0) @binding(3) var textureSampler: sampler;
    @group(0) @binding(4) var<uniform> params: Params;
    @group(1) @binding(0) var tempReadTexture: texture_2d<f32>;
    @group(1) @binding(1) var resultReadTexture: texture_2d<f32>;

    fn gaussian1D(x: f32, sigma: f32) -> f32 {
      let sigma2 = sigma * sigma;
      return exp(-(x * x) / (2.0 * sigma2)) / (sqrt(2.0 * 3.14159265359) * sigma);
    }

    @compute @workgroup_size(16, 16)
    fn computeDownsample(@builtin(global_invocation_id) id: vec3u) {
      let dims = vec2f(textureDimensions(inputTexture));
      let smallDims = vec2f(textureDimensions(tempTexture));

      let texCoord = vec2f(id.xy) / smallDims;
      let srcCoord = texCoord;
      let color = textureSampleLevel(inputTexture, textureSampler, srcCoord, 0.0);

      textureStore(tempTexture, id.xy, color);
    }

    @compute @workgroup_size(16, 16)
    fn computeHorizontalBlur(@builtin(global_invocation_id) id: vec3u) {
      let dims = vec2f(textureDimensions(tempTexture));
      let texCoord = vec2f(id.xy) / dims;

      let sigma = max(1.0, params.strength / 3.0);
      let kernelSize = i32(min(select(16.0, 24.0, params.highQuality != 0u), ceil(params.strength)));

      var totalWeight = 0.0;
      var totalColor = vec3f(0.0);
      var totalAlpha = 0.0;

      for (var x = -kernelSize; x <= kernelSize; x++) {
        let weight = gaussian1D(f32(x), sigma);
        let sampleCoord = vec2f(texCoord.x + f32(x) / dims.x, texCoord.y);

        if (sampleCoord.x >= 0.0 && sampleCoord.x <= 1.0) {
          let sampleColor = textureSampleLevel(tempReadTexture, textureSampler, sampleCoord, 0.0);

          if (sampleColor.a > 0.001) {
            let unpremultipliedColor = sampleColor.rgb / sampleColor.a;
            totalColor += unpremultipliedColor * weight * sampleColor.a;
            totalAlpha += sampleColor.a * weight;
          }
          totalWeight += weight;
        }
      }

      var blurredColor = vec4f(0.0);
      if (totalWeight > 0.0 && totalAlpha > 0.001) {
        let normalizedColor = totalColor / totalAlpha;
        blurredColor = vec4f(normalizedColor, totalAlpha / totalWeight);
      }

      textureStore(resultTexture, id.xy, blurredColor);
    }

    @compute @workgroup_size(16, 16)
    fn computeVerticalBlur(@builtin(global_invocation_id) id: vec3u) {
      let dims = vec2f(textureDimensions(resultTexture));
      let texCoord = vec2f(id.xy) / dims;

      let sigma = max(1.0, params.strength / 3.0);
      let kernelSize = i32(min(select(16.0, 24.0, params.highQuality != 0u), ceil(params.strength)));

      var totalWeight = 0.0;
      var totalColor = vec3f(0.0);
      var totalAlpha = 0.0;

      for (var y = -kernelSize; y <= kernelSize; y++) {
        let weight = gaussian1D(f32(y), sigma);
        let sampleCoord = vec2f(texCoord.x, texCoord.y + f32(y) / dims.y);

        if (sampleCoord.y >= 0.0 && sampleCoord.y <= 1.0) {
          let sampleColor = textureSampleLevel(resultReadTexture, textureSampler, sampleCoord, 0.0);

          if (sampleColor.a > 0.001) {
            let unpremultipliedColor = sampleColor.rgb / sampleColor.a;
            totalColor += unpremultipliedColor * weight * sampleColor.a;
            totalAlpha += sampleColor.a * weight;
          }
          totalWeight += weight;
        }
      }

      var blurredColor = vec4f(0.0);
      if (totalWeight > 0.0 && totalAlpha > 0.001) {
        let normalizedColor = totalColor / totalAlpha;
        blurredColor = vec4f(normalizedColor, totalAlpha / totalWeight);
      }

      textureStore(tempTexture, id.xy, blurredColor);
    }

    @compute @workgroup_size(16, 16)
    fn computeFinalComposite(@builtin(global_invocation_id) id: vec3u) {
      let dims = vec2f(textureDimensions(resultTexture));
      let smallDims = vec2f(textureDimensions(tempTexture));
      let texCoord = vec2f(id.xy) / dims;

      let smallCoord = texCoord;
      let blurredColor = textureSampleLevel(tempReadTexture, textureSampler, smallCoord, 0.0);
      let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

      var finalColor = vec4f(0.0);

      if (params.transparentOriginal != 0u) {
        finalColor = blurredColor;

        if (originalColor.a > 0.0) {
          finalColor.a = finalColor.a * (1.0 - originalColor.a);
        }
      } else {
        finalColor = blurredColor;

        if (originalColor.a > 0.0) {
          finalColor = vec4f(
            mix(finalColor.rgb, originalColor.rgb, originalColor.a),
            max(finalColor.a, originalColor.a)
          );
        }
      }

      textureStore(resultTexture, id.xy, finalColor);
    }
  `;
}
