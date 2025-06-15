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
} from "./_utils.ts";
import { createGPUDevice, includeOklabMix } from "./_shared.ts";

const t = createTranslator({
  en: {
    title: "Outline V1",
    thickness: "Thickness",
    color: "Color",
    opacity: "Opacity",
  },
  ja: {
    title: "縁取り V1",
    thickness: "太さ",
    color: "色",
    opacity: "不透明度",
  },
});

export const outline = definePlugin({
  id: "outline-effect-morphology-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Stylize",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      thickness: {
        type: "real",
        default: 5.0,
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 0, a: 1 },
      },
      opacity: {
        type: "int",
        default: 100,
      },
    },
    onEditParameters: (params) => {
      params.thickness = Math.max(0, params.thickness);
      params.opacity = Math.max(0, Math.min(100, params.opacity));
      return params;
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
        thickness: params.thickness * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        thickness: lerp(paramsA.thickness, paramsB.thickness, t),
        color: {
          r: lerp(paramsA.color.r, paramsB.color.r, t),
          g: lerp(paramsA.color.g, paramsB.color.g, t),
          b: lerp(paramsA.color.b, paramsB.color.b, t),
          a: lerp(paramsA.color.a, paramsB.color.a, t),
        },
        opacity: Math.round(lerp(paramsA.opacity, paramsB.opacity, t)),
      };
    },

    renderUI: (params, { setParam, useStateObject }) => {
      const colorStr = toColorCode(params.color);

      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("thickness") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "thickness",
              dataType: "float",
              min: 0,
              max: 50,
              value: params.thickness,
            }),
            ui.numberInput({
              key: "thickness",
              dataType: "float",
              value: params.thickness,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("color") }),
          ui.group({ direction: "row" }, [
            ui.colorInput({ key: "color", value: params.color }),
            ui.textInput({
              key: "colorText",
              value: colorStr,
              onChange: (e) => {
                setParam({ color: parseColorCode(e.value) });
              },
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("opacity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "opacity",
              dataType: "int",
              min: 0,
              max: 100,
              value: params.opacity,
            }),
            ui.numberInput({
              key: "opacity",
              dataType: "int",
              value: params.opacity,
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Outline V1)" },
        },
        (device) => {
          const blurCode = `
            struct BlurParams {
              outputSize: vec2i,
              dpiScale: f32,
              thickness: f32,
              direction: u32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: BlurParams;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;
              let toScaledNomalizedAmountByPixels = 1.0 / (dims * params.dpiScale);

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let radius = params.thickness * params.dpiScale;
              let sigma = radius / 3.0;
              let kernelSize = i32(ceil(radius * 2.0)) | 1;
              let halfKernel = kernelSize / 2;

              var color = vec4f(0.0);
              var weightSum = 0.0;

              for (var i = -halfKernel; i <= halfKernel; i++) {
                let offset = select(
                  vec2f(0.0, f32(i) * toScaledNomalizedAmountByPixels.y),
                  vec2f(f32(i) * toScaledNomalizedAmountByPixels.x, 0.0),
                  params.direction == 0u
                );
                let sampleCoord = texCoord + offset;

                let isValid = select(
                  sampleCoord.y >= 0.0 && sampleCoord.y <= 1.0,
                  sampleCoord.x >= 0.0 && sampleCoord.x <= 1.0,
                  params.direction == 0u
                );

                if (isValid) {
                  let weight = exp(-0.5 * f32(i * i) / (sigma * sigma));
                  let sampleColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord * toInputTexCoord, 0.0);
                  color += sampleColor * weight;
                  weightSum += weight;
                }
              }

              if (weightSum > 0.0) {
                color /= weightSum;
              }

              textureStore(resultTexture, id.xy, color);
            }
          `;

          // Composite shader code with tri-level alpha processing
          const compositeCode = `
            struct CompositeParams {
              outputSize: vec2i,
              dpiScale: f32,
              thickness: f32,
              color: vec4f,
              opacity: f32,
            }

            @group(0) @binding(0) var originalTexture: texture_2d<f32>;
            @group(0) @binding(1) var blurredTexture: texture_2d<f32>;
            @group(0) @binding(2) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(3) var textureSampler: sampler;
            @group(0) @binding(4) var<uniform> params: CompositeParams;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(originalTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(originalTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              let blurredAlpha = textureSampleLevel(blurredTexture, textureSampler, texCoord * toInputTexCoord, 0.0).a;

              // Binary alpha processing: 0.0, 1.0
              var outlineAlpha: f32;
              if (blurredAlpha < 0.01) {
                outlineAlpha = 0.0;
              } else {
                outlineAlpha = 1.0;
              }

              let outlineColor = vec4f(params.color.rgb, outlineAlpha * params.opacity);

              // Alpha compositing: outline under original
              let finalAlpha = originalColor.a + outlineColor.a * (1.0 - originalColor.a);
              var finalColor: vec4f;

              if (finalAlpha > 0.0) {
                finalColor = vec4(
                  vec3(
                    (originalColor.rgb * originalColor.a +
                      outlineColor.rgb * outlineColor.a * (1.0 - originalColor.a)) / finalAlpha
                  ),
                  finalAlpha
                );
              } else {
                finalColor = vec4f(0.0);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }

            ${includeOklabMix()}
          `;

          const blurShader = device.createShaderModule({
            label: "Outline Blur Shader",
            code: blurCode,
          });

          const compositeShader = device.createShaderModule({
            label: "Outline Composite Shader",
            code: compositeCode,
          });

          const blurPipelineDef = makeShaderDataDefinitions(blurCode);
          const compositePipelineDef = makeShaderDataDefinitions(compositeCode);

          const blurPipeline = device.createComputePipeline({
            label: "Outline Blur Pipeline",
            layout: "auto",
            compute: {
              module: blurShader,
              entryPoint: "computeMain",
            },
          });

          const compositePipeline = device.createComputePipeline({
            label: "Outline Composite Pipeline",
            layout: "auto",
            compute: {
              module: compositeShader,
              entryPoint: "computeMain",
            },
          });

          return {
            device,
            blurPipeline,
            compositePipeline,
            blurPipelineDef,
            compositePipelineDef,
          };
        }
      );
    },
    goLiveEffect: async (
      {
        device,
        blurPipeline,
        compositePipeline,
        blurPipelineDef,
        compositePipelineDef,
      },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Outline V1", params);

      const paddingSize = Math.ceil(params.thickness * (dpi / baseDpi));
      imgData = await paddingImageData(imgData, paddingSize);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const originalTexture = device.createTexture({
        label: "Outline Original Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const tempTexture1 = device.createTexture({
        label: "Outline Temp Texture 1",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      const tempTexture2 = device.createTexture({
        label: "Outline Temp Texture 2",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Outline Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Outline Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // Create uniform buffers
      const horizontalBlurUniformValues = makeStructuredView(
        blurPipelineDef.uniforms.params
      );
      const horizontalBlurUniformBuffer = device.createBuffer({
        label: "Outline Horizontal Blur Params Buffer",
        size: horizontalBlurUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const verticalBlurUniformValues = makeStructuredView(
        blurPipelineDef.uniforms.params
      );
      const verticalBlurUniformBuffer = device.createBuffer({
        label: "Outline Vertical Blur Params Buffer",
        size: verticalBlurUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const compositeUniformValues = makeStructuredView(
        compositePipelineDef.uniforms.params
      );
      const compositeUniformBuffer = device.createBuffer({
        label: "Outline Composite Params Buffer",
        size: compositeUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Set uniform values
      const baseBlurParams = {
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        thickness: params.thickness * (dpi / baseDpi),
      };

      horizontalBlurUniformValues.set({ ...baseBlurParams, direction: 0 });
      verticalBlurUniformValues.set({ ...baseBlurParams, direction: 1 });
      device.queue.writeBuffer(
        horizontalBlurUniformBuffer,
        0,
        horizontalBlurUniformValues.arrayBuffer
      );
      device.queue.writeBuffer(
        verticalBlurUniformBuffer,
        0,
        verticalBlurUniformValues.arrayBuffer
      );

      compositeUniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        thickness: params.thickness,
        color: [params.color.r, params.color.g, params.color.b, params.color.a],
        opacity: params.opacity / 100.0,
      });
      device.queue.writeBuffer(
        compositeUniformBuffer,
        0,
        compositeUniformValues.arrayBuffer
      );

      // Create bind groups
      const horizontalBlurBindGroup = device.createBindGroup({
        label: "Outline Horizontal Blur Bind Group",
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: originalTexture.createView() },
          { binding: 1, resource: tempTexture1.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: horizontalBlurUniformBuffer } },
        ],
      });

      const verticalBlurBindGroup = device.createBindGroup({
        label: "Outline Vertical Blur Bind Group",
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: tempTexture1.createView() },
          { binding: 1, resource: tempTexture2.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: verticalBlurUniformBuffer } },
        ],
      });

      const compositeBindGroup = device.createBindGroup({
        label: "Outline Composite Bind Group",
        layout: compositePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: originalTexture.createView() },
          { binding: 1, resource: tempTexture2.createView() },
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

      // Execute compute shaders: horizontal blur → vertical blur → composite
      const commandEncoder = device.createCommandEncoder({
        label: "Outline Command Encoder",
      });

      // Pass 1: Horizontal blur (direction = 0)
      const horizontalBlurPass = commandEncoder.beginComputePass({
        label: "Outline Horizontal Blur Pass",
      });
      horizontalBlurPass.setPipeline(blurPipeline);
      horizontalBlurPass.setBindGroup(0, horizontalBlurBindGroup);
      horizontalBlurPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      horizontalBlurPass.end();

      // Pass 2: Vertical blur (direction = 1)
      const verticalBlurPass = commandEncoder.beginComputePass({
        label: "Outline Vertical Blur Pass",
      });
      verticalBlurPass.setPipeline(blurPipeline);
      verticalBlurPass.setBindGroup(0, verticalBlurBindGroup);
      verticalBlurPass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      verticalBlurPass.end();

      // Pass 3: Composite
      const compositePass = commandEncoder.beginComputePass({
        label: "Outline Composite Pass",
      });
      compositePass.setPipeline(compositePipeline);
      compositePass.setBindGroup(0, compositeBindGroup);
      compositePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      compositePass.end();

      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );

      device.queue.submit([commandEncoder.finish()]);

      // Read back and display the result
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
