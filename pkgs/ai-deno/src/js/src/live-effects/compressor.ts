import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import { createGPUDevice } from "./_shared.ts";
import {
  lerp,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";

const t = createTranslator({
  en: {
    title: "Dynamic Range Compressor",
    threshold: "Threshold",
    ratio: "Ratio",
    attack: "Attack (Radius)",
    release: "Release",
    knee: "Knee",
    makeupGain: "Makeup Gain",
    mix: "Mix",
    compressorType: "Compressor Type",
    vca: "VCA (Clean)",
    optical: "Optical (Smooth)",
    fet: "FET (Punchy)",
    tube: "Tube (Warm)",
    multiband: "Multiband",
    saturation: "Saturation",
    warmth: "Warmth",
    harmonics: "Harmonics",
    colorSeed: "Color Variance",
  },
  ja: {
    title: "ダイナミックレンジコンプレッサー",
    threshold: "スレッショルド",
    ratio: "レシオ",
    attack: "アタック（半径）",
    release: "リリース",
    knee: "ニー",
    makeupGain: "メイクアップゲイン",
    mix: "ミックス",
    compressorType: "コンプレッサータイプ",
    vca: "VCA（クリーン）",
    optical: "オプティカル（滑らか）",
    fet: "FET（パンチ）",
    tube: "チューブ（暖かみ）",
    multiband: "マルチバンド",
    saturation: "サチュレーション",
    warmth: "温かみ",
    harmonics: "ハーモニクス",
    colorSeed: "カラーバリエーション",
  },
});

export const compressor = definePlugin({
  id: "image-compressor-effect",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      threshold: {
        type: "real",
        default: 0.5,
      },
      ratio: {
        type: "real",
        default: 3.0,
      },
      attack: {
        type: "real",
        default: 5.0,
      },
      release: {
        type: "real",
        default: 50.0,
      },
      knee: {
        type: "real",
        default: 0.1,
      },
      makeupGain: {
        type: "real",
        default: 0.2,
      },
      mix: {
        type: "real",
        default: 1.0,
      },
      compressorType: {
        type: "string",
        enumValues: ["vca", "optical", "fet", "tube", "multiband"],
        default: "vca",
      },
      saturation: {
        type: "real",
        default: 0.3,
      },
      warmth: {
        type: "real",
        default: 0.3,
      },
      harmonics: {
        type: "real",
        default: 0.2,
      },
      colorSeed: {
        type: "real",
        default: 12345,
      },
    },
    onEditParameters: (params) => {
      params.threshold = Math.max(0, Math.min(1, params.threshold));
      params.ratio = Math.max(1, params.ratio);
      params.attack = Math.max(0, params.attack);
      params.release = Math.max(0, params.release);
      params.knee = Math.max(0, Math.min(1, params.knee));
      params.makeupGain = Math.max(0, Math.min(2, params.makeupGain));
      params.mix = Math.max(0, Math.min(1, params.mix));
      params.saturation = Math.max(0, Math.min(1, params.saturation));
      params.warmth = Math.max(0, Math.min(1, params.warmth));
      params.harmonics = Math.max(0, Math.min(1, params.harmonics));
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        attack: params.attack * scaleFactor,
        release: params.release * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        threshold: lerp(paramsA.threshold, paramsB.threshold, t),
        ratio: lerp(paramsA.ratio, paramsB.ratio, t),
        attack: lerp(paramsA.attack, paramsB.attack, t),
        release: lerp(paramsA.release, paramsB.release, t),
        knee: lerp(paramsA.knee, paramsB.knee, t),
        makeupGain: lerp(paramsA.makeupGain, paramsB.makeupGain, t),
        mix: lerp(paramsA.mix, paramsB.mix, t),
        compressorType:
          t < 0.5 ? paramsA.compressorType : paramsB.compressorType,
        saturation: lerp(paramsA.saturation, paramsB.saturation, t),
        warmth: lerp(paramsA.warmth, paramsB.warmth, t),
        harmonics: lerp(paramsA.harmonics, paramsB.harmonics, t),
        colorSeed: t < 0.5 ? paramsA.colorSeed : paramsB.colorSeed,
      };
    },

    renderUI: (params) => {
      const compressorTypeOptions = [
        { value: "vca", label: t("vca") },
        { value: "optical", label: t("optical") },
        { value: "fet", label: t("fet") },
        { value: "tube", label: t("tube") },
        { value: "multiband", label: t("multiband") },
      ];

      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("compressorType") }),
          ui.select({
            key: "compressorType",
            options: compressorTypeOptions,
            value: params.compressorType,
          }),
        ]),

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
          ui.text({ text: t("ratio") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "ratio",
              dataType: "float",
              min: 1,
              max: 20,
              value: params.ratio,
            }),
            ui.numberInput({
              key: "ratio",
              dataType: "float",
              value: params.ratio,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("attack") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "attack",
              dataType: "float",
              min: 0,
              max: 50,
              value: params.attack,
            }),
            ui.numberInput({
              key: "attack",
              dataType: "float",
              value: params.attack,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("release") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "release",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.release,
            }),
            ui.numberInput({
              key: "release",
              dataType: "float",
              value: params.release,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("knee") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "knee",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.knee,
            }),
            ui.numberInput({
              key: "knee",
              dataType: "float",
              value: params.knee,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("makeupGain") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "makeupGain",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.makeupGain,
            }),
            ui.numberInput({
              key: "makeupGain",
              dataType: "float",
              value: params.makeupGain,
            }),
          ]),
        ]),

        // 特定のコンプレッサータイプに関連するパラメータ
        params.compressorType === "fet" || params.compressorType === "tube"
          ? ui.group({ direction: "col" }, [
              ui.text({ text: t("saturation") }),
              ui.group({ direction: "row" }, [
                ui.slider({
                  key: "saturation",
                  dataType: "float",
                  min: 0,
                  max: 1,
                  value: params.saturation,
                }),
                ui.numberInput({
                  key: "saturation",
                  dataType: "float",
                  value: params.saturation,
                }),
              ]),
            ])
          : null,

        params.compressorType === "tube"
          ? ui.group({ direction: "col" }, [
              ui.text({ text: t("warmth") }),
              ui.group({ direction: "row" }, [
                ui.slider({
                  key: "warmth",
                  dataType: "float",
                  min: 0,
                  max: 1,
                  value: params.warmth,
                }),
                ui.numberInput({
                  key: "warmth",
                  dataType: "float",
                  value: params.warmth,
                }),
              ]),
            ])
          : null,

        params.compressorType === "tube"
          ? ui.group({ direction: "col" }, [
              ui.text({ text: t("harmonics") }),
              ui.group({ direction: "row" }, [
                ui.slider({
                  key: "harmonics",
                  dataType: "float",
                  min: 0,
                  max: 1,
                  value: params.harmonics,
                }),
                ui.numberInput({
                  key: "harmonics",
                  dataType: "float",
                  value: params.harmonics,
                }),
              ]),
            ])
          : null,

        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "colorSeed",
              dataType: "float",
              min: 1,
              max: 100000,
              step: 1,
              value: params.colorSeed,
            }),
            ui.numberInput({
              key: "colorSeed",
              dataType: "float",
              value: params.colorSeed,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("mix") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "mix",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.mix,
            }),
            ui.numberInput({
              key: "mix",
              dataType: "float",
              value: params.mix,
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: {
            label: "Image Compressor Device",
          },
        },
        async (device) => {
          const code =
            // 修正済みシェーダーコード（WGSLルールに準拠）
            // 以下のコードを元のshader変数に代入してください

            `
            struct Params {
              threshold: f32,
              ratio: f32,
              attack: f32,
              release: f32,
              knee: f32,
              makeupGain: f32,
              mix: f32,
              compressorType: u32, // 0: vca, 1: optical, 2: fet, 3: tube, 4: multiband
              saturation: f32,
              warmth: f32,
              harmonics: f32,
              colorSeed: f32,
              width: u32,
              height: u32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var tempTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(3) var<uniform> params: Params;
            @group(0) @binding(4) var textureSampler: sampler;
            @group(1) @binding(0) var tempReadTexture: texture_2d<f32>;

            // RGB to Luminance conversion
            fn getLuminance(color: vec3f) -> f32 {
              return dot(color, vec3f(0.299, 0.587, 0.114));
            }

            // Pseudo-random number generator
            fn hash(p: f32) -> f32 {
              let p2 = fract(p * 0.011);
              let p3 = p2 * (p2 + params.colorSeed);
              return fract(p3 * p3);
            }

            // Compute gain reduction based on luminance level
            fn computeGainReduction(level: f32) -> f32 {
              let threshold = params.threshold;
              let ratio = params.ratio;
              let knee = params.knee;

              if (knee <= 0.001) {
                // Hard knee
                if (level <= threshold) {
                  return 1.0; // No compression
                } else {
                  // Compression
                  return pow((level / threshold), (1.0 - 1.0/ratio));
                }
              } else {
                // Soft knee
                let kneeWidth = threshold * knee;
                let kneeStart = threshold - kneeWidth/2.0;
                let kneeEnd = threshold + kneeWidth/2.0;

                if (level <= kneeStart) {
                  return 1.0; // No compression
                } else if (level >= kneeEnd) {
                  // Full compression
                  return pow((level / threshold), (1.0 - 1.0/ratio));
                } else {
                  // Within knee region - smooth transition
                  let distance = (level - kneeStart) / kneeWidth;
                  let kneeFactor = smoothstep(0.0, 1.0, distance);
                  let linearGain = 1.0;
                  let compressedGain = pow((level / threshold), (1.0 - 1.0/ratio));
                  return linearGain * (1.0 - kneeFactor) + compressedGain * kneeFactor;
                }
              }
            }

            // VCA color processing (clean, with subtle color enhancement)
            fn vcaColorProcess(color: vec4f, gainReduction: f32) -> vec4f {
              let variance = hash(color.r + color.g + color.b) * 0.02;
              let clean = color;

              // Subtle color enhancement
              let enhanced = vec4f(
                color.rgb * (1.0 + variance * 0.5),
                color.a
              );

              return enhanced;
            }

            // Optical compressor processing (smooth transitions)
            fn opticalColorProcess(color: vec4f, gainReduction: f32) -> vec4f {
              let luma = getLuminance(color.rgb);
              let smoothFactor = 0.8 + hash(luma) * 0.4;

              // Smooth color transitions
              let opticalColor = vec4f(
                pow(color.rgb, vec3f(smoothFactor)),
                color.a
              );

              return opticalColor;
            }

            // FET compressor processing (punchy, with saturation)
            fn fetColorProcess(color: vec4f, gainReduction: f32) -> vec4f {
              let sat = params.saturation;
              let luma = getLuminance(color.rgb);

              // Increase saturation and add punch
              let satColor = mix(vec3f(luma), color.rgb, 1.0 + sat);
              let punchFactor = 1.0 + sat * (1.0 - gainReduction) * 0.5;

              return vec4f(
                satColor * punchFactor,
                color.a
              );
            }

            // Tube compressor processing (warm, with harmonics)
            fn tubeColorProcess(color: vec4f, gainReduction: f32) -> vec4f {
              let warmth = params.warmth;
              let harmonics = params.harmonics;

              // Add warmth (shift towards red/yellow)
              let warm = vec3f(
                color.r * (1.0 + warmth * 0.2),
                color.g * (1.0 + warmth * 0.1),
                color.b * (1.0 - warmth * 0.1)
              );

              // Add harmonics (non-linear color response)
              let harmFactor = harmonics * (1.0 - gainReduction);
              let secondOrder = color.rgb * color.rgb * harmFactor * 0.3;

              return vec4f(
                warm + secondOrder,
                color.a
              );
            }

            // Multiband processing for shadows, midtones, and highlights
            fn multibandColorProcess(color: vec4f, gainReduction: f32) -> vec4f {
              let luma = getLuminance(color.rgb);

              // Separate processing for shadows, midtones, and highlights
              let shadowWeight = 1.0 - smoothstep(0.0, 0.33, luma);
              let midtoneWeight = (1.0 - shadowWeight) * (1.0 - smoothstep(0.33, 0.66, luma));
              let highlightWeight = 1.0 - shadowWeight - midtoneWeight;

              // Process each band differently
              let shadowColor = tubeColorProcess(color, gainReduction).rgb;
              let midtoneColor = opticalColorProcess(color, gainReduction).rgb;
              let highlightColor = fetColorProcess(color, gainReduction).rgb;

              // Combine bands
              let multibandColor =
                shadowColor * shadowWeight +
                midtoneColor * midtoneWeight +
                highlightColor * highlightWeight;

              return vec4f(multibandColor, color.a);
            }

            // Calculate the smooth envelope for compressor in the first pass
            @compute @workgroup_size(16, 16)
            fn computeLuminanceMap(@builtin(global_invocation_id) id: vec3u) {
              let dim = vec2f(f32(params.width), f32(params.height));
              let pixel = vec2f(id.xy);
              let uv = pixel / dim;

              let color = textureSampleLevel(inputTexture, textureSampler, uv, 0.0);
              let luminance = getLuminance(color.rgb);

              // Store luminance in temp texture
              textureStore(tempTexture, id.xy, vec4f(luminance, 0.0, 0.0, 1.0));
            }

            // Apply blur to the luminance map (attack time simulation)
            @compute @workgroup_size(16, 16)
            fn blurLuminanceMap(@builtin(global_invocation_id) id: vec3u) {
              let radius = max(1.0, params.attack);
              let dim = vec2f(f32(params.width), f32(params.height));
              let pixel = vec2f(id.xy);
              let uv = pixel / dim;

              var sum = 0.0;
              var weight = 0.0;
              let samples = i32(min(40.0, radius * 2.0));

              // Gaussian-like blur
              for (var dy = -samples; dy <= samples; dy++) {
                for (var dx = -samples; dx <= samples; dx++) {
                  let offset = vec2f(f32(dx), f32(dy));
                  let sampleUv = uv + offset / dim;

                  if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
                    let dist = length(offset);
                    let kernelWeight = exp(-dist * dist / (2.0 * radius * radius));

                    let sampleValue = textureSampleLevel(tempReadTexture, textureSampler, sampleUv, 0.0).r;
                    sum += sampleValue * kernelWeight;
                    weight += kernelWeight;
                  }
                }
              }

              let blurredLuminance = sum / max(0.001, weight);

              // Apply release
              let release = max(0.01, params.release / 100.0);
              let originalLuminance = textureSampleLevel(tempReadTexture, textureSampler, uv, 0.0).r;
              let envelope = max(blurredLuminance, originalLuminance * (1.0 - release));

              textureStore(tempTexture, id.xy, vec4f(envelope, 0.0, 0.0, 1.0));
            }

            // Apply compression based on the luminance envelope
            @compute @workgroup_size(16, 16)
            fn applyCompression(@builtin(global_invocation_id) id: vec3u) {
              let dim = vec2f(f32(params.width), f32(params.height));
              let pixel = vec2f(id.xy);
              let uv = pixel / dim;

              let envelope = textureSampleLevel(tempReadTexture, textureSampler, uv, 0.0).r;
              let gainReduction = computeGainReduction(envelope);

              let originalColor = textureSampleLevel(inputTexture, textureSampler, uv, 0.0);

              // Apply compression
              let compressed = vec4f(originalColor.rgb * gainReduction, originalColor.a);

              // Apply makeup gain
              let withMakeup = vec4f(compressed.rgb * (1.0 + params.makeupGain), compressed.a);

              // Apply compressor type-specific color processing
              var processedColor = withMakeup;

              if (params.compressorType == 0u) {
                processedColor = vcaColorProcess(withMakeup, gainReduction);
              } else if (params.compressorType == 1u) {
                processedColor = opticalColorProcess(withMakeup, gainReduction);
              } else if (params.compressorType == 2u) {
                processedColor = fetColorProcess(withMakeup, gainReduction);
              } else if (params.compressorType == 3u) {
                processedColor = tubeColorProcess(withMakeup, gainReduction);
              } else if (params.compressorType == 4u) {
                processedColor = multibandColorProcess(withMakeup, gainReduction);
              }

              // Mix with original - 三項演算子の代わりにmix関数の展開
              let mixFactor = params.mix;
              let finalColor = vec4f(
                originalColor.rgb * (1.0 - mixFactor) + processedColor.rgb * mixFactor,
                originalColor.a
              );

              textureStore(outputTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Image Compressor Shader",
            code,
          });

          const luminanceMapPipeline = device.createComputePipeline({
            label: "Luminance Map Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeLuminanceMap",
            },
          });

          const blurPipeline = device.createComputePipeline({
            label: "Blur Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "blurLuminanceMap",
            },
          });

          const compressionPipeline = device.createComputePipeline({
            label: "Compression Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "applyCompression",
            },
          });

          return {
            luminanceMapPipeline,
            blurPipeline,
            compressionPipeline,
          };
        }
      );
    },
    doLiveEffect: async (
      { device, luminanceMapPipeline, blurPipeline, compressionPipeline },
      params,
      imgData,
      env
    ) => {
      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      // Create textures
      const inputTexture = device.createTexture({
        label: "ImageCompressor_InputTexture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      const outputTexture = device.createTexture({
        label: "ImageCompressor_OutputTexture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
      });

      // 2つ目の中間処理用テクスチャ（2つ目のパス用）
      const tempTexture2 = device.createTexture({
        label: "ImageCompressor_TempTexture2",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      });

      const tempTexture = device.createTexture({
        label: "ImageCompressor_TempTexture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      });

      const sampler = device.createSampler({
        label: "ImageCompressor_Sampler",
        magFilter: "linear",
        minFilter: "linear",
      });

      // Create uniform buffer
      const uniformBuffer = device.createBuffer({
        label: "ImageCompressor_UniformBuffer",
        size: 64, // Align to 16 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Map compressor type to enum
      let compressorTypeEnum = 0; // VCA (default)
      switch (params.compressorType) {
        case "vca":
          compressorTypeEnum = 0;
          break;
        case "optical":
          compressorTypeEnum = 1;
          break;
        case "fet":
          compressorTypeEnum = 2;
          break;
        case "tube":
          compressorTypeEnum = 3;
          break;
        case "multiband":
          compressorTypeEnum = 4;
          break;
      }

      // Update uniform data
      const uniformData = new ArrayBuffer(64);
      const uniformView = new Float32Array(uniformData);
      uniformView[0] = params.threshold;
      uniformView[1] = params.ratio;
      uniformView[2] = params.attack;
      uniformView[3] = params.release;
      uniformView[4] = params.knee;
      uniformView[5] = params.makeupGain;
      uniformView[6] = params.mix;
      uniformView[7] = compressorTypeEnum;
      uniformView[8] = params.saturation;
      uniformView[9] = params.warmth;
      uniformView[10] = params.harmonics;
      uniformView[11] = params.colorSeed;
      uniformView[12] = inputWidth;
      uniformView[13] = inputHeight;

      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // Write image data to input texture
      device.queue.writeTexture(
        { texture: inputTexture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // Create specialized bind groups for each pipeline
      // Luminance map pipeline bind group (first pass)
      const luminanceMapBindGroup = device.createBindGroup({
        label: "ImageCompressor_LuminanceMapBindGroup",
        layout: luminanceMapPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 2, resource: tempTexture.createView() },
          { binding: 3, resource: { buffer: uniformBuffer } },
          { binding: 4, resource: sampler },
        ],
      });

      // Blur pipeline bind group (second pass)
      const blurBindGroup = device.createBindGroup({
        label: "ImageCompressor_BlurBindGroup",
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 2, resource: tempTexture2.createView() },
          { binding: 3, resource: { buffer: uniformBuffer } },
          { binding: 4, resource: sampler },
        ],
      });

      // Blur pipeline read bind group (second pass)
      const blurReadBindGroup = device.createBindGroup({
        label: "ImageCompressor_BlurReadBindGroup",
        layout: blurPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: tempTexture.createView() }],
      });

      // Compression pipeline bind group (third pass)
      const compressionBindGroup = device.createBindGroup({
        label: "ImageCompressor_CompressionBindGroup",
        layout: compressionPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: outputTexture.createView() },
          { binding: 3, resource: { buffer: uniformBuffer } },
          { binding: 4, resource: sampler },
        ],
      });

      // Compression pipeline read bind group (third pass)
      const compressionReadBindGroup = device.createBindGroup({
        label: "ImageCompressor_CompressionReadBindGroup",
        layout: compressionPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: tempTexture2.createView() }],
      });

      // Command encoder
      const commandEncoder = device.createCommandEncoder({
        label: "ImageCompressor_CommandEncoder",
      });

      // Step 1: Compute luminance map (write to tempTexture)
      {
        const passEncoder = commandEncoder.beginComputePass({
          label: "ImageCompressor_LuminanceMapPass",
        });
        passEncoder.setPipeline(luminanceMapPipeline);
        passEncoder.setBindGroup(0, luminanceMapBindGroup);
        passEncoder.dispatchWorkgroups(
          Math.ceil(inputWidth / 16),
          Math.ceil(inputHeight / 16)
        );
        passEncoder.end();
      }

      // Step 2: Apply blur (read from tempTexture, write to tempTexture2)
      {
        const passEncoder = commandEncoder.beginComputePass({
          label: "ImageCompressor_BlurPass",
        });
        passEncoder.setPipeline(blurPipeline);
        passEncoder.setBindGroup(0, blurBindGroup);
        passEncoder.setBindGroup(1, blurReadBindGroup);
        passEncoder.dispatchWorkgroups(
          Math.ceil(inputWidth / 16),
          Math.ceil(inputHeight / 16)
        );
        passEncoder.end();
      }

      // Step 3: Apply compression (read from tempTexture2, write to outputTexture)
      {
        const passEncoder = commandEncoder.beginComputePass({
          label: "ImageCompressor_CompressionPass",
        });
        passEncoder.setPipeline(compressionPipeline);
        passEncoder.setBindGroup(0, compressionBindGroup);
        passEncoder.setBindGroup(1, compressionReadBindGroup);
        passEncoder.dispatchWorkgroups(
          Math.ceil(inputWidth / 16),
          Math.ceil(inputHeight / 16)
        );
        passEncoder.end();
      }

      // Create staging buffer for reading results
      const stagingBuffer = device.createBuffer({
        label: "ImageCompressor_StagingBuffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Copy result to staging buffer
      commandEncoder.copyTextureToBuffer(
        { texture: outputTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );

      // Submit commands
      device.queue.submit([commandEncoder.finish()]);

      // Read data from staging buffer
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      // Create result image data
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );

      // Remove padding and return
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
