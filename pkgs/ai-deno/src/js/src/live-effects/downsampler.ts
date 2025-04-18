import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../plugin.ts";
import { definePlugin, ColorRGBA } from "../plugin.ts";
import { createTranslator } from "../ui/locale.ts";
import { ChangeEventHandler, ui } from "../ui/nodes.ts";
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
    title: "Downsampler V1",
    mode: "Sampling Quality",
    bilinear: "Standard",
    bicubic: "Smooth",
    blocksX: "Horizontal Block Size",
    blocksY: "Vertical Block Size",
    linkAxes: "Link Axes",
    enableRefraction: "Enable Block Refraction",
    refraction: "Refraction Strength",
    seed: "Pattern Seed",
    patternType: "Refraction Pattern",
    blockPattern: "Block",
    ripplePattern: "Ripple",
    mixedPattern: "Mixed",
    rippleFrequency: "Ripple Frequency",
    rippleComplexity: "Ripple Complexity",
  },
  ja: {
    title: "ダウンサンプラー V1",
    mode: "サンプリング品質",
    bilinear: "ふつう",
    bicubic: "なめらか",
    blocksX: "横方向ブロックサイズ",
    blocksY: "縦方向ブロックサイズ",
    linkAxes: "縦横連動",
    enableRefraction: "ブロック屈折を有効化",
    refraction: "屈折率",
    seed: "パターンシード",
    patternType: "屈折パターン",
    blockPattern: "ブロック",
    ripplePattern: "波紋",
    mixedPattern: "ミックス",
    rippleFrequency: "波紋の頻度",
    rippleComplexity: "波紋の複雑さ",
  },
});

const MAX_BLOCKS = 48.0;

