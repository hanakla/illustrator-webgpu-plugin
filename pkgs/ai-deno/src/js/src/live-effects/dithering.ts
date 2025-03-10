import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./utils.ts";

export const dithering = definePlugin({
  id: "dithering-effect-v1",
  title: "Dithering Effect V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: StyleFilterFlag.kPostEffectFilter,
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
        default: 0.5,
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
    },
    editLiveEffectParameters: (params) => {
      // Normalize parameters if needed
      return params;
    },
    liveEffectScaleParameters(params, scaleFactor) {
      // Scale parameters
      return {
        threshold: params.threshold,
        strength: params.strength,
        patternType: params.patternType,
        colorMode: params.colorMode,
      };
    },
    liveEffectInterpolate: (paramsA, paramsB, t) => {
      // Interpolate parameters
      return {
        threshold: lerp(paramsA.threshold, paramsB.threshold, t),
        strength: lerp(paramsA.strength, paramsB.strength, t),
        patternType: t < 0.5 ? paramsA.patternType : paramsB.patternType,
        colorMode: t < 0.5 ? paramsA.colorMode : paramsB.colorMode,
      };
    },

    renderUI: (params) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.select({ key: "patternType", label: "Pattern Type", value: params.patternType, options: [
            { value: 'bayer2x2', label: '2x2 Bayer' },
            { value: 'bayer4x4', label: '4x4 Bayer' },
            { value: 'bayer8x8', label: '8x8 Bayer' },
          ]}),
        ]),
        ui.group({ direction: "row" }, [
          ui.slider({ key: "threshold", label: "Threshold", dataType: 'float', min: 0, max: 100, value: params.threshold }),
        ]),
        ui.group({ direction: "row" }, [
          ui.select({ key: "colorMode", label: "Color Mode", value: params.colorMode, options: [
            { value: 'monochrome', label: 'Monochrome' },
            { value: 'color', label: 'Color' },
          ]}),
        ]),
        ui.group({ direction: "row" }, [
          ui.slider({ key: "strength", label: "Strength", dataType: 'float', min: 0, max: 100, value: params.strength }),
        ]),
      ])
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then((adapter) =>
        adapter!.requestDevice({
          label: "WebGPU(Dithering Effect)",
        })
      );

      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }

      const shader = device.createShaderModule({
        label: "Dithering Effect Shader",
        code: `
          struct Params {
            threshold: f32,
            strength: f32,
            patternType: u32,  // 0: bayer2x2, 1: bayer4x4, 2: bayer8x8
            colorMode: u32,    // 0: monochrome, 1: color
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          // Bayer matrices for ordered dithering
          const bayer2x2: array<f32, 4> = array<f32, 4>(
            0.0, 0.5,
            0.75, 0.25
          );

          const bayer4x4: array<f32, 16> = array<f32, 16>(
            0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
            12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
            3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
            15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
          );

          const bayer8x8: array<f32, 64> = array<f32, 64>(
            0.0/64.0, 32.0/64.0, 8.0/64.0, 40.0/64.0, 2.0/64.0, 34.0/64.0, 10.0/64.0, 42.0/64.0,
            48.0/64.0, 16.0/64.0, 56.0/64.0, 24.0/64.0, 50.0/64.0, 18.0/64.0, 58.0/64.0, 26.0/64.0,
            12.0/64.0, 44.0/64.0, 4.0/64.0, 36.0/64.0, 14.0/64.0, 46.0/64.0, 6.0/64.0, 38.0/64.0,
            60.0/64.0, 28.0/64.0, 52.0/64.0, 20.0/64.0, 62.0/64.0, 30.0/64.0, 54.0/64.0, 22.0/64.0,
            3.0/64.0, 35.0/64.0, 11.0/64.0, 43.0/64.0, 1.0/64.0, 33.0/64.0, 9.0/64.0, 41.0/64.0,
            51.0/64.0, 19.0/64.0, 59.0/64.0, 27.0/64.0, 49.0/64.0, 17.0/64.0, 57.0/64.0, 25.0/64.0,
            15.0/64.0, 47.0/64.0, 7.0/64.0, 39.0/64.0, 13.0/64.0, 45.0/64.0, 5.0/64.0, 37.0/64.0,
            63.0/64.0, 31.0/64.0, 55.0/64.0, 23.0/64.0, 61.0/64.0, 29.0/64.0, 53.0/64.0, 21.0/64.0
          );

          // Get Bayer matrix value based on pattern type and coordinates
          fn getBayerValue(x: u32, y: u32, patternType: u32) -> f32 {
            if (patternType == 0u) {
              // 2x2 Bayer matrix
              return bayer2x2[(y % 2u) * 2u + (x % 2u)];
            } else if (patternType == 1u) {
              // 4x4 Bayer matrix
              return bayer4x4[(y % 4u) * 4u + (x % 4u)];
            } else {
              // 8x8 Bayer matrix
              return bayer8x8[(y % 8u) * 8u + (x % 8u)];
            }
          }

          // Convert RGB to grayscale
          fn rgbToGrayscale(color: vec3f) -> f32 {
            return dot(color, vec3f(0.299, 0.587, 0.114));
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // Get Bayer matrix value for the current pixel
              let bayerValue = getBayerValue(id.x, id.y, params.patternType);

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
      `,
      });

      device.addEventListener("lost", (e) => {
        console.error(e);
      });

      device.addEventListener("uncapturederror", (e) => {
        console.error(e.error);
      });

      const pipeline = device.createComputePipeline({
        label: "Dithering Effect Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain",
        },
      });

      return { device, pipeline };
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      console.log("Dithering Effect V1", params);

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
        magFilter: "linear",
        minFilter: "linear",
      });

      // Create uniform buffer with parameters
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: 16, // 4 * float32
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

      // Update uniforms for dithering parameters
      const uniformData = new ArrayBuffer(16);
      const uniformView = new DataView(uniformData);

      // threshold (float32)
      uniformView.setFloat32(0, params.threshold / 100, true);

      // strength (float32)
      uniformView.setFloat32(4, params.strength / 100, true);

      // patternType (uint32)
      let patternTypeValue = 1; // Default to 4x4
      if (params.patternType === "bayer2x2") patternTypeValue = 0;
      else if (params.patternType === "bayer4x4") patternTypeValue = 1;
      else if (params.patternType === "bayer8x8") patternTypeValue = 2;
      uniformView.setUint32(8, patternTypeValue, true);

      // colorMode (uint32)
      let colorModeValue = params.colorMode === "monochrome" ? 0 : 1;
      uniformView.setUint32(12, colorModeValue, true);

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
