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
import { createGPUDevice } from "./_shared.ts";

// Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Halftone Effect",
    dotSize: "Dot Size",
    dotAngle: "Dot Angle",
    dotColor: "Dot Color",
    placementPattern: "Dot Placement",
    gridPattern: "Grid",
    staggeredPattern: "Staggered",
    color: "Color",
  },
  ja: {
    title: "ハーフトーンエフェクト",
    dotSize: "ドットサイズ",
    dotAngle: "ドットの角度",
    dotColor: "ドットの色",
    placementPattern: "ドット配置",
    gridPattern: "グリッド",
    staggeredPattern: "交差",
    color: "色",
  },
});

export const halftone = definePlugin({
  id: "halftone-effect-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Stylize",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      size: {
        type: "real",
        default: 4.0,
        // description: "Dot size in pixels",
      },
      angle: {
        type: "real",
        default: 0.0,
        // description: "Dot array angle in degrees",
      },
      placementPattern: {
        type: "string",
        default: "grid",
        enum: ["grid", "staggered"],
        description: "Dot placement pattern",
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
        angle: params.angle, // Angle doesn't need scaling
        placementPattern: params.placementPattern, // Pattern doesn't need scaling
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        size: lerp(paramsA.size, paramsB.size, t),
        angle: lerp(paramsA.angle, paramsB.angle, t),
        placementPattern:
          t < 0.5 ? paramsA.placementPattern : paramsB.placementPattern, // Enum values don't interpolate
        color: {
          r: lerp(paramsA.color.r, paramsB.color.r, t),
          g: lerp(paramsA.color.g, paramsB.color.g, t),
          b: lerp(paramsA.color.b, paramsB.color.b, t),
          a: lerp(paramsA.color.a, paramsB.color.a, t),
        },
      };
    },

    renderUI: (params, { setParam }) => {
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
          ui.text({ text: t("placementPattern") }),
          ui.select({
            key: "placementPattern",
            options: [
              { value: "grid", label: t("gridPattern") },
              // { value: "staggered", label: t("staggeredPattern") },
            ],
            value: params.placementPattern || "grid",
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
              value: params.color,
            }),
            ui.textInput({
              key: "colorInput",
              value: colorStr,
              onChange: (e) => {
                setParam({ color: parseColorCode(e.value)! });
              },
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Halftone Effect)" },
        },
        (device) => {
          const code = `
struct Params {
  outputSize: vec2i,
  dpiScale: f32,
  size: f32,
  angle: f32,
  color: vec4f,
  placementPattern: i32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var textureSampler: sampler;
@group(0) @binding(3) var<uniform> params: Params;

fn rgbToGray(color: vec3f, alpha: f32) -> f32 {
  return dot(color.rgb, vec3f(0.299, 0.587, 0.114)) * alpha;
}

@compute @workgroup_size(16, 16)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  // Basic setup
  let outputSize = vec2f(params.outputSize);
  let currentPixel = vec2f(id.xy);

  // Skip padding pixels
  if (currentPixel.x >= outputSize.x || currentPixel.y >= outputSize.y) {
    return;
  }

  // Calculate rotation matrices
  let radians = params.angle * 3.14159265359 / 180.0;
  let cosTheta = cos(radians);
  let sinTheta = sin(radians);

  // Create rotation and inverse rotation matrices
  let rotMatrix = mat2x2(
    cosTheta, sinTheta,
    -sinTheta, cosTheta
  );

  let invRotMatrix = mat2x2(
    cosTheta, -sinTheta,
    sinTheta, cosTheta
  );

  // Center and rotate current pixel
  let center = outputSize * 0.5;
  let centered = currentPixel - center;
  let rotated = rotMatrix * centered;
  let rotatedPixel = rotated + center;

  // Calculate cell size in pixels (consistent scaling)
  let dotSizeScaled = params.size * params.dpiScale;
  let cellSize = vec2f(dotSizeScaled, dotSizeScaled);

  // Calculate cell coordinates
  let baseCell = rotatedPixel / cellSize;
  var cellX = floor(baseCell.x);
  let cellY = floor(baseCell.y);

  // Apply staggered pattern offset for odd rows if needed
  if (params.placementPattern == 1) {
    let isOddRow = (cellY % 2.0) == 1.0;
    if (isOddRow) {
      cellX = floor(baseCell.x + 0.5);
    }
  }

  // Calculate cell origin and position within cell
  let cellOrigin = vec2f(cellX, cellY) * cellSize;
  let posInCell = (rotatedPixel - cellOrigin) / cellSize;

  // Calculate cell center
  let cellCenter = cellOrigin + cellSize * 0.5;

  // Transform cell center back to original space for sampling
  let centeredCellCenter = cellCenter - center;
  let originalCellCenter = invRotMatrix * centeredCellCenter;
  let samplePoint = originalCellCenter + center;

  // Get padding-corrected coordinates
  let texCoord = samplePoint / outputSize;
  let paddedTextureSize = vec2f(textureDimensions(inputTexture));
  let paddingCorrection = outputSize / paddedTextureSize;
  let sampleCoord = texCoord * paddingCorrection;

  // Sample original image
  let origColor = textureSampleLevel(inputTexture, textureSampler, sampleCoord, 0.0);
  let grayscale = rgbToGray(origColor.rgb, origColor.a);

  // Adjust brightness and calculate dot size
  let brightness = clamp(pow(grayscale, 0.7), 0.0, 0.95);
  let dotScale = 0.4;
  let dotRadius = (1.0 - brightness) * dotScale;
  let minDotRadius = 0.05;
  let finalDotRadius = max(dotRadius, minDotRadius);

  // Calculate distance from center of cell
  let distToCenter = length(posInCell - vec2f(0.5, 0.5));

  // Create circular dot with anti-aliased edge
  let edgeWidth = 0.01;
  let alpha = 1.0 - smoothstep(finalDotRadius - edgeWidth, finalDotRadius + edgeWidth, distToCenter);

  // Apply final color
  var finalAlpha = 0.02;
  if (alpha > 0.01) {
    finalAlpha = alpha * params.color.a;
  }

  textureStore(resultTexture, id.xy, vec4f(params.color.rgb, finalAlpha));
}
`;

          const shader = device.createShaderModule({
            label: "Halftone Effect Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Halftone Effect Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain",
            },
          });

          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async (
      { device, pipeline, pipelineDef },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Halftone Effect", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Don't change it
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Halftone Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Halftone Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Halftone Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Halftone Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Set uniform values
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        size: params.size,
        angle: params.angle,
        placementPattern: params.placementPattern === "staggered" ? 1 : 0,
        color: [params.color.r, params.color.g, params.color.b, params.color.a],
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Halftone Main Bind Group",
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
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
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
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();

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