export const downsampler = definePlugin({
  id: "downsampler-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      blocksX: {
        type: "real",
        default: 2.0,
      },
      blocksY: {
        type: "real",
        default: 2.0,
      },
      linkAxes: {
        type: "bool",
        default: true,
      },
      mode: {
        type: "string",
        enum: ["bilinear", "bicubic"],
        default: "bilinear",
      },
      enableRefraction: {
        type: "bool",
        default: false,
      },
      patternType: {
        type: "string",
        enum: ["block", "ripple", "mixed"],
        default: "block",
      },
      refraction: {
        type: "real",
        default: 0.1,
      },
      seed: {
        type: "real",
        default: 1.0,
      },
      rippleFrequency: {
        type: "real",
        default: 5.0,
      },
      rippleComplexity: {
        type: "real",
        default: 3.0,
      },
    },
    onEditParameters: (params) => {
      // パラメータをそのまま返す
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      // No colors to adjust
      return params;
    },
    onScaleParams(params, scaleFactor) {
      // No need to scale parameters
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // パラメータ間の補間
      return {
        blocksX: lerp(paramsA.blocksX, paramsB.blocksX, t),
        blocksY: lerp(paramsA.blocksY, paramsB.blocksY, t),
        linkAxes: t < 0.5 ? paramsA.linkAxes : paramsB.linkAxes,
        mode: t < 0.5 ? paramsA.mode : paramsB.mode,
        enableRefraction:
          t < 0.5 ? paramsA.enableRefraction : paramsB.enableRefraction,
        patternType: t < 0.5 ? paramsA.patternType : paramsB.patternType,
        refraction: lerp(paramsA.refraction, paramsB.refraction, t),
        seed: lerp(paramsA.seed, paramsB.seed, t),
        rippleFrequency: lerp(
          paramsA.rippleFrequency,
          paramsB.rippleFrequency,
          t
        ),
        rippleComplexity: lerp(
          paramsA.rippleComplexity,
          paramsB.rippleComplexity,
          t
        ),
      };
    },

    renderUI: (params, { setParam }) => {
      const onChangeBlocksX: ChangeEventHandler = ({ value }) => {
        console.log({ value });
        setParam({ blocksX: value });
        if (params.linkAxes) setParam({ blocksY: value });
      };

      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("mode") }),
          ui.select({
            key: "mode",
            value: params.mode,
            options: [
              { label: t("bilinear"), value: "bilinear" },
              { label: t("bicubic"), value: "bicubic" }
            ]
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blocksX") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "blocksX",
              dataType: 'float',
              min: 1.0,
              max: MAX_BLOCKS,
              value: params.blocksX,
              onChange: onChangeBlocksX,
            }),
            ui.numberInput({ key: "blocksX", dataType: 'float', value: params.blocksX }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blocksY") }),
          ui.group({ direction: "row", }, [
            ui.slider({
              key: "blocksY",
              dataType: 'float',
              disabled: params.linkAxes,
              min: 1.0,
              max: MAX_BLOCKS,
              value: params.blocksY,
            }),
            ui.numberInput({
              key: "blocksY",
              dataType: 'float',
              disabled: params.linkAxes,
              value: params.blocksY,
            }),
          ]),
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({ key: "linkAxes", value: params.linkAxes, label:t("linkAxes")  }),
        ]),

        ui.separator(),

        ui.group({ direction: "row" }, [
          ui.checkbox({ key: "enableRefraction", value: params.enableRefraction, label: t("enableRefraction") }),
        ]),

        ui.group({ direction: "col", disabled: !params.enableRefraction }, [
          ui.text({ text: t("patternType") }),
          ui.select({
            key: "patternType",
            value: params.patternType,
            options: [
              { label: t("blockPattern"), value: "block" },
              { label: t("ripplePattern"), value: "ripple" },
              { label: t("mixedPattern"), value: "mixed" }
            ]
          }),
        ]),

        ui.group({ direction: "col", disabled: !params.enableRefraction }, [
          ui.text({ text: t("refraction") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "refraction",
              dataType: 'float',
              min: 0.0,
              max: 1.0,
              value: params.refraction
            }),
            ui.numberInput({ key: "refraction", dataType: 'float', value: params.refraction }),
          ]),
        ]),

        ui.group({ direction: "col", disabled: !params.enableRefraction }, [
          ui.text({ text: t("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "seed",
              dataType: 'float',
              min: 0.1,
              max: 100.0,
              value: params.seed
            }),
            ui.numberInput({ key: "seed", dataType: 'float', value: params.seed }),
          ]),
        ]),

        ui.group({
          direction: "col",
          disabled: !params.enableRefraction || params.patternType === "block"
        }, [
          ui.text({ text: t("rippleFrequency") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "rippleFrequency",
              dataType: 'float',
              min: 1.0,
              max: 20.0,
              value: params.rippleFrequency
            }),
            ui.numberInput({ key: "rippleFrequency", dataType: 'float', value: params.rippleFrequency }),
          ]),
        ]),

        ui.group({
          direction: "col",
          disabled: !params.enableRefraction || params.patternType === "block"
        }, [
          ui.text({ text: t("rippleComplexity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "rippleComplexity",
              dataType: 'float',
              min: 1.0,
              max: 10.0,
              value: params.rippleComplexity
            }),
            ui.numberInput({ key: "rippleComplexity", dataType: 'float', value: params.rippleComplexity }),
          ]),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Downsampler)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              blocksX: f32,
              blocksY: f32,
              mode: i32,            // 0: bilinear, 1: bicubic
              enableRefraction: i32, // 0: disabled, 1: enabled
              patternType: i32,     // 0: block, 1: ripple, 2: mixed
              refraction: f32,
              seed: f32,
              rippleFrequency: f32,
              rippleComplexity: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Hash function for pseudo-random number generation
            fn hash21(p: vec2f) -> f32 {
              var n = dot(p, vec2f(127.1, 311.7));
              return fract(sin(n) * 43758.5453);
            }

            // Cubic weight function for bicubic sampling
            fn cubicWeight(x: f32) -> f32 {
              let absX = abs(x);
              if (absX < 1.0) {
                return (1.5 * absX - 2.5) * absX * absX + 1.0;
              } else if (absX < 2.0) {
                return ((-0.5 * absX + 2.5) * absX - 4.0) * absX + 2.0;
              }
              return 0.0;
            }

            // Bicubic texture sampling at a given coordinate with pre-calculated dimensions
            fn sampleBicubic(texCoord: vec2f, dims: vec2f, scale: vec2f) -> vec4f {
              let adjustedCoord = texCoord * scale;

              let texelSize = 1.0 / dims;

              let tc = adjustedCoord * dims - 0.5;
              let fxy = fract(tc);
              let ixy = tc - fxy;

              // Calculate bicubic weights
              var wx: array<f32, 4>;
              var wy: array<f32, 4>;

              for (var i = 0u; i < 4u; i++) {
                wx[i] = cubicWeight(f32(i) - 1.0 - fxy.x);
                wy[i] = cubicWeight(f32(i) - 1.0 - fxy.y);
              }

              // Normalize weights
              let sumX = wx[0] + wx[1] + wx[2] + wx[3];
              let sumY = wy[0] + wy[1] + wy[2] + wy[3];

              for (var i = 0u; i < 4u; i++) {
                wx[i] = wx[i] / sumX;
                wy[i] = wy[i] / sumY;
              }

              var color = vec4f(0.0);

              // Sample 16 texels and apply weights
              for (var y = 0u; y < 4u; y++) {
                for (var x = 0u; x < 4u; x++) {
                  let samplePos = vec2f(
                    (ixy.x + f32(x) - 1.0) * texelSize.x,
                    (ixy.y + f32(y) - 1.0) * texelSize.y
                  );

                  // Clamp to valid texture coordinates
                  let clampedPos = clamp(samplePos, vec2f(0.0), vec2f(1.0) - texelSize);
                  let sample = textureSampleLevel(inputTexture, textureSampler, clampedPos, 0.0);

                  color += sample * wx[x] * wy[y];
                }
              }

              return color;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let textureDims = vec2f(textureDimensions(inputTexture));
              let outputDims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / outputDims;
              let toInputTexCoord = outputDims / textureDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let blocksX = params.blocksX;
              let blocksY = params.blocksY;

              let blockX = floor(texCoord.x * blocksX);
              let blockY = floor(texCoord.y * blocksY);
              let blockPos = vec2f(blockX, blockY);

              let blockUV = fract(texCoord * vec2f(blocksX, blocksY));

              let scaledCoordX = (blockX + 0.5) / blocksX;
              let scaledCoordY = (blockY + 0.5) / blocksY;

              // Base sampling coordinate (block center)
              var downscaledCoord = vec2f(scaledCoordX, scaledCoordY);

              // Apply refraction if enabled
              if (params.enableRefraction != 0) {
                var displacement = vec2f(0.0);

              if (params.patternType == 0) { // Block pattern
                let blockHash = hash21(blockPos + vec2f(params.seed));
                let angle = blockHash * 6.28;
                let blockDir = vec2f(cos(angle), sin(angle));
                let distanceFromCenter = length(blockUV - vec2f(0.5));
                displacement = blockDir * distanceFromCenter;
                } else if (params.patternType == 1) { // Ripple pattern
                var combinedDisplacement = vec2f(0.0);
                let maxCenters = min(params.rippleComplexity * 2.0, 12.0);

                let seedOffset = vec2f(sin(params.seed * 0.1), cos(params.seed * 0.1));
                let p = texCoord + seedOffset;

                let mainCenter = vec2f(0.5) + vec2f(sin(params.seed * 0.753) * 0.2, cos(params.seed * 0.371) * 0.2);

                for (var c = 0.0; c < maxCenters; c += 1.0) {
                  let centerOffset = vec2f(
                    sin(params.seed * 1.7 + c * 3.33) * 0.3,
                    cos(params.seed * 2.1 + c * 2.72) * 0.3
                  );

                  let center = mainCenter + centerOffset * (0.4 + c * 0.05);
                  let baseDistance = length(p - center);
                  let noiseScale = hash21(p * (c + 1.0) + vec2f(params.seed)) * 0.15;
                  let distortedDist = baseDistance * (1.0 + noiseScale);
                  let centerFreq = params.rippleFrequency * (0.8 + hash21(vec2f(c, params.seed)) * 0.4);
                  let phase = params.seed * (c + 1.0) * 0.3;

                  let rippleValue = sin(distortedDist * centerFreq * 6.28 + phase);
                  let dir = normalize(p - center);
                  let strength = (1.0 / (c + 1.0)) * 0.5;
                  let organicFactor = sin(distortedDist * centerFreq * 3.14 + phase * 1.5) * 0.2;

                  let warpedDir = vec2f(
                    dir.x + sin(dir.y * 5.0 + params.seed) * 0.2,
                    dir.y + cos(dir.x * 5.0 + params.seed) * 0.2
                  );

                  combinedDisplacement += warpedDir * (rippleValue + organicFactor) * strength;
                }

                displacement = combinedDisplacement;
                } else if (params.patternType == 2) { // Mixed pattern
                let blockHash = hash21(blockPos + vec2f(params.seed));
                let angle = blockHash * 6.28;
                let blockDir = vec2f(cos(angle), sin(angle));
                let distanceFromCenter = length(blockUV - vec2f(0.5));
                let blockDisp = blockDir * distanceFromCenter;

                  // Ripple pattern
                  let seedOffset = vec2f(sin(params.seed * 0.1), cos(params.seed * 0.1));
                  let p = texCoord + seedOffset;
                  let center = vec2f(0.5) + vec2f(sin(params.seed * 0.753) * 0.2, cos(params.seed * 0.371) * 0.2);
                  let dist = length(p - center);
                  let baseRipple = sin(dist * params.rippleFrequency * 6.28);

                  var rippleSum = baseRipple;
                  let maxComplexity = min(params.rippleComplexity, 10.0);

                  for (var i = 1.0; i < maxComplexity; i += 1.0) {
                    let offset = vec2f(
                      sin(params.seed * 0.1 + i * 0.37),
                      cos(params.seed * 0.1 + i * 0.53)
                    ) * 0.4;

                    let altCenter = center + offset;
                    let altDist = length(p - altCenter);
                    let altFreq = params.rippleFrequency * (0.5 + i * 0.2);
                    let altPhase = params.seed * i * 0.1;
                    let altRipple = sin(altDist * altFreq * 6.28 + altPhase);
                    rippleSum += altRipple / i;
                  }

                  rippleSum /= maxComplexity;
                  let dir = normalize(p - center);
                  let rippleDisp = dir * rippleSum;

                  // Mix both patterns
                  displacement = blockDisp * 0.5 + rippleDisp * 0.5;
                } else { // Default fallback to block
                let blockHash = hash21(blockPos + vec2f(params.seed));
                let angle = blockHash * 6.28;
                let blockDir = vec2f(cos(angle), sin(angle));
                let distanceFromCenter = length(blockUV - vec2f(0.5));
                displacement = blockDir * distanceFromCenter;
                }

                // Scale displacement by refraction strength
                let refractStrength = params.refraction * 0.2;
                downscaledCoord += displacement * refractStrength;

                // Clamp to prevent sampling outside texture
                downscaledCoord = clamp(downscaledCoord, vec2f(0.0), vec2f(1.0));
              }

              let finalSampleCoord = downscaledCoord * toInputTexCoord;

              var finalColor: vec4f;

              if (params.mode == 0) { // Bilinear
                finalColor = textureSampleLevel(inputTexture, textureSampler, finalSampleCoord, 0.0);
              } else { // Bicubic
                finalColor = sampleBicubic(downscaledCoord, textureDims, toInputTexCoord);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Downsampler Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Downsampler Pipeline",
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
      console.log(
        "Downsampler V1",
        params,
        "Device DPI:",
        dpi,
        "Base DPI:",
        baseDpi,
        "Raw size:",
        imgData.width,
        "x",
        imgData.height
      );

      const modeValue = params.mode === "bilinear" ? 0 : 1;

      // Maintain original dimensions - we're not actually resizing the output
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      // Ensure proper WebGPU alignment
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width;
      const inputHeight = imgData.height;

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

      // Result texture is same size as input
      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Texture Sampler",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        blocksX: params.blocksX,
        blocksY: params.blocksY,
        mode: modeValue,
        enableRefraction: params.enableRefraction ? 1 : 0,
        patternType:
          params.patternType === "block"
            ? 0
            : params.patternType === "ripple"
            ? 1
            : 2,
        refraction: params.refraction,
        seed: params.seed,
        rippleFrequency: params.rippleFrequency,
        rippleComplexity: params.rippleComplexity,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

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
        label: "Downsampler Compute Pass",
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

      // Remove padding and return properly sized image
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
