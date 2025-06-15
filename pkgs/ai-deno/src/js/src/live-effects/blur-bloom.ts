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
  parseColorCode,
  toColorCode,
  createCanvas,
} from "./_utils.ts";
import { createGPUDevice, includeOklabMix } from "./_shared.ts";

const t = createTranslator({
  en: {
    title: "Bloom Filter V1",
    threshold: "Threshold",
    intensity: "Intensity",
    radius: "Radius",
    blurStrength: "Blur Strength",
    blendMode: "Blend Mode",
    normal: "Normal",
    overlay: "Overlay",
  },
  ja: {
    title: "ブルームフィルター V1",
    threshold: "しきい値",
    intensity: "強度",
    radius: "半径",
    blurStrength: "ぼかし強度",
    blendMode: "合成モード",
    normal: "通常",
    overlay: "オーバーレイ",
  },
});

export const bloom = definePlugin({
  id: "bloom-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Blur",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      threshold: {
        type: "real",
        default: 0.8,
      },
      intensity: {
        type: "real",
        default: 1.0,
      },
      radius: {
        type: "real",
        default: 10.0,
      },
      blurStrength: {
        type: "real",
        default: 1.0,
      },
      blendMode: {
        type: "string",
        enum: ["normal", "overlay"],
        default: "normal",
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        threshold: Math.max(0.0, Math.min(1.0, params.threshold)),
        intensity: Math.max(0.0, Math.min(5.0, params.intensity)),
        radius: Math.max(1.0, Math.min(100.0, params.radius)),
        blurStrength: Math.max(0.1, Math.min(5.0, params.blurStrength)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        radius: params.radius * scaleFactor,
        blurStrength: params.blurStrength,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        threshold: lerp(paramsA.threshold, paramsB.threshold, t),
        intensity: lerp(paramsA.intensity, paramsB.intensity, t),
        radius: lerp(paramsA.radius, paramsB.radius, t),
        blurStrength: lerp(paramsA.blurStrength, paramsB.blurStrength, t),
        blendMode: t < 0.5 ? paramsA.blendMode : paramsB.blendMode,
      };
    },

    renderUI: (params, { setParam, useStateObject }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("threshold") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "threshold",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.threshold,
            }),
            ui.numberInput({
              key: "threshold",
              dataType: "float",
              value: params.threshold,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "intensity",
              dataType: "float",
              min: 0,
              max: 5,
              value: params.intensity,
            }),
            ui.numberInput({
              key: "intensity",
              dataType: "float",
              value: params.intensity,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("radius") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "radius",
              dataType: "float",
              min: 1,
              max: 100,
              value: params.radius,
            }),
            ui.numberInput({
              key: "radius",
              dataType: "float",
              value: params.radius,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blurStrength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "blurStrength",
              dataType: "float",
              min: 0.1,
              max: 5,
              value: params.blurStrength,
            }),
            ui.numberInput({
              key: "blurStrength",
              dataType: "float",
              value: params.blurStrength,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blendMode") }),
          ui.select({
            key: "blendMode",
            value: params.blendMode,
            options: [
              { label: t("normal"), value: "normal" },
              { label: t("overlay"), value: "overlay" },
            ],
          }),
        ]),
      ]);
    },

    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Bloom Filter V1)" },
        },
        (device) => {
          const extractCode = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              threshold: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var extractTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            @compute @workgroup_size(8, 8)
            fn extractBright(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              let brightness = dot(originalColor.rgb, vec3f(0.299, 0.587, 0.114));

              var extractedColor = vec4f(0.0, 0.0, 0.0, 0.0);
              if (brightness > params.threshold && originalColor.a > 0.0) {
                let factor = (brightness - params.threshold) / (1.0 - params.threshold);
                extractedColor = vec4f(originalColor.rgb * factor, originalColor.a);
              }

              textureStore(extractTexture, id.xy, extractedColor);
            }
          `;

          const blurCode = `
            struct BlurParams {
              outputSize: vec2i,
              dpiScale: f32,
              radius: f32,
              blurStrength: f32,
              direction: vec2f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: BlurParams;

            fn gaussianWeight(offset: f32, sigma: f32) -> f32 {
              let gaussianExp = -0.5 * (offset * offset) / (sigma * sigma);
              return exp(gaussianExp) / (2.5066282746 * sigma);
            }

            @compute @workgroup_size(8, 8)
            fn gaussianBlur(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let sigma = params.radius * params.blurStrength / 3.0;
              let kernelRadius = i32(params.radius);

              if (sigma <= 0.0) {
                let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
                textureStore(outputTexture, id.xy, originalColor);
                return;
              }

              var sum = vec4f(0.0);
              var weightSum = 0.0;

              let centerWeight = gaussianWeight(0.0, sigma);
              let centerColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              sum += centerColor * centerWeight;
              weightSum += centerWeight;

              for (var i = 1; i <= kernelRadius; i++) {
                let offset = f32(i);
                let weight = gaussianWeight(offset, sigma);

                var offsetPos: vec2f;
                var offsetNeg: vec2f;

                if (params.direction.y > 0.5) {
                  let pixelStep = 1.0 / dims.y;
                  offsetPos = vec2f(0.0, pixelStep * offset) * toInputTexCoord;
                  offsetNeg = vec2f(0.0, -pixelStep * offset) * toInputTexCoord;
                } else {
                  let pixelStep = 1.0 / dims.x;
                  offsetPos = vec2f(pixelStep * offset, 0.0) * toInputTexCoord;
                  offsetNeg = vec2f(-pixelStep * offset, 0.0) * toInputTexCoord;
                }

                let posCoord = texCoord * toInputTexCoord + offsetPos;
                let negCoord = texCoord * toInputTexCoord + offsetNeg;

                let samplePos = textureSampleLevel(inputTexture, textureSampler, posCoord, 0.0);
                let sampleNeg = textureSampleLevel(inputTexture, textureSampler, negCoord, 0.0);

                sum += (samplePos + sampleNeg) * weight;
                weightSum += weight * 2.0;
              }

              textureStore(outputTexture, id.xy, sum / weightSum);
            }
          `;

          const compositeCode = `
            struct CompositeParams {
              outputSize: vec2i,
              dpiScale: f32,
              intensity: f32,
              blendMode: i32,
            }

            @group(0) @binding(0) var originalTexture: texture_2d<f32>;
            @group(0) @binding(1) var bloomTexture: texture_2d<f32>;
            @group(0) @binding(2) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(3) var textureSampler: sampler;
            @group(0) @binding(4) var<uniform> params: CompositeParams;

            fn overlayBlend(base: vec3f, overlay: vec3f) -> vec3f {
              var result: vec3f;
              for (var i = 0; i < 3; i++) {
                if (base[i] < 0.5) {
                  result[i] = 2.0 * base[i] * overlay[i];
                } else {
                  result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - overlay[i]);
                }
              }
              return result;
            }

            @compute @workgroup_size(8, 8)
            fn composite(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(originalTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(originalTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              let bloomColor = textureSampleLevel(bloomTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let scaledBloom = bloomColor.rgb * params.intensity;

              var finalColor: vec4f;
              if (params.blendMode == 0) {
                finalColor = vec4f(originalColor.rgb + scaledBloom, originalColor.a);
              } else {
                finalColor = vec4f(overlayBlend(originalColor.rgb, scaledBloom), originalColor.a);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const extractShader = device.createShaderModule({
            label: "Bloom Extract Shader",
            code: extractCode,
          });

          const blurShader = device.createShaderModule({
            label: "Bloom Blur Shader",
            code: blurCode,
          });

          const compositeShader = device.createShaderModule({
            label: "Bloom Composite Shader",
            code: compositeCode,
          });

          const extractPipelineDef = makeShaderDataDefinitions(extractCode);
          const blurPipelineDef = makeShaderDataDefinitions(blurCode);
          const compositePipelineDef = makeShaderDataDefinitions(compositeCode);

          const extractPipeline = device.createComputePipeline({
            label: "Bloom Extract Pipeline",
            layout: "auto",
            compute: {
              module: extractShader,
              entryPoint: "extractBright",
            },
          });

          const blurPipeline = device.createComputePipeline({
            label: "Bloom Blur Pipeline",
            layout: "auto",
            compute: {
              module: blurShader,
              entryPoint: "gaussianBlur",
            },
          });

          const compositePipeline = device.createComputePipeline({
            label: "Bloom Composite Pipeline",
            layout: "auto",
            compute: {
              module: compositeShader,
              entryPoint: "composite",
            },
          });

          return {
            device,
            extractPipeline,
            blurPipeline,
            compositePipeline,
            extractPipelineDef,
            blurPipelineDef,
            compositePipelineDef,
          };
        }
      );
    },

    goLiveEffect: async (
      {
        device,
        extractPipeline,
        blurPipeline,
        compositePipeline,
        extractPipelineDef,
        blurPipelineDef,
        compositePipelineDef,
      },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Bloom Filter V1", params);

      const radiusInPixels = Math.ceil(params.radius * (dpi / baseDpi));
      imgData = await paddingImageData(imgData, radiusInPixels);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const originalTexture = device.createTexture({
        label: "Bloom Original Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      const extractTexture = device.createTexture({
        label: "Bloom Extract Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      });

      const blurTexture1 = device.createTexture({
        label: "Bloom Blur Texture 1",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      });

      const blurTexture2 = device.createTexture({
        label: "Bloom Blur Texture 2",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Bloom Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Bloom Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      // Create uniform buffers
      const extractUniformValues = makeStructuredView(
        extractPipelineDef.uniforms.params
      );
      const extractUniformBuffer = device.createBuffer({
        label: "Bloom Extract Params Buffer",
        size: extractUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const blurHorizontalUniformValues = makeStructuredView(
        blurPipelineDef.uniforms.params
      );
      const blurHorizontalUniformBuffer = device.createBuffer({
        label: "Bloom Blur Horizontal Params Buffer",
        size: blurHorizontalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const blurVerticalUniformValues = makeStructuredView(
        blurPipelineDef.uniforms.params
      );
      const blurVerticalUniformBuffer = device.createBuffer({
        label: "Bloom Blur Vertical Params Buffer",
        size: blurVerticalUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const compositeUniformValues = makeStructuredView(
        compositePipelineDef.uniforms.params
      );
      const compositeUniformBuffer = device.createBuffer({
        label: "Bloom Composite Params Buffer",
        size: compositeUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Set uniform values
      extractUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        threshold: params.threshold,
      });

      blurHorizontalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: radiusInPixels,
        blurStrength: params.blurStrength,
        direction: [1.0, 0.0],
      });

      blurVerticalUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        radius: radiusInPixels,
        blurStrength: params.blurStrength,
        direction: [0.0, 1.0],
      });

      compositeUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        intensity: params.intensity,
        blendMode: params.blendMode === "overlay" ? 1 : 0,
      });

      device.queue.writeBuffer(
        extractUniformBuffer,
        0,
        extractUniformValues.arrayBuffer
      );
      device.queue.writeBuffer(
        blurHorizontalUniformBuffer,
        0,
        blurHorizontalUniformValues.arrayBuffer
      );
      device.queue.writeBuffer(
        blurVerticalUniformBuffer,
        0,
        blurVerticalUniformValues.arrayBuffer
      );
      device.queue.writeBuffer(
        compositeUniformBuffer,
        0,
        compositeUniformValues.arrayBuffer
      );

      // Create bind groups
      const extractBindGroup = device.createBindGroup({
        label: "Bloom Extract Bind Group",
        layout: extractPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: originalTexture.createView() },
          { binding: 1, resource: extractTexture.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: extractUniformBuffer } },
        ],
      });

      const blurHorizontalBindGroup = device.createBindGroup({
        label: "Bloom Blur Horizontal Bind Group",
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: extractTexture.createView() },
          { binding: 1, resource: blurTexture1.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: blurHorizontalUniformBuffer } },
        ],
      });

      const blurVerticalBindGroup = device.createBindGroup({
        label: "Bloom Blur Vertical Bind Group",
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: blurTexture1.createView() },
          { binding: 1, resource: blurTexture2.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: blurVerticalUniformBuffer } },
        ],
      });

      const compositeBindGroup = device.createBindGroup({
        label: "Bloom Composite Bind Group",
        layout: compositePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: originalTexture.createView() },
          { binding: 1, resource: blurTexture2.createView() },
          { binding: 2, resource: resultTexture.createView() },
          { binding: 3, resource: sampler },
          { binding: 4, resource: { buffer: compositeUniformBuffer } },
        ],
      });

      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Update source texture
      device.queue.writeTexture(
        { texture: originalTexture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      // Execute compute passes
      const commandEncoder = device.createCommandEncoder({
        label: "Bloom Command Encoder",
      });

      // Extract bright areas
      const extractPass = commandEncoder.beginComputePass({
        label: "Bloom Extract Pass",
      });
      extractPass.setPipeline(extractPipeline);
      extractPass.setBindGroup(0, extractBindGroup);
      extractPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 8),
        Math.ceil(bufferInputHeight / 8)
      );
      extractPass.end();

      // Horizontal blur
      const blurHorizontalPass = commandEncoder.beginComputePass({
        label: "Bloom Blur Horizontal Pass",
      });
      blurHorizontalPass.setPipeline(blurPipeline);
      blurHorizontalPass.setBindGroup(0, blurHorizontalBindGroup);
      blurHorizontalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 8),
        Math.ceil(bufferInputHeight / 8)
      );
      blurHorizontalPass.end();

      // Vertical blur
      const blurVerticalPass = commandEncoder.beginComputePass({
        label: "Bloom Blur Vertical Pass",
      });
      blurVerticalPass.setPipeline(blurPipeline);
      blurVerticalPass.setBindGroup(0, blurVerticalBindGroup);
      blurVerticalPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 8),
        Math.ceil(bufferInputHeight / 8)
      );
      blurVerticalPass.end();

      // Composite
      const compositePass = commandEncoder.beginComputePass({
        label: "Bloom Composite Pass",
      });
      compositePass.setPipeline(compositePipeline);
      compositePass.setBindGroup(0, compositeBindGroup);
      compositePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 8),
        Math.ceil(bufferInputHeight / 8)
      );
      compositePass.end();

      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );

      device.queue.submit([commandEncoder.finish()]);

      // Read back result
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
