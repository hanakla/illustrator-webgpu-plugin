import { logger } from "../logger.ts";
import { StyleFilterFlag } from "../plugin.ts";
import { definePlugin } from "../plugin.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";

const t = createTranslator({
  en: {
    title: "Inner Glow Effect V1",
    glowType: "Glow Type",
    glowTypeInner: "Inner",
    glowTypeOuter: "Outer",
    weight: "Size",
    glowColor: "Glow Color",
  },
  ja: {
    title: "光彩 V1",
    glowType: "方向",
    glowTypeInner: "内側",
    glowTypeOuter: "外側",
    weight: "大きさ",
    glowColor: "色",
  },
});

export const innerGlow = definePlugin({
  id: "inner-glow-effect-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Stylize",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      glowType: {
        type: "string",
        enum: ["inner", "outer"],
        default: "outer",
      },
      weight: {
        type: "real",
        default: 1.0,
      },
      glowColor: {
        type: "color",
        default: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    },
    onAdjustColors: (params) => {
      // TODO
      return params;
    },
    onEditParameters: (params) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        weight: params.weight * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        glowType: t < 0.5 ? paramsA.glowType : paramsB.glowType,
        weight: lerp(paramsA.weight, paramsB.weight, t),
        glowColor: {
          r: lerp(paramsA.glowColor.r, paramsB.glowColor.r, t),
          g: lerp(paramsA.glowColor.g, paramsB.glowColor.g, t),
          b: lerp(paramsA.glowColor.b, paramsB.glowColor.b, t),
          a: lerp(paramsA.glowColor.a, paramsB.glowColor.a, t),
        },
      };
    },

    renderUI: (params, { setParam }) => {
      const glowColorString = `#${Math.round(params.glowColor.r * 255)
        .toString(16)
        .padStart(2, "0")}${Math.round(params.glowColor.g * 255)
        .toString(16)
        .padStart(2, "0")}${Math.round(params.glowColor.b * 255)
        .toString(16)
        .padStart(2, "0")}`;

      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: "Glow Type" }),
          ui.select({
            key: "glowType",
            value: params.glowType,
            options: [
              { label: t('glowTypeInner'), value: 'inner'},
              { label: t('glowTypeOuter'), value: 'outer'},
            ]
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t('weight') }),

          ui.group({ direction: "row" }, [
            ui.slider({ key: "weight", dataType: 'float', min: 0, max: 10, value: params.weight }),
            ui.numberInput({ key: "weight", dataType: "float", value: params.weight, min: 0, max: 10, step: 0.1 }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t('glowColor') }),

          ui.group({ direction: "row" }, [
            ui.colorInput({ key: "glowColor", value: params.glowColor }),
            ui.textInput({ value: glowColorString, onChange: ({value}) => {
              const r = parseInt(value.slice(1, 3), 16) / 255;
              const g = parseInt(value.slice(3, 5), 16) / 255;
              const b = parseInt(value.slice(5, 7), 16) / 255;
              setParam({ glowColor: { r, g, b, a: 1.0 } })
            }}),
          ]),
        ]),
      ])
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
            glowType: u32, // 0: inner, 1: outer
            weight: f32,
            glowColor: vec4f,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // Get original color
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // Alpha threshold for determining transparency
              let alphaThreshold = 0.1;

              // Check if current pixel is transparent
              let isTransparent = originalColor.a <= alphaThreshold;

              // Outline width (keep as float for better precision)
              let weight = params.weight;
              let weightSquared = weight * weight;

              // Flag to determine if we should draw glow
              var shouldDrawGlow = false;

              // Using select to determine which case we're checking based on glowType
              let checkTransparent = select(false, true, params.glowType == 1u);

              // Only process if we need to check this pixel based on its transparency state
              if ((params.glowType == 0u && isTransparent) || (params.glowType == 1u && !isTransparent)) {
                  // Optimization: Pre-compute loop bounds to avoid unnecessary checks
                  let iStart = max(0, i32(id.x) - i32(weight));
                  let iEnd = min(i32(dims.x) - 1, i32(id.x) + i32(weight));
                  let jStart = max(0, i32(id.y) - i32(weight));
                  let jEnd = min(i32(dims.y) - 1, i32(id.y) + i32(weight));

                  // Loop through neighboring pixels
                  for (var j = jStart; j <= jEnd && !shouldDrawGlow; j++) {
                      for (var i = iStart; i <= iEnd && !shouldDrawGlow; i++) {
                          // Distance calculation optimization: use squared distance to avoid sqrt
                          let dx = f32(i - i32(id.x));
                          let dy = f32(j - i32(id.y));
                          let distanceSquared = dx*dx + dy*dy;

                          // Skip if outside radius (using squared distance)
                          if (distanceSquared > weightSquared) {
                              continue;
                          }

                          // Compute texture coordinates for this pixel
                          let checkCoord = vec2f(f32(i), f32(j)) / dims;
                          let checkColor = textureSampleLevel(inputTexture, textureSampler, checkCoord, 0.0);

                          // Check transparency based on which glow type we're using
                          let pixelIsTransparent = checkColor.a <= alphaThreshold;

                          // If the neighboring pixel has the opposite transparency to what we're looking for
                          if (pixelIsTransparent == checkTransparent) {
                              shouldDrawGlow = true;
                          }
                      }
                  }
              }

              // Determine final color (using select for efficiency)
              let finalColor = select(originalColor, params.glowColor, shouldDrawGlow);

              textureStore(resultTexture, id.xy, finalColor);
          }
      `,
      });

      device.addEventListener("lost", (e) => {
        console.error(e);
      });

      device.addEventListener("uncapturederror", (e) => {
        logger.error(e.error);
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
    goLiveEffect: async ({ device, pipeline }, params, imgData) => {
      logger.log("Glow Effect V1", params);

      imgData = await paddingImageData(imgData, params.weight);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Don't change it
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

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

      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // Create uniform buffer for parameters
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: 32, // u32 + padding + f32 + vec4f
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

      // Update uniforms
      const uniformData = new ArrayBuffer(32);
      const uniformView = new DataView(uniformData);

      // glowType: u32 (0: inner, 1: outer)
      uniformView.setUint32(0, params.glowType === "inner" ? 0 : 1, true);
      // weight: f32
      uniformView.setFloat32(8, params.weight, true);
      // glowColor: vec4f
      uniformView.setFloat32(16, params.glowColor.r, true);
      uniformView.setFloat32(20, params.glowColor.g, true);
      uniformView.setFloat32(24, params.glowColor.b, true);
      uniformView.setFloat32(28, params.glowColor.a, true);

      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

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
