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
    title: "Gaussian Blur",
    radius: "Blur Radius (px)",
    sigma: "Strength",
  },
  ja: {
    title: "ガウスブラー",
    radius: "ぼかし半径 (px)",
    sigma: "強度",
  },
});

export const gaussianBlur = definePlugin({
  id: "gaussian-blur-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Blur",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      radius: {
        type: "real",
        default: 10,
      },
      sigma: {
        type: "real",
        default: 0.33,
      },
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        radius: lerp(paramsA.radius, paramsB.radius, t),
        sigma: lerp(paramsA.sigma, paramsB.sigma, t),
      };
    },
    renderUI: (params, { setParam }) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("radius") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "radius", dataType: 'float', min: 1, max: 200, value: params.radius }),
            ui.numberInput({ key: "radius", dataType: 'float', value: params.radius }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("sigma") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "sigma", dataType: 'float', min: 0, max: 1, value: params.sigma }),
            ui.numberInput({ key: "sigma", dataType: 'float', value: params.sigma }),
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
          const blurShaderCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              radius: f32,
              sigma: f32,
              direction: i32, // 0: vertical, 1: horizontal
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
              let toScaledNomalizedAmountByPixels = 1.0 / (dims * params.dpiScale);

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let inputColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let radiusScaled = f32(params.radius) * params.dpiScale;
              let sigma = radiusScaled * params.sigma;

              // Return original color if no blur is applied
              if (sigma <= 0.0) {
                textureStore(resultTexture, id.xy, inputColor);
                return;
              }

              let centerWeight = gaussianWeight(0.0, sigma);
              var totalWeightAlpha = centerWeight;
              var resultAlpha = inputColor.a * centerWeight;

              var totalWeightColor = centerWeight;
              var resultRGB = inputColor.rgb * centerWeight;

              var weightedColorSum = vec3f(0.0);
              var weightedColorWeight = 0.0;

              if (inputColor.a > 0.0) {
                weightedColorSum = inputColor.rgb * inputColor.a * centerWeight;
                weightedColorWeight = inputColor.a * centerWeight;
              }

              var pixelStep: f32;
              if (params.direction == 0) {
                pixelStep = 1.0 / dims.y;
              } else {
                pixelStep = 1.0 / dims.x;
              }

              for (var i = 0.1; i <= radiusScaled; i = i + 0.1) {
                let offset = f32(i);
                let weight = gaussianWeight(offset, sigma);

                var offsetPos: vec2f;
                var offsetNeg: vec2f;

                if (params.direction == 0) { // vertical
                  offsetPos = vec2f(0.0, pixelStep * offset);
                  offsetNeg = vec2f(0.0, -pixelStep * offset);
                } else { // horizontal
                  offsetPos = vec2f(pixelStep * offset, 0.0);
                  offsetNeg = vec2f(-pixelStep * offset, 0.0);
                }

                let posCoord = texCoord * toInputTexCoord + offsetPos;
                let negCoord = texCoord * toInputTexCoord + offsetNeg;

                let samplePos = textureSampleLevel(inputTexture, textureSampler, posCoord, 0.0);
                let sampleNeg = textureSampleLevel(inputTexture, textureSampler, negCoord, 0.0);

                resultAlpha += (samplePos.a + sampleNeg.a) * weight;
                totalWeightAlpha += weight * 2.0;

                resultRGB += (samplePos.rgb + sampleNeg.rgb) * weight;
                totalWeightColor += weight * 2.0;

                if (samplePos.a > 0.0) {
                  weightedColorSum += samplePos.rgb * samplePos.a * weight;
                  weightedColorWeight += samplePos.a * weight;
                }

                if (sampleNeg.a > 0.0) {
                  weightedColorSum += sampleNeg.rgb * sampleNeg.a * weight;
                  weightedColorWeight += sampleNeg.a * weight;
                }
              }

              resultAlpha = resultAlpha / totalWeightAlpha;

              var finalRGB: vec3f;

              if (weightedColorWeight > 0.0) {
                finalRGB = weightedColorSum / weightedColorWeight;
              } else {
                finalRGB = resultRGB / totalWeightColor;
              }

              let finalColor = vec4f(finalRGB, resultAlpha);
              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const blurShader = device.createShaderModule({
            label: "Gaussian Blur Shader",
            code: blurShaderCode,
          });

          const blurPipelineDef = makeShaderDataDefinitions(blurShaderCode);

          const blurPipeline = device.createComputePipeline({
            label: "Gaussian Blur Pipeline",
            layout: "auto",
            compute: {
              module: blurShader,
              entryPoint: "computeMain",
            },
          });

          return {
            device,
            blurPipeline,
            blurPipelineDef,
          };
        }
      );
    },
    goLiveEffect: async (
      { device, blurPipeline, blurPipelineDef },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Gaussian Blur V1", params);

      const dpiRatio = dpi / baseDpi;
      const paddingSize = Math.ceil(params.radius);
      imgData = await paddingImageData(imgData, paddingSize * dpiRatio);

      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      const inputTexture = device.createTexture({
        label: "Gaussian Blur Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const intermediateTexture = device.createTexture({
        label: "Gaussian Blur Intermediate Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Gaussian Blur Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Gaussian Blur Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      const verticalUniformValues = makeStructuredView(
        blurPipelineDef.uniforms.params
      );
      const verticalUniformBuffer = device.createBuffer({
        label: "Gaussian Blur Vertical Params Buffer",
        size: verticalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const horizontalUniformValues = makeStructuredView(
        blurPipelineDef.uniforms.params
      );
      const horizontalUniformBuffer = device.createBuffer({
        label: "Gaussian Blur Horizontal Params Buffer",
        size: horizontalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      verticalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        sigma: params.sigma,
        direction: 0, // vertical
      });

      horizontalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: params.radius,
        sigma: params.sigma,
        direction: 1, // horizontal
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

      const verticalBindGroup = device.createBindGroup({
        label: "Gaussian Blur Vertical Bind Group",
        layout: blurPipeline.getBindGroupLayout(0),
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

      const horizontalBindGroup = device.createBindGroup({
        label: "Gaussian Blur Horizontal Bind Group",
        layout: blurPipeline.getBindGroupLayout(0),
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

      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      const commandEncoder = device.createCommandEncoder({
        label: "Gaussian Blur Command Encoder",
      });

      const verticalPass = commandEncoder.beginComputePass({
        label: "Gaussian Blur Vertical Pass",
      });
      verticalPass.setPipeline(blurPipeline);
      verticalPass.setBindGroup(0, verticalBindGroup);
      verticalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      verticalPass.end();

      const horizontalPass = commandEncoder.beginComputePass({
        label: "Gaussian Blur Horizontal Pass",
      });
      horizontalPass.setPipeline(blurPipeline);
      horizontalPass.setBindGroup(0, horizontalBindGroup);
      horizontalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      horizontalPass.end();

      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );

      device.queue.submit([commandEncoder.finish()]);

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
