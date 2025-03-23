import { StyleFilterFlag } from "../../types.ts";
import { definePlugin, ColorRGBA } from "../../types.ts";
import { createTranslator } from "../../ui/locale.ts";
import { ui } from "../../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "../_utils.ts";

// RMIT: Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Image Reverb V1",
    decayFactor: "Decay Factor",
    diffusionStrength: "Diffusion Strength",
    spread: "Spread",
    iterations: "Iterations",
    directionX: "Direction X",
    directionY: "Direction Y",
  },
  ja: {
    title: "イメージリバーブ V1",
    decayFactor: "減衰率",
    diffusionStrength: "拡散の強さ",
    spread: "拡散の広がり",
    iterations: "反復回数",
    directionX: "方向 X",
    directionY: "方向 Y",
  },
});

export const imageReverbGPU = definePlugin({
  id: "image-reverb-gpu-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      decayFactor: { type: "real", default: 0.85 },
      diffusionStrength: { type: "real", default: 0.5 },
      spread: { type: "int", default: 5 },
      iterations: { type: "int", default: 5 },
      directionX: { type: "real", default: 0.5 },
      directionY: { type: "real", default: 0.5 },
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
        decayFactor: lerp(paramsA.decayFactor, paramsB.decayFactor, t),
        diffusionStrength: lerp(
          paramsA.diffusionStrength,
          paramsB.diffusionStrength,
          t
        ),
        spread: lerp(paramsA.spread, paramsB.spread, t),
        iterations: lerp(paramsA.iterations, paramsB.iterations, t),
        directionX: lerp(paramsA.directionX, paramsB.directionX, t),
        directionY: lerp(paramsA.directionY, paramsB.directionY, t),
      };
    },

    renderUI: (params, setParam) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.group({direction:'col'}, [
            ui.text({text: t("decayFactor")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "decayFactor", dataType: "float", value: params.decayFactor, min:0, max:1 }),
              ui.numberInput({ key: "decayFactor", dataType: "float", value: params.decayFactor, min:0, max:1, step:0.01 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("diffusionStrength")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "diffusionStrength", dataType: "float", value: params.diffusionStrength, min:0, max:1 }),
              ui.numberInput({ key: "diffusionStrength", dataType: "float", value: params.diffusionStrength, min:0, max:1, step:0.01 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("spread")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "spread", dataType: "int", value: params.spread, min:1, max:100 }),
              ui.numberInput({ key: "spread", dataType: "int", value: params.spread, min:1, max:100, step:1 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("iterations")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "iterations", dataType: "int", value: params.iterations, min:1, max:10 }),
              ui.numberInput({ key: "iterations", dataType: "int", value: params.iterations, min:1, max:10, step:1 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("directionX")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "directionX", dataType: "float", value: params.directionX, min:0, max:1 }),
              ui.numberInput({ key: "directionX", dataType: "float", value: params.directionX, min:0, max:1, step:0.01 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("directionY")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "directionY", dataType: "float", value: params.directionY, min:0, max:1 }),
              ui.numberInput({ key: "directionY", dataType: "float", value: params.directionY, min:0, max:1, step:0.01 }),
            ]),
          ]),
        ]),
      ])
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then((adapter) =>
        adapter!.requestDevice({
          label: "WebGPU(Image Reverb)",
        })
      );

      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }

      // Create shader modules for each stage of the reverb process
      const earlyReflectionsShader = device.createShaderModule({
        label: "Early Reflections Shader",
        code: `
          struct Params {
            width: u32,
            height: u32,
            spread: u32,
            directionX: f32,
            directionY: f32,
            diffusionStrength: f32,
          }

          @group(0) @binding(0) var<storage, read> inputImage: array<u32>;
          @group(0) @binding(1) var<storage, read_write> outputImage: array<u32>;
          @group(0) @binding(2) var<uniform> params: Params;

          // Helper function to unpack RGBA from u32
          fn unpackRGBA(color: u32) -> vec4<f32> {
            let r = f32((color >> 0u) & 0xFFu) / 255.0;
            let g = f32((color >> 8u) & 0xFFu) / 255.0;
            let b = f32((color >> 16u) & 0xFFu) / 255.0;
            let a = f32((color >> 24u) & 0xFFu) / 255.0;
            return vec4<f32>(r, g, b, a);
          }

          // Helper function to pack RGBA to u32
          fn packRGBA(color: vec4<f32>) -> u32 {
            let r = u32(color.r * 255.0) & 0xFFu;
            let g = u32(color.g * 255.0) & 0xFFu;
            let b = u32(color.b * 255.0) & 0xFFu;
            let a = u32(color.a * 255.0) & 0xFFu;
            return (a << 24u) | (b << 16u) | (g << 8u) | r;
          }

          // Helper function to get safe index
          fn getSafeIndex(x: i32, y: i32, width: u32, height: u32) -> u32 {
            let safeX = min(max(0, x), i32(width) - 1);
            let safeY = min(max(0, y), i32(height) - 1);
            return u32(safeY) * width + u32(safeX);
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3<u32>) {
            // Check if within image bounds
            if (id.x >= params.width || id.y >= params.height) {
              return;
            }

            let pixelIndex = id.y * params.width + id.x;
            let originalColor = unpackRGBA(inputImage[pixelIndex]);
            var resultColor = vec4<f32>(0.0, 0.0, 0.0, 0.0);

            // Direction bias calculation
            let dirBiasX = (params.directionX * 2.0 - 1.0) * f32(params.spread);
            let dirBiasY = (params.directionY * 2.0 - 1.0) * f32(params.spread);

            // Reflection patterns with different strengths
            let patterns = array<vec3<f32>, 6>(
              vec3<f32>(1.0, 0.0, 0.6),  // dx, dy, strength
              vec3<f32>(0.0, 1.0, 0.5),
              vec3<f32>(1.0, 1.0, 0.4),
              vec3<f32>(-1.0, 1.0, 0.3),
              vec3<f32>(2.0, 0.0, 0.2),
              vec3<f32>(0.0, 2.0, 0.1)
            );

            // Apply early reflections
            for (var i = 0u; i < 6u; i++) {
              let pattern = patterns[i];
              let offsetX = i32(round(pattern.x * dirBiasX));
              let offsetY = i32(round(pattern.y * dirBiasY));

              let targetX = i32(id.x) + offsetX;
              let targetY = i32(id.y) + offsetY;
              let targetIndex = getSafeIndex(targetX, targetY, params.width, params.height);

              // Add reflection contribution
              resultColor += unpackRGBA(inputImage[pixelIndex]) * pattern.z;
            }

            // Mix with original using a 0.5 factor for original
            resultColor += originalColor * 0.5;
            resultColor = min(resultColor, vec4<f32>(1.0));

            // Store result
            outputImage[pixelIndex] = packRGBA(resultColor);
          }
        `,
      });

      const diffusionShader = device.createShaderModule({
        label: "Diffusion Shader",
        code: `
          struct Params {
            width: u32,
            height: u32,
            spread: u32,
            directionX: f32,
            directionY: f32,
            decayFactor: f32,
            currentDecay: f32,
            iteration: u32,
          }

          @group(0) @binding(0) var<storage, read> inputImage: array<u32>;
          @group(0) @binding(1) var<storage, read_write> tempImage: array<u32>;
          @group(0) @binding(2) var<storage, read_write> outputImage: array<u32>;
          @group(0) @binding(3) var<uniform> params: Params;

          // Helper function to unpack RGBA from u32
          fn unpackRGBA(color: u32) -> vec4<f32> {
            let r = f32((color >> 0u) & 0xFFu) / 255.0;
            let g = f32((color >> 8u) & 0xFFu) / 255.0;
            let b = f32((color >> 16u) & 0xFFu) / 255.0;
            let a = f32((color >> 24u) & 0xFFu) / 255.0;
            return vec4<f32>(r, g, b, a);
          }

          // Helper function to pack RGBA to u32
          fn packRGBA(color: vec4<f32>) -> u32 {
            let r = u32(color.r * 255.0) & 0xFFu;
            let g = u32(color.g * 255.0) & 0xFFu;
            let b = u32(color.b * 255.0) & 0xFFu;
            let a = u32(color.a * 255.0) & 0xFFu;
            return (a << 24u) | (b << 16u) | (g << 8u) | r;
          }

          // Helper function to get safe index
          fn getSafeIndex(x: i32, y: i32, width: u32, height: u32) -> u32 {
            let safeX = min(max(0, x), i32(width) - 1);
            let safeY = min(max(0, y), i32(height) - 1);
            return u32(safeY) * width + u32(safeX);
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3<u32>) {
            // Check if within image bounds
            if (id.x >= params.width || id.y >= params.height) {
              return;
            }

            let pixelIndex = id.y * params.width + id.x;

            // Direction calculation with spread factor
            let dirX = i32(round((params.directionX * 2.0 - 1.0) * f32(params.spread)));
            let dirY = i32(round((params.directionY * 2.0 - 1.0) * f32(params.spread)));

            // Get source color
            let sourceColor = unpackRGBA(inputImage[pixelIndex]);

            // Calculate target position for directional diffusion
            let targetX = i32(id.x) + dirX;
            let targetY = i32(id.y) + dirY;
            let targetIndex = getSafeIndex(targetX, targetY, params.width, params.height);

            // Apply directional diffusion with decay
            let tempColor = sourceColor * params.currentDecay;

            // Update temp image with atomic operations (since multiple threads might write to same location)
            let packedTempColor = packRGBA(tempColor);
            outputImage[targetIndex] = packedTempColor;

            // For the first iteration, also apply a simple blur for high-frequency damping
            if (params.iteration <= 0u) {
              // Simple blur radius based on spread
              let blurRadius = max(1u, params.spread / 3u);

              // Copy temp image to output for blurring
              if (id.x == 0u && id.y == 0u) {
                // Only one thread should copy the entire buffer
                for (var i = 0u; i < params.width * params.height; i++) {
                  tempImage[i] = outputImage[i];
                }
              }

              // Wait for all threads to finish the copy
              workgroupBarrier();

              // Apply blur
              var blurredColor = vec4<f32>(0.0, 0.0, 0.0, 0.0);
              var count = 0.0;

              for (var ky = -i32(blurRadius); ky <= i32(blurRadius); ky++) {
                for (var kx = -i32(blurRadius); kx <= i32(blurRadius); kx++) {
                  let sampleIndex = getSafeIndex(i32(id.x) + kx, i32(id.y) + ky, params.width, params.height);
                  blurredColor += unpackRGBA(tempImage[sampleIndex]);
                  count += 1.0;
                }
              }

              blurredColor /= count;
              outputImage[pixelIndex] = packRGBA(blurredColor);
            }
          }
        `,
      });

      const blendShader = device.createShaderModule({
        label: "Final Blend Shader",
        code: `
          struct Params {
            width: u32,
            height: u32,
            diffusionStrength: f32,
          }

          @group(0) @binding(0) var<storage, read> originalImage: array<u32>;
          @group(0) @binding(1) var<storage, read> processedImage: array<u32>;
          @group(0) @binding(2) var<storage, read_write> resultImage: array<u32>;
          @group(0) @binding(3) var<uniform> params: Params;

          // Helper function to unpack RGBA from u32
          fn unpackRGBA(color: u32) -> vec4<f32> {
            let r = f32((color >> 0u) & 0xFFu) / 255.0;
            let g = f32((color >> 8u) & 0xFFu) / 255.0;
            let b = f32((color >> 16u) & 0xFFu) / 255.0;
            let a = f32((color >> 24u) & 0xFFu) / 255.0;
            return vec4<f32>(r, g, b, a);
          }

          // Helper function to pack RGBA to u32
          fn packRGBA(color: vec4<f32>) -> u32 {
            let r = u32(color.r * 255.0) & 0xFFu;
            let g = u32(color.g * 255.0) & 0xFFu;
            let b = u32(color.b * 255.0) & 0xFFu;
            let a = u32(color.a * 255.0) & 0xFFu;
            return (a << 24u) | (b << 16u) | (g << 8u) | r;
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3<u32>) {
            // Check if within image bounds
            if (id.x >= params.width || id.y >= params.height) {
              return;
            }

            let pixelIndex = id.y * params.width + id.x;

            // Get colors from original and processed images
            let originalColor = unpackRGBA(originalImage[pixelIndex]);
            let processedColor = unpackRGBA(processedImage[pixelIndex]);

            // Calculate dry/wet mix
            let dryFactor = 1.0 - params.diffusionStrength;
            let wetFactor = params.diffusionStrength;

            // Blend colors
            let finalColor = originalColor * dryFactor + processedColor * wetFactor;

            // Store result
            resultImage[pixelIndex] = packRGBA(finalColor);
          }
        `,
      });

      // Create compute pipelines
      const earlyReflectionsPipeline = device.createComputePipeline({
        label: "Early Reflections Pipeline",
        layout: "auto",
        compute: {
          module: earlyReflectionsShader,
          entryPoint: "computeMain",
        },
      });

      const diffusionPipeline = device.createComputePipeline({
        label: "Diffusion Pipeline",
        layout: "auto",
        compute: {
          module: diffusionShader,
          entryPoint: "computeMain",
        },
      });

      const blendPipeline = device.createComputePipeline({
        label: "Blend Pipeline",
        layout: "auto",
        compute: {
          module: blendShader,
          entryPoint: "computeMain",
        },
      });

      device.addEventListener("lost", (e) => {
        console.error(e);
      });

      device.addEventListener("uncapturederror", (e) => {
        console.error(e.error);
      });

      return {
        device,
        earlyReflectionsPipeline,
        diffusionPipeline,
        blendPipeline,
      };
    },
    goLiveEffect: async (
      { device, earlyReflectionsPipeline, diffusionPipeline, blendPipeline },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Running Image Reverb GPU", params);

      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      // Add padding for WebGPU alignment if needed
      imgData = await addWebGPUAlignmentPadding(imgData);

      const width = imgData.width;
      const height = imgData.height;
      const pixelCount = width * height;

      // Convert RGBA data to uint32 array for more efficient GPU processing
      const uint32Data = new Uint32Array(pixelCount);
      const rgba = new Uint8Array(imgData.data.buffer);

      for (let i = 0; i < pixelCount; i++) {
        const baseIndex = i * 4;
        const r = rgba[baseIndex];
        const g = rgba[baseIndex + 1];
        const b = rgba[baseIndex + 2];
        const a = rgba[baseIndex + 3];
        uint32Data[i] = (a << 24) | (b << 16) | (g << 8) | r;
      }

      // Create buffers
      const originalBuffer = device.createBuffer({
        size: uint32Data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      const earlyReflectionsBuffer = device.createBuffer({
        size: uint32Data.byteLength,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_SRC |
          GPUBufferUsage.COPY_DST,
      });

      const tempBuffer1 = device.createBuffer({
        size: uint32Data.byteLength,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_SRC |
          GPUBufferUsage.COPY_DST,
      });

      const tempBuffer2 = device.createBuffer({
        size: uint32Data.byteLength,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_SRC |
          GPUBufferUsage.COPY_DST,
      });

      const resultBuffer = device.createBuffer({
        size: uint32Data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });

      const stagingBuffer = device.createBuffer({
        size: uint32Data.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Upload data to the original buffer
      device.queue.writeBuffer(originalBuffer, 0, uint32Data);

      // Create uniform buffers for parameters
      const earlyReflectionsParamsBuffer = device.createBuffer({
        size: 32, // Aligned size for uniform buffer
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const diffusionParamsBuffer = device.createBuffer({
        size: 40, // Aligned size for uniform buffer
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const blendParamsBuffer = device.createBuffer({
        size: 16, // Aligned size for uniform buffer
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Update early reflections parameters
      const earlyReflectionsParams = new ArrayBuffer(32);
      const earlyReflectionsView = new DataView(earlyReflectionsParams);
      earlyReflectionsView.setUint32(0, width, true);
      earlyReflectionsView.setUint32(4, height, true);
      earlyReflectionsView.setUint32(8, params.spread, true);
      earlyReflectionsView.setFloat32(12, params.directionX, true);
      earlyReflectionsView.setFloat32(16, params.directionY, true);
      earlyReflectionsView.setFloat32(20, params.diffusionStrength, true);

      device.queue.writeBuffer(
        earlyReflectionsParamsBuffer,
        0,
        earlyReflectionsParams
      );

      // Run early reflections pass
      const earlyReflectionsBindGroup = device.createBindGroup({
        layout: earlyReflectionsPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: originalBuffer } },
          { binding: 1, resource: { buffer: earlyReflectionsBuffer } },
          { binding: 2, resource: { buffer: earlyReflectionsParamsBuffer } },
        ],
      });

      let commandEncoder = device.createCommandEncoder();
      let passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(earlyReflectionsPipeline);
      passEncoder.setBindGroup(0, earlyReflectionsBindGroup);
      passEncoder.dispatchWorkgroups(
        Math.ceil(width / 16),
        Math.ceil(height / 16)
      );
      passEncoder.end();

      // Copy earlyReflectionsBuffer to tempBuffer1 for diffusion pass
      commandEncoder.copyBufferToBuffer(
        earlyReflectionsBuffer,
        0,
        tempBuffer1,
        0,
        uint32Data.byteLength
      );

      device.queue.submit([commandEncoder.finish()]);

      // Run iterations of diffusion pass
      let currentBuffer = tempBuffer1;
      let outputBuffer = tempBuffer2;
      let currentDecay = 1.0;

      for (let i = 0; i < params.iterations; i++) {
        // Update diffusion parameters for this iteration
        const diffusionParams = new ArrayBuffer(40);
        const diffusionView = new DataView(diffusionParams);
        diffusionView.setUint32(0, width, true);
        diffusionView.setUint32(4, height, true);
        diffusionView.setUint32(8, params.spread, true);
        diffusionView.setFloat32(12, params.directionX, true);
        diffusionView.setFloat32(16, params.directionY, true);
        diffusionView.setFloat32(20, params.decayFactor, true);
        diffusionView.setFloat32(24, currentDecay, true);
        diffusionView.setUint32(28, i, true);

        device.queue.writeBuffer(diffusionParamsBuffer, 0, diffusionParams);

        const diffusionBindGroup = device.createBindGroup({
          layout: diffusionPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: currentBuffer } },
            { binding: 1, resource: { buffer: tempBuffer1 } }, // Always use tempBuffer1 for optional blur
            { binding: 2, resource: { buffer: outputBuffer } },
            { binding: 3, resource: { buffer: diffusionParamsBuffer } },
          ],
        });

        commandEncoder = device.createCommandEncoder();
        passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(diffusionPipeline);
        passEncoder.setBindGroup(0, diffusionBindGroup);
        passEncoder.dispatchWorkgroups(
          Math.ceil(width / 16),
          Math.ceil(height / 16)
        );
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);

        // Update for next iteration
        [currentBuffer, outputBuffer] = [outputBuffer, currentBuffer];
        currentDecay *= params.decayFactor;
      }

      // Final blend pass
      const blendParams = new ArrayBuffer(16);
      const blendView = new DataView(blendParams);
      blendView.setUint32(0, width, true);
      blendView.setUint32(4, height, true);
      blendView.setFloat32(8, params.diffusionStrength, true);

      device.queue.writeBuffer(blendParamsBuffer, 0, blendParams);

      const blendBindGroup = device.createBindGroup({
        layout: blendPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: originalBuffer } },
          { binding: 1, resource: { buffer: currentBuffer } }, // The last output from diffusion
          { binding: 2, resource: { buffer: resultBuffer } },
          { binding: 3, resource: { buffer: blendParamsBuffer } },
        ],
      });

      commandEncoder = device.createCommandEncoder();
      passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(blendPipeline);
      passEncoder.setBindGroup(0, blendBindGroup);
      passEncoder.dispatchWorkgroups(
        Math.ceil(width / 16),
        Math.ceil(height / 16)
      );
      passEncoder.end();

      // Copy result to staging buffer for readback
      commandEncoder.copyBufferToBuffer(
        resultBuffer,
        0,
        stagingBuffer,
        0,
        uint32Data.byteLength
      );

      device.queue.submit([commandEncoder.finish()]);

      // Read back the result
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const resultData = new Uint32Array(stagingBuffer.getMappedRange());

      // Convert uint32 data back to RGBA
      const resultImageData = new ImageData(
        new Uint8ClampedArray(width * height * 4),
        width,
        height
      );
      const resultRGBA = new Uint8Array(resultImageData.data.buffer);

      for (let i = 0; i < pixelCount; i++) {
        const rgba = resultData[i];
        const baseIndex = i * 4;
        resultRGBA[baseIndex] = rgba & 0xff;
        resultRGBA[baseIndex + 1] = (rgba >> 8) & 0xff;
        resultRGBA[baseIndex + 2] = (rgba >> 16) & 0xff;
        resultRGBA[baseIndex + 3] = (rgba >> 24) & 0xff;
      }

      stagingBuffer.unmap();

      // Remove padding and return the final image
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
