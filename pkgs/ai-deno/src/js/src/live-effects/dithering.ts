import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";
import { createTranslator } from "../ui/locale.ts";

const t = createTranslator({
  en: {
    title: "Dithering V1",
    patternType: "Pattern Type",
    bayer2x2: "2x2 Bayer",
    bayer4x4: "4x4 Bayer",
    bayer8x8: "8x8 Bayer",
    threshold: "Threshold",
    colorMode: "Color Mode",
    monochrome: "Monochrome",
    color: "Color",
    strength: "Strength",
    patternScale: "Pattern Scale",
  },
  ja: {
    title: "ディザリング V1",
    patternType: "パターンタイプ",
    bayer2x2: "2x2 Bayer",
    bayer4x4: "4x4 Bayer",
    bayer8x8: "8x8 Bayer",
    threshold: "しきい値",
    colorMode: "カラーモード",
    monochrome: "モノクロ",
    color: "カラー",
    strength: "強度",
    patternScale: "パターンスケール",
  },
});

export const dithering = definePlugin({
  id: "dithering-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      patternType: {
        type: "string",
        enum: ["bayer2x2", "bayer4x4", "bayer8x8"],
        default: "bayer4x4",
      },
      threshold: {
        type: "real",
        default: 50,
      },
      colorMode: {
        type: "string",
        enum: ["monochrome", "color"],
        default: "color",
      },
      strength: {
        type: "real",
        default: 100,
      },
      patternScale: {
        type: "real",
        default: 1.0,
      },
    },
    onEditParameters: (params) => {
      // Normalize parameters if needed
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      // Scale parameters - but we keep patternType and other params as is
      // to ensure consistent appearance across different scales
      return {
        threshold: params.threshold,
        strength: params.strength,
        patternType: params.patternType,
        colorMode: params.colorMode,
        patternScale: params.patternScale,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // Interpolate parameters
      return {
        threshold: lerp(paramsA.threshold, paramsB.threshold, t),
        strength: lerp(paramsA.strength, paramsB.strength, t),
        patternType: t < 0.5 ? paramsA.patternType : paramsB.patternType,
        colorMode: t < 0.5 ? paramsA.colorMode : paramsB.colorMode,
        patternScale: lerp(paramsA.patternScale, paramsB.patternScale, t),
      };
    },

    renderUI: (params) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "strength", dataType: 'float', min: 0, max: 100, value: params.strength }),
            ui.numberInput({ key: "strength", dataType: 'float', min: 0, max: 100, step: 0.1, value: params.strength }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({text: t("patternType")}),
          ui.select({ key: "patternType", value: params.patternType, options: [
            { value: 'bayer2x2', label: '2x2 Bayer' },
            { value: 'bayer4x4', label: '4x4 Bayer' },
            { value: 'bayer8x8', label: '8x8 Bayer' },
          ]}),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({text: t("patternScale")}),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "patternScale", dataType: 'float', min: 0.25, max: 4, value: params.patternScale }),
            ui.numberInput({ key: "patternScale", dataType: 'float', min: 0.25, max: 4, step: 0.05, value: params.patternScale }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({text: t("threshold")}),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "threshold", dataType: 'float', min: 0, max: 100, value: params.threshold }),
            ui.numberInput({ key: "threshold", dataType: 'float', min: 0, max: 100, step: 0.1, value: params.threshold }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({text: t("colorMode")}),
          ui.select({ key: "colorMode",  value: params.colorMode, options: [
            { value: 'monochrome', label: t('monochrome') },
            { value: 'color', label: t('color') },
          ]}),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: {
            label: "Device (Dithering)",
          },
        },
        (device) => {
          // ディザリングパターン用のデータを定義
          const ditherPatterns = {
            bayer2x2: {
              data: new Uint8Array([
                0, 0, 0, 255, 128, 128, 128, 255, 192, 192, 192, 255, 64, 64,
                64, 255,
              ]),
              width: 2,
              height: 2,
            },
            bayer4x4: {
              data: new Uint8Array([
                0, 0, 0, 255, 128, 128, 128, 255, 32, 32, 32, 255, 160, 160,
                160, 255, 192, 192, 192, 255, 64, 64, 64, 255, 224, 224, 224,
                255, 96, 96, 96, 255, 48, 48, 48, 255, 176, 176, 176, 255, 16,
                16, 16, 255, 144, 144, 144, 255, 240, 240, 240, 255, 112, 112,
                112, 255, 208, 208, 208, 255, 80, 80, 80, 255,
              ]),
              width: 4,
              height: 4,
            },
            bayer8x8: {
              data: new Uint8Array([
                0, 0, 0, 255, 128, 128, 128, 255, 32, 32, 32, 255, 160, 160,
                160, 255, 8, 8, 8, 255, 136, 136, 136, 255, 40, 40, 40, 255,
                168, 168, 168, 255, 192, 192, 192, 255, 64, 64, 64, 255, 224,
                224, 224, 255, 96, 96, 96, 255, 200, 200, 200, 255, 72, 72, 72,
                255, 232, 232, 232, 255, 104, 104, 104, 255, 48, 48, 48, 255,
                176, 176, 176, 255, 16, 16, 16, 255, 144, 144, 144, 255, 56, 56,
                56, 255, 184, 184, 184, 255, 24, 24, 24, 255, 152, 152, 152,
                255, 240, 240, 240, 255, 112, 112, 112, 255, 208, 208, 208, 255,
                80, 80, 80, 255, 248, 248, 248, 255, 120, 120, 120, 255, 216,
                216, 216, 255, 88, 88, 88, 255, 12, 12, 12, 255, 140, 140, 140,
                255, 44, 44, 44, 255, 172, 172, 172, 255, 4, 4, 4, 255, 132,
                132, 132, 255, 36, 36, 36, 255, 164, 164, 164, 255, 204, 204,
                204, 255, 76, 76, 76, 255, 236, 236, 236, 255, 108, 108, 108,
                255, 196, 196, 196, 255, 68, 68, 68, 255, 228, 228, 228, 255,
                100, 100, 100, 255, 60, 60, 60, 255, 188, 188, 188, 255, 28, 28,
                28, 255, 156, 156, 156, 255, 52, 52, 52, 255, 180, 180, 180,
                255, 20, 20, 20, 255, 148, 148, 148, 255, 252, 252, 252, 255,
                124, 124, 124, 255, 220, 220, 220, 255, 92, 92, 92, 255, 244,
                244, 244, 255, 116, 116, 116, 255, 212, 212, 212, 255, 84, 84,
                84, 255,
              ]),
              width: 8,
              height: 8,
            },
          };

          const code = `
            struct Params {
              outputSize: vec2f,
              dpiScale: f32,
              threshold: f32,
              strength: f32,
              patternType: u32,  // 0: bayer2x2, 1: bayer4x4, 2: bayer8x8
              colorMode: u32,    // 0: monochrome, 1: color
              patternScale: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var inputTextureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;
            @group(0) @binding(4) var ditherPatternTexture: texture_2d<f32>;
            @group(0) @binding(5) var patternTextureSampler: sampler;

            // Convert RGB to grayscale
            fn rgbToGrayscale(color: vec3f) -> f32 {
              return dot(color, vec3f(0.299, 0.587, 0.114));
            }

            // Apply Gaussian-like blur to the pixel at given coordinates
            // Handles straight (non-premultiplied) alpha correctly
            fn applyBlur(tex: texture_2d<f32>, samp: sampler, coords: vec2f, blurSize: f32, dims: vec2f) -> vec4f {
              // When blur amount is 0, just return the original color
              if (blurSize <= 0.0) {
                return textureSampleLevel(tex, samp, coords, 0.0);
              }

              let step = 1.0 / dims;
              let offset = step * blurSize;

              // 3x3 blur kernel with weighted samples
              let c00 = textureSampleLevel(tex, samp, coords + vec2f(-offset.x, -offset.y), 0.0);
              let c10 = textureSampleLevel(tex, samp, coords + vec2f(0.0, -offset.y), 0.0);
              let c20 = textureSampleLevel(tex, samp, coords + vec2f(offset.x, -offset.y), 0.0);

              let c01 = textureSampleLevel(tex, samp, coords + vec2f(-offset.x, 0.0), 0.0);
              let c11 = textureSampleLevel(tex, samp, coords, 0.0);
              let c21 = textureSampleLevel(tex, samp, coords + vec2f(offset.x, 0.0), 0.0);

              let c02 = textureSampleLevel(tex, samp, coords + vec2f(-offset.x, offset.y), 0.0);
              let c12 = textureSampleLevel(tex, samp, coords + vec2f(0.0, offset.y), 0.0);
              let c22 = textureSampleLevel(tex, samp, coords + vec2f(offset.x, offset.y), 0.0);

              // First handle alpha channel separately with weighted sum
              let alphaSum = c00.a * 0.0625 + c10.a * 0.125 + c20.a * 0.0625 +
                             c01.a * 0.125  + c11.a * 0.25  + c21.a * 0.125 +
                             c02.a * 0.0625 + c12.a * 0.125 + c22.a * 0.0625;

              // Premultiply alpha before summing
              let pc00 = vec4f(c00.rgb * c00.a, c00.a) * 0.0625;
              let pc10 = vec4f(c10.rgb * c10.a, c10.a) * 0.125;
              let pc20 = vec4f(c20.rgb * c20.a, c20.a) * 0.0625;

              let pc01 = vec4f(c01.rgb * c01.a, c01.a) * 0.125;
              let pc11 = vec4f(c11.rgb * c11.a, c11.a) * 0.25;
              let pc21 = vec4f(c21.rgb * c21.a, c21.a) * 0.125;

              let pc02 = vec4f(c02.rgb * c02.a, c02.a) * 0.0625;
              let pc12 = vec4f(c12.rgb * c12.a, c12.a) * 0.125;
              let pc22 = vec4f(c22.rgb * c22.a, c22.a) * 0.0625;

              // Sum the premultiplied values
              let premultResult = pc00 + pc10 + pc20 + pc01 + pc11 + pc21 + pc02 + pc12 + pc22;

              // Convert back to straight alpha (unpremultiply)
              var result = premultResult;
              if (alphaSum > 0.0) {
                result = vec4f(premultResult.rgb / alphaSum, alphaSum);
              }

              return result;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // Apply blur for anti-moiré if needed
              let originalColor = applyBlur(inputTexture, inputTextureSampler, texCoord * toInputTexCoord, params.blurAmount, dimsWithGPUPadding);

              let patternDims = vec2f(textureDimensions(ditherPatternTexture));
              // Apply pattern scale to coordinates
              let patternCoord = vec2f(id.xy) / (params.dpiScale * params.patternScale);

              let patternTexCoord = vec2f(patternCoord.x % patternDims.x, patternCoord.y % patternDims.y) / patternDims;
              let bayerValue = textureSampleLevel(ditherPatternTexture, patternTextureSampler, patternTexCoord, 0.0).r;

              // Apply threshold and create dithering effect
              var finalColor: vec4f;

              if (params.colorMode == 0u) {
                // Monochrome mode
                let gray = rgbToGrayscale(originalColor.rgb);
                let dithered = step(bayerValue, gray + (params.threshold - 0.5));
                finalColor = vec4f(vec3f(dithered), originalColor.a);
              } else {
                // Color mode
                let ditheredR = step(bayerValue, originalColor.r + (params.threshold - 0.5));
                let ditheredG = step(bayerValue, originalColor.g + (params.threshold - 0.5));
                let ditheredB = step(bayerValue, originalColor.b + (params.threshold - 0.5));
                finalColor = vec4f(ditheredR, ditheredG, ditheredB, originalColor.a);
              }

              // Blend with original based on strength
              finalColor = mix(originalColor, finalColor, params.strength);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Dithering Effect Shader",
            code,
          });

          const defs = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Dithering Effect Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain",
            },
          });

          return { device, pipeline, defs, ditherPatterns };
        }
      );
    },
    goLiveEffect: async (
      { device, pipeline, defs, ditherPatterns },
      params,
      imgData,
      { baseDpi, dpi }
    ) => {
      console.log("Dithering Effect V1", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Don't change it
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      // 選択されたディザリングパターンを取得
      const selectedPattern = ditherPatterns[params.patternType];

      // Create textures
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

      // ディザリングパターン用のテクスチャを作成
      const patternTexture = device.createTexture({
        label: "Dither Pattern Texture",
        size: [selectedPattern.width, selectedPattern.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      // 入力テクスチャ用のサンプラー（クランプモード）
      const inputTextureSampler = device.createSampler({
        label: "Input Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      // パターンテクスチャ用のサンプラー（リピートモード）
      const patternTextureSampler = device.createSampler({
        label: "Pattern Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "repeat",
        addressModeV: "repeat",
      });

      // Create uniform buffer with parameters
      // Update uniforms for dithering parameters
      const uniformData = makeStructuredView(defs.uniforms.params);

      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformData.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformData.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi, // DPIスケールを正しく設定
        threshold: params.threshold / 100,
        strength: params.strength / 100,
        patternType:
          // prettier-ignore
          params.patternType === "bayer2x2" ? 0
            : params.patternType === "bayer4x4" ? 1
            : params.patternType === "bayer8x8"? 2
            : 0,
        colorMode: params.colorMode === "monochrome" ? 0 : 1,
        blurAmount: params.blurAmount,
        patternScale: params.patternScale,
      });

      // パターンテクスチャを追加したbindGroupを作成
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
            resource: inputTextureSampler,
          },
          {
            binding: 3,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 4,
            resource: patternTexture.createView(),
          },
          {
            binding: 5,
            resource: patternTextureSampler,
          },
        ],
      });

      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformData.arrayBuffer);

      // パターンテクスチャにデータを書き込む
      device.queue.writeTexture(
        { texture: patternTexture },
        selectedPattern.data,
        { bytesPerRow: selectedPattern.width * 4 },
        [selectedPattern.width, selectedPattern.height]
      );

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Dithering Effect Compute Pass",
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

      // Read back and display the result
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
