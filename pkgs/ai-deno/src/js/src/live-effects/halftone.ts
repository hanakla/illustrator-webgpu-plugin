import { StyleFilterFlag } from "../types.ts";
import { definePlugin, ColorRGBA } from "../types.ts";
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

const BASE_DPI = 72;

const t = createTranslator({
  en: {
    title: "Halftone Effect",
    dotSize: "Dot Size",
    dotInterval: "Dot Interval",
    dotAngle: "Dot Angle",
    dotColor: "Dot Color",
    color: "Color",
  },
  ja: {
    title: "ハーフトーンエフェクト",
    dotSize: "ドットサイズ",
    dotInterval: "ドット間隔",
    dotAngle: "ドットの角度",
    dotColor: "ドットの色",
    color: "色",
  },
});

export const halftone = definePlugin({
  id: "halftone-effect-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      size: {
        type: "real",
        default: 4.0,
        min: 0.5,
        max: 100.0,
        description: "Dot size in pixels",
      },
      interval: {
        type: "real",
        default: 8.0,
        min: 4.0,
        max: 100.0,
        description: "Dot interval in pixels",
      },
      angle: {
        type: "real",
        default: 0.0,
        min: 0.0,
        max: 360.0,
        description: "Dot array angle in degrees",
      },
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 0, a: 1 },
      },
    },
    onEditParameters: (params) => {
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
        size: params.size * scaleFactor,
        interval: params.interval * scaleFactor,
        angle: params.angle, // Angle doesn't need scaling
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        size: lerp(paramsA.size, paramsB.size, t),
        interval: lerp(paramsA.interval, paramsB.interval, t),
        angle: lerp(paramsA.angle, paramsB.angle, t),
        color: {
          r: lerp(paramsA.color.r, paramsB.color.r, t),
          g: lerp(paramsA.color.g, paramsB.color.g, t),
          b: lerp(paramsA.color.b, paramsB.color.b, t),
          a: lerp(paramsA.color.a, paramsB.color.a, t),
        },
      };
    },

    renderUI: (params, setParam) => {
      const colorStr = toColorCode(params.color);

      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("dotSize") }),
          ui.slider({
            key: "size",
            dataType: "float",
            min: 0.5,
            max: 100,
            value: params.size,
          }),
          ui.numberInput({
            key: "size",
            dataType: "float",
            value: params.size,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("dotInterval") }),
          ui.slider({
            key: "interval",
            dataType: "float",
            min: 4,
            max: 100,
            value: params.interval,
          }),
          ui.numberInput({
            key: "interval",
            dataType: "float",
            value: params.interval,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("dotAngle") }),
          ui.slider({
            key: "angle",
            dataType: "float",
            min: 0,
            max: 360,
            value: params.angle,
          }),
          ui.numberInput({
            key: "angle",
            dataType: "float",
            value: params.angle,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("dotColor") }),
          ui.group({ direction: "row" }, [
            ui.colorInput({
              key: "color",
              label: t("color"),
              value: params.color,
            }),
            ui.textInput({
              key: "colorInput",
              value: colorStr,
              onChange: (e) => {
                setParam({ color: parseColorCode(e.value) });
              },
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then((adapter) =>
        adapter!.requestDevice({
          label: "WebGPU(Halftone Effect)",
        })
      );

      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }

      // Single-pass shader for halftone effect with built-in anti-aliasing
      const shader = device.createShaderModule({
        label: "Halftone Effect Shader",
        code: `
          struct Params {
            inputDpi: i32,
            baseDpi: i32,
            size: f32,
            interval: f32,
            angle: f32,
            color: vec4f,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          // Convert RGB to grayscale with alpha consideration
          fn rgbToGray(color: vec3f, alpha: f32) -> f32 {
            return dot(color.rgb, vec3f(0.299, 0.587, 0.114)) * alpha;
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
            let dims = vec2f(textureDimensions(inputTexture));
            let texCoord = vec2f(id.xy) / dims;

            // Calculate DPI scaling factor
            let dpiScale = f32(params.inputDpi) / f32(params.baseDpi);

            // Calculate cell size in pixels
            let cellSize = params.interval * dpiScale;

            // Convert angle from degrees to radians
            let angleRad = params.angle * 3.14159265359 / 180.0;

            // Create rotation matrix
            let cosAngle = cos(angleRad);
            let sinAngle = sin(angleRad);

            // Rotate the texture coordinates
            let centered = texCoord - 0.5;
            let rotated = vec2f(
              centered.x * cosAngle - centered.y * sinAngle,
              centered.x * sinAngle + centered.y * cosAngle
            );
            let rotatedTexCoord = rotated + 0.5;

            // Calculate cell coordinates and position within cell
            let cellCoord = vec2f(
              floor(rotatedTexCoord.x * dims.x / cellSize),
              floor(rotatedTexCoord.y * dims.y / cellSize)
            );

            let posInCell = vec2f(
              fract(rotatedTexCoord.x * dims.x / cellSize),
              fract(rotatedTexCoord.y * dims.y / cellSize)
            );

            // Calculate distance from center of cell
            let cellCenter = vec2f(0.5, 0.5);
            let dist = distance(posInCell, cellCenter);

            // Sample the image at the center of each cell
            let cellCenterInRotated = vec2f(
              (cellCoord.x + 0.5) * cellSize / dims.x,
              (cellCoord.y + 0.5) * cellSize / dims.y
            );

            // Rotate back to sample from the original image
            let cellCenterCentered = cellCenterInRotated - 0.5;
            let cellCenterUnrotated = vec2f(
              cellCenterCentered.x * cosAngle + cellCenterCentered.y * sinAngle,
              -cellCenterCentered.x * sinAngle + cellCenterCentered.y * cosAngle
            );
            let cellCenterCoord = cellCenterUnrotated + 0.5;

            // Clamp to valid texture coordinates
            let clampedCellCenterCoord = clamp(cellCenterCoord, vec2f(0.0), vec2f(1.0));
            let centerColor = textureSampleLevel(inputTexture, textureSampler, clampedCellCenterCoord, 0.0);
            let centerGray = rgbToGray(centerColor.rgb, centerColor.a);

            // Calculate dot size based on brightness
            let dotSizeFactor = centerGray;

            // Apply non-linear mapping for better contrast
            let adjustedFactor = pow(dotSizeFactor, 0.8);

            // Calculate dot radius in normalized cell space
            let sizeInPixels = params.size * dpiScale;
            let normalizedSize = sizeInPixels / cellSize;
            let dotRadius = (1.0 - adjustedFactor) * normalizedSize * 0.5;

            // Limit maximum dot size
            let scaledDotSize = min(dotRadius, 0.4);

            // Apply anti-aliasing at dot edges
            let edgeWidth = 0.01;
            let alpha = 1.0 - smoothstep(scaledDotSize - edgeWidth, scaledDotSize + edgeWidth, dist);

            // Create final color with transparency
            let finalColor = vec4f(params.color.rgb, params.color.a * alpha);

            // Only set color if we're inside or near the dot
            if (alpha > 0.001) {
              textureStore(resultTexture, id.xy, finalColor);
            } else {
              // Completely transparent outside dots
              textureStore(resultTexture, id.xy, vec4f(0.0, 0.0, 0.0, 0.0));
            }
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
        label: "Halftone Effect Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain",
        },
      });

      return { device, pipeline };
    },
    goLiveEffect: async ({ device, pipeline }, params, imgData, env) => {
      console.log("Halftone Effect", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      // Create textures
      const inputTexture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
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

      // Create uniform buffer with proper alignment (48 bytes)
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: inputTexture.createView(),
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

      // Update uniform buffer with parameters
      const uniformData = new ArrayBuffer(48);
      const view = new DataView(uniformData);

      // inputDpi, baseDpi (i32)
      view.setInt32(0, env.dpi, true);
      view.setInt32(4, env.baseDpi, true);

      // size, interval, angle (f32)
      view.setFloat32(8, params.size, true);
      view.setFloat32(12, params.interval, true);
      view.setFloat32(16, params.angle, true);
      view.setFloat32(20, 0.0, true); // padding

      // color (vec4f) starts at offset 32 for proper alignment
      view.setFloat32(32, params.color.r, true);
      view.setFloat32(36, params.color.g, true);
      view.setFloat32(40, params.color.b, true);
      view.setFloat32(44, params.color.a, true);

      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // Update source texture
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Halftone Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Halftone Compute Pass",
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

      // Read back the result
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
