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

const t = createTranslator({
  en: {
    title: "[WIP] Bitonic Pixel Sort",
    direction: "Direction",
    vertical: "Vertical",
    horizontal: "Horizontal",
    strength: "Sort Strength",
    startPoint: "Start Point",
    iterations: "Iterations",
    completeSort: "Complete Sort",
    invertLight: "Invert Light",
  },
  ja: {
    title: "[WIP] バイトニックピクセルソート",
    direction: "方向",
    vertical: "縦",
    horizontal: "横",
    strength: "ソート量",
    startPoint: "スタート地点",
    iterations: "反復回数",
    completeSort: "完全ソート",
    invertLight: "明暗反転",
  },
});

export const pixelSort = definePlugin({
  id: "bitonic-pixel-sort",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      direction: {
        type: "string",
        enum: ["horizontal", "vertical"],
        default: "horizontal",
      },
      strength: {
        type: "real",
        default: 0.5,
      },
      startPoint: {
        type: "real",
        default: 0.0,
      },
      iterations: {
        type: "int",
        default: 1,
        min: 1,
        max: 10,
      },
      completeSort: {
        type: "bool",
        default: false,
      },
      invertLight: {
        type: "bool",
        default: false,
      },
    },
    onEditParameters: (params) => {
      // パラメータの正規化
      return {
        ...params,
        strength: Math.max(0, Math.min(1, params.strength)),
        startPoint: Math.max(0, Math.min(1, params.startPoint)),
        iterations: Math.max(1, Math.min(10, Math.floor(params.iterations))),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // パラメータ補間
      return {
        direction: t < 0.5 ? paramsA.direction : paramsB.direction,
        strength: lerp(paramsA.strength, paramsB.strength, t),
        startPoint: lerp(paramsA.startPoint, paramsB.startPoint, t),
        iterations: t < 0.5 ? paramsA.iterations : paramsB.iterations,
        completeSort: t < 0.5 ? paramsA.completeSort : paramsB.completeSort,
        invertLight: t < 0.5 ? paramsA.invertLight : paramsB.invertLight,
      };
    },

    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("direction") }),
          ui.select({
            key: "direction",
            value: params.direction,
            options: [
              { label: t("horizontal"), value: "horizontal" },
              { label: t("vertical"), value: "vertical" },
            ],
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strength",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.strength,
            }),
            ui.numberInput({
              key: "strength",
              dataType: "float",
              value: params.strength,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("startPoint") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "startPoint",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.startPoint,
            }),
            ui.numberInput({
              key: "startPoint",
              dataType: "float",
              value: params.startPoint,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Iterations" }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "iterations",
              dataType: "int",
              min: 1,
              max: 10,
              value: params.iterations,
            }),
            ui.numberInput({
              key: "iterations",
              dataType: "int",
              value: params.iterations,
            }),
          ]),
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "completeSort",
            label: "Complete Sort",
            value: params.completeSort,
          }),
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "invertLight",
            label: "Invert Light",
            value: params.invertLight,
          }),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then((adapter) =>
        adapter!.requestDevice({
          label: "WebGPU(Bitonic Pixel Sort)",
        })
      );

      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }

      const shader = device.createShaderModule({
        label: "Bitonic Pixel Sort Shader",
        code: `
          struct Params {
            inputDpi: i32,
            baseDpi: i32,
            strength: f32,
            startPoint: f32,
            direction: u32,  // 0: horizontal, 1: vertical
            blockStep: u32,  // For bitonic sort
            subBlockStep: u32, // For bitonic sort
            invertLight: u32, // 0: normal, 1: inverted
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          // Luminance calculation function with alpha
          fn getLuminance(color: vec4<f32>, invert: u32) -> f32 {
            // Standard luminance calculation with alpha
            let lum = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114)) * color.a;
            return select(lum, 1.0 - lum, invert == 1u);
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3<u32>) {
              let dims = vec2<f32>(textureDimensions(inputTexture));
              let texCoord = vec2<f32>(id.xy) / dims;

              // Get original color
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // Determine direction
              let isHorizontal = params.direction == 0u;

              // Get current line position and size
              let linePosition = select(id.y, id.x, isHorizontal);
              let lineSize = select(u32(dims.y), u32(dims.x), isHorizontal);
              let startPos = u32(f32(lineSize) * params.startPoint);

              // Skip processing if before start point
              if (linePosition < startPos) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // Calculate sort range
              let maxSortRange = lineSize - startPos;
              let sortRange = u32(f32(maxSortRange) * params.strength);

              // Skip processing if outside sort range
              if (linePosition >= startPos + sortRange) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // Calculate relative position within sort range
              let relativePos = linePosition - startPos;

              // Bitonic sort algorithm parameters
              let blockSize = 1u << params.blockStep;     // Block size for this pass
              let compareDistance = 1u << params.subBlockStep;  // Distance between compared elements

              // Calculate block index to determine direction (ascending/descending)
              let blockIndex = relativePos / blockSize;
              let isAscending = (blockIndex % 2u) == 0u;  // Even blocks sort ascending, odd descending

              // Calculate compare position using XOR operation
              let comparePos = relativePos ^ compareDistance;

              // Skip if compare position is out of range
              if (comparePos >= sortRange) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // Get compare position color
              var targetCoord = texCoord;
              let targetPos = comparePos + startPos;

              if (isHorizontal) {
                targetCoord.x = f32(targetPos) / dims.x;
              } else {
                targetCoord.y = f32(targetPos) / dims.y;
              }

              let targetColor = textureSampleLevel(inputTexture, textureSampler, targetCoord, 0.0);

              // Get luminance values
              let v0 = getLuminance(originalColor, params.invertLight);
              let v1 = getLuminance(targetColor, params.invertLight);

              // This is critical: we only store a result when we need to swap AND
              // we're the smaller index of the pair. This prevents double-swapping.
              if (relativePos < comparePos) {
                // Determine if swap is needed
                let shouldSwap = (v0 > v1) == isAscending;

                // Select the appropriate color
                let finalColor = select(originalColor, targetColor, shouldSwap);
                textureStore(resultTexture, id.xy, finalColor);
              } else {
                // We're the higher index in the pair
                let shouldSwap = (v1 > v0) == isAscending;

                // Select the appropriate color
                let finalColor = select(originalColor, targetColor, shouldSwap);
                textureStore(resultTexture, id.xy, finalColor);
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
        label: "Bitonic Pixel Sort Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain",
        },
      });

      return { device, pipeline };
    },
    goLiveEffect: async (
      { device, pipeline },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Bitonic Pixel Sort", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // WebGPUのアラインメントに合わせてパディング
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      // テクスチャを作成
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

      // ユニフォームバッファを作成
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: 32, // 8つのパラメータ（inputDpi, baseDpi, strength, startPoint, direction, blockStep, subBlockStep, invertLight）
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

      // ユニフォームデータを更新
      const uniformData = new ArrayBuffer(32);
      const uniformView = new DataView(uniformData);

      // Params構造体にデータをセット
      uniformView.setInt32(0, dpi, true); // inputDpi
      uniformView.setInt32(4, baseDpi, true); // baseDpi
      uniformView.setFloat32(8, params.strength, true); // strength
      uniformView.setFloat32(12, params.startPoint, true); // startPoint
      uniformView.setUint32(
        16,
        params.direction === "horizontal" ? 0 : 1,
        true
      ); // direction (0:horizontal, 1:vertical)
      uniformView.setUint32(20, 0, true); // blockStep (デフォルト値0)
      uniformView.setUint32(24, 0, true); // subBlockStep (デフォルト値0)
      uniformView.setUint32(28, params.invertLight ? 1 : 0, true); // invertLight

      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // ソーステクスチャを更新
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // コンピュートシェーダを実行
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Bitonic Pixel Sort Compute Pass",
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

      // 結果を読み戻して表示
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
