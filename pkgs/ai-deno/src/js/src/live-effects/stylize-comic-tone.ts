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
import { createGPUDevice } from "./_shared.ts";

// Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Comic Tone V1",
    toneType: "Tone Type",
    dot: "Dot",
    line: "Line",
    crosshatch: "Crosshatch",
    colorMode: "Color Mode",
    originalColor: "Sample Original",
    monochrome: "Monochrome",
    size: "Size (px)",
    spacing: "Spacing (px)",
    angle: "Angle",
    threshold: "Brightness Cutoff",
    toneColor: "Tone Color",
    reversePattern: "Reverse Pattern",
    useLuminance: "Size by Luminance",
    luminanceStrength: "Luminance Strength",
    invertDotSize: "Invert Dot Size",
    showOriginalUnderDots: "Show Original Under Dots",
  },
  ja: {
    title: "マンガトーン V1",
    toneType: "トーンタイプ",
    dot: "ドット",
    line: "ライン",
    crosshatch: "クロス",
    colorMode: "カラーモード",
    originalColor: "元カラーをサンプル",
    monochrome: "モノトーン",
    size: "サイズ (px)",
    spacing: "間隔 (px)",
    angle: "角度",
    threshold: "明るさカットオフ",
    toneColor: "トーン色",
    reversePattern: "パターンを反転",
    useLuminance: "輝度でサイズ変更",
    luminanceStrength: "輝度の影響度",
    invertDotSize: "ドットサイズを反転",
    showOriginalUnderDots: "ドット下に元画像を表示",
  },
});

// Define tone types
const TONE_TYPES = {
  DOT: "dot",
  LINE: "line",
  CROSSHATCH: "crosshatch",
};

// Define color modes
const COLOR_MODES = {
  ORIGINAL: "original",
  MONOCHROME: "monochrome",
};

export const comicTone = definePlugin({
  id: "comic-tone-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Stylize",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      toneType: {
        type: "string",
        enum: [TONE_TYPES.DOT, TONE_TYPES.LINE, TONE_TYPES.CROSSHATCH],
        default: TONE_TYPES.DOT,
      },
      colorMode: {
        type: "string",
        enum: [COLOR_MODES.ORIGINAL, COLOR_MODES.MONOCHROME],
        default: COLOR_MODES.ORIGINAL,
      },
      size: {
        type: "real",
        default: 3.0,
      },
      spacing: {
        type: "real",
        default: 10.0,
      },
      angle: {
        type: "real",
        default: 45.0,
      },
      threshold: {
        type: "real",
        default: 1.0,
      },
      reversePattern: {
        type: "bool",
        default: false,
      },
      showOriginalUnderDots: {
        type: "bool",
        default: true,
      },
      useLuminance: {
        type: "bool",
        default: true,
      },
      luminanceStrength: {
        type: "real",
        default: 0.5,
      },
      invertDotSize: {
        type: "bool",
        default: false,
      },
      toneColor: {
        type: "color",
        default: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    },
    onEditParameters: (params) => {
      // Ensure parameters are within valid ranges
      return {
        ...params,
        size: Math.max(0.5, params.size),
        spacing: Math.max(1.0, params.spacing),
        threshold: Math.max(0.0, Math.min(1.0, params.threshold)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        toneColor: adjustColor(params.toneColor),
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        size: params.size * scaleFactor,
        spacing: params.spacing * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        toneType: t < 0.5 ? paramsA.toneType : paramsB.toneType,
        colorMode: t < 0.5 ? paramsA.colorMode : paramsB.colorMode,
        size: lerp(paramsA.size, paramsB.size, t),
        spacing: lerp(paramsA.spacing, paramsB.spacing, t),
        angle: lerp(paramsA.angle, paramsB.angle, t),
        threshold: lerp(paramsA.threshold, paramsB.threshold, t),
        reversePattern:
          t < 0.5 ? paramsA.reversePattern : paramsB.reversePattern,
        showOriginalUnderDots:
          t < 0.5
            ? paramsA.showOriginalUnderDots
            : paramsB.showOriginalUnderDots,
        useLuminance: t < 0.5 ? paramsA.useLuminance : paramsB.useLuminance,
        luminanceStrength: lerp(
          paramsA.luminanceStrength,
          paramsB.luminanceStrength,
          t
        ),
        invertDotSize: t < 0.5 ? paramsA.invertDotSize : paramsB.invertDotSize,
        toneColor: {
          r: lerp(paramsA.toneColor.r, paramsB.toneColor.r, t),
          g: lerp(paramsA.toneColor.g, paramsB.toneColor.g, t),
          b: lerp(paramsA.toneColor.b, paramsB.toneColor.b, t),
          a: lerp(paramsA.toneColor.a, paramsB.toneColor.a, t),
        },
      };
    },

    renderUI: (params, { setParam }) => {
      const toneColorStr = toColorCode(params.toneColor);

      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("toneType") }),
          ui.select({
            key: "toneType",
            value: params.toneType,
            options: [
              { label: t("dot"), value: TONE_TYPES.DOT },
              { label: t("line"), value: TONE_TYPES.LINE },
              { label: t("crosshatch"), value: TONE_TYPES.CROSSHATCH },
            ],
          }),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorMode") }),
          ui.select({
            key: "colorMode",
            value: params.colorMode,
            options: [
              { label: t("originalColor"), value: COLOR_MODES.ORIGINAL },
              { label: t("monochrome"), value: COLOR_MODES.MONOCHROME },
            ],
          }),
        ]),

        params.colorMode === COLOR_MODES.ORIGINAL &&
        params.toneType === TONE_TYPES.DOT
          ? null
          : null,

        ui.group({ direction: "col" }, [
          ui.text({ text: t("size") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "size",
              dataType: "float",
              min: 0.5,
              max: 20,
              value: params.size,
            }),
            ui.numberInput({
              key: "size",
              dataType: "float",
              value: params.size,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("spacing") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "spacing",
              dataType: "float",
              min: 1,
              max: 40,
              value: params.spacing,
            }),
            ui.numberInput({
              key: "spacing",
              dataType: "float",
              value: params.spacing,
            }),
          ]),
        ]),

        params.toneType !== TONE_TYPES.DOT
          ? ui.group({ direction: "col" }, [
              ui.text({ text: t("angle") }),
              ui.group({ direction: "row" }, [
                ui.slider({
                  key: "angle",
                  dataType: "float",
                  min: 0,
                  max: 180,
                  value: params.angle,
                }),
                ui.numberInput({
                  key: "angle",
                  dataType: "float",
                  value: params.angle,
                }),
              ]),
            ])
          : null,

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

        // ui.checkbox({
        //   key: "reversePattern",
        //   label: t("reversePattern"),
        //   value: params.reversePattern,
        // }),

        params.toneType === TONE_TYPES.DOT
          ? ui.checkbox({
              key: "showOriginalUnderDots",
              label: t("showOriginalUnderDots"),
              value: params.showOriginalUnderDots,
            })
          : null,

        ui.checkbox({
          key: "useLuminance",
          label: t("useLuminance"),
          value: params.useLuminance,
        }),

        params.useLuminance
          ? ui.group({ direction: "col" }, [
              ui.checkbox({
                key: "invertDotSize",
                label: t("invertDotSize"),
                value: params.invertDotSize,
              }),
              ui.text({ text: t("luminanceStrength") }),
              ui.group({ direction: "row" }, [
                ui.slider({
                  key: "luminanceStrength",
                  dataType: "float",
                  min: 0,
                  max: 1,
                  value: params.luminanceStrength,
                }),
                ui.numberInput({
                  key: "luminanceStrength",
                  dataType: "float",
                  value: params.luminanceStrength,
                }),
              ]),
            ])
          : null,

        params.colorMode === COLOR_MODES.MONOCHROME
          ? ui.group({ direction: "col" }, [
              ui.text({ text: t("toneColor") }),
              ui.group({ direction: "row" }, [
                ui.colorInput({ key: "toneColor", value: params.toneColor }),
                ui.textInput({
                  key: "toneColorInput",
                  value: toneColorStr,
                  onChange: (e) => {
                    setParam({ toneColor: parseColorCode(e.value)! });
                  },
                }),
              ]),
            ])
          : null,
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Comic Tone V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              toneType: u32,
              colorMode: u32,
              size: f32,
              spacing: f32,
              angle: f32,
              threshold: f32,
              reversePattern: u32,
              showOriginalUnderDots: u32,
              useLuminance: u32,
              luminanceStrength: f32,
              invertDotSize: u32,
              toneColor: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Constants for tone type
            const TONE_DOT = 0u;
            const TONE_LINE = 1u;
            const TONE_CROSSHATCH = 2u;

            // Constants for color mode
            const COLOR_ORIGINAL = 0u;
            const COLOR_MONOCHROME = 1u;

            // Custom modulo function for floating point values
            fn mod_f32(x: f32, y: f32) -> f32 {
              return x - y * floor(x / y);
            }

            // Creates dot pattern at the given position with size affected by luminance
            fn createDotPattern(pos: vec2f, baseSize: f32, spacing: f32, luminance: f32, useLuminance: u32, luminanceStrength: f32, invertDotSize: u32) -> f32 {
              let scaledPos = pos / spacing;
              let cell = floor(scaledPos);
              let cellCenter = (cell + 0.5) * spacing;

              // Calculate size based on luminance if enabled
              var size = baseSize;
              if (useLuminance != 0u) {
                var luminanceEffect = luminance;

                // Invert luminance effect if needed
                if (invertDotSize != 0u) {
                  luminanceEffect = 1.0 - luminanceEffect;
                }

                // Apply luminance effect based on strength parameter
                // Size varies from 0.2x to 1.8x of the base size
                let sizeFactor = mix(0.2, 1.8, luminanceEffect);
                size = baseSize * mix(1.0, sizeFactor, luminanceStrength);
              }

              let dist = distance(pos, cellCenter);
              return 1.0 - smoothstep(size * 0.5 - 1.0, size * 0.5, dist);
            }

            // Creates line pattern at the given position and angle
            fn createLinePattern(pos: vec2f, size: f32, spacing: f32, angleRad: f32) -> f32 {
              let rotatedPos = vec2f(
                pos.x * cos(angleRad) - pos.y * sin(angleRad),
                pos.x * sin(angleRad) + pos.y * cos(angleRad)
              );
              let modPos = abs(mod_f32(rotatedPos.y, spacing));
              // Fixed: Size parameter now directly controls line thickness
              return smoothstep(size, size - 1.0, modPos);
            }

            // Creates crosshatch pattern by combining two line patterns at perpendicular angles
            fn createCrosshatchPattern(pos: vec2f, size: f32, spacing: f32, angleRad: f32) -> f32 {
              let pattern1 = createLinePattern(pos, size, spacing, angleRad);
              let pattern2 = createLinePattern(pos, size, spacing, angleRad + 1.5708); // 90 degrees
              return max(pattern1, pattern2);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // Handle straight alpha (non-premultiplied)
              // Safely get RGB components considering alpha to avoid division by zero
              var straightRgb = originalColor.rgb;
              if (originalColor.a > 0.001) {
                // Convert from premultiplied to straight alpha if needed
                straightRgb = straightRgb / originalColor.a;
              }

              // Calculate brightness for threshold comparison using straight RGB
              let brightness = (straightRgb.r + straightRgb.g + straightRgb.b) / 3.0;

              // Apply DPI scaling to size and spacing
              var scaledSize = params.size * params.dpiScale;
              let scaledSpacing = params.spacing * params.dpiScale;

              // Adjust size based on luminance if enabled
              if (params.useLuminance != 0u) {
                var luminanceEffect = brightness;

                // Invert luminance effect if needed - ONLY affects size calculation, not color
                if (params.invertDotSize != 0u) {
                  luminanceEffect = 1.0 - luminanceEffect;
                }

                // Apply luminance effect based on strength parameter
                // Scale between 0.2x and 2x of the base size
                let sizeFactor = mix(0.2, 2.0, luminanceEffect);
                scaledSize = scaledSize * mix(1.0, sizeFactor, params.luminanceStrength);
              }

              // Calculate angle in radians
              let angleRad = params.angle * 3.14159265359 / 180.0;

              // Generate tone pattern based on selected type
              var pattern = 0.0;
              let pixelPos = vec2f(id.xy);

              // Check for alpha edge - pixels with alpha but surrounded by transparent pixels often cause edge artifacts
              var isAlphaEdge = false;
              if (originalColor.a > 0.01 && originalColor.a < 0.99) {
                // Simple edge detection - sample surrounding pixels
                // Use DPI-independent sampling distance
                let sampleDistance = 1.0 / params.dpiScale;
                // Apply edge correction factor
                var edgeCount = 0;

                // Sample in cardinal directions
                for (var dx = -1; dx <= 1; dx++) {
                  for (var dy = -1; dy <= 1; dy++) {
                    if (dx == 0 && dy == 0) { continue; } // Skip center

                    // Convert integer dx, dy to float for the vector math
                    let fdx = f32(dx);
                    let fdy = f32(dy);
                    // Scale sampling distance by DPI to ensure consistent behavior
                    let neighborCoord = texCoord + vec2f(fdx, fdy) * (vec2f(sampleDistance, sampleDistance) / dims);
                    // Skip out of bounds
                    if (neighborCoord.x < 0.0 || neighborCoord.x > 1.0 || neighborCoord.y < 0.0 || neighborCoord.y > 1.0) {
                      continue;
                    }

                    let neighborColor = textureSampleLevel(inputTexture, textureSampler, neighborCoord * toInputTexCoord, 0.0);
                    // Adjust threshold based on DPI scale for consistent detection
                    // Apply edge correction factor to fine-tune sensitivity
                    let alphaThreshold = (0.3 / sqrt(params.dpiScale));
                    if (abs(neighborColor.a - originalColor.a) > alphaThreshold) {
                      edgeCount++;
                    }
                  }
                }

                // If we have enough surrounding pixels with different alpha, consider this an edge
                // For higher DPI, require more evidence to classify as an edge
                // Apply edge correction factor to threshold
                let edgeThreshold = max(2.0, min(4.0, 2.0 * sqrt(params.dpiScale)));
                isAlphaEdge = f32(edgeCount) >= edgeThreshold;
              }

              if (params.toneType == TONE_DOT) {
                // For dot pattern, we will directly check dot membership later
                // and not use the pattern value
                pattern = 0.0;
              } else if (params.toneType == TONE_LINE) {
                pattern = createLinePattern(pixelPos, scaledSize, scaledSpacing, angleRad);
              } else if (params.toneType == TONE_CROSSHATCH) {
                pattern = createCrosshatchPattern(pixelPos, scaledSize, scaledSpacing, angleRad);
              }

              // Apply brightness threshold and pattern reversal
              var toneValue = pattern;

              // Apply pattern reversal if needed
              if (params.reversePattern != 0u) {
                toneValue = 1.0 - toneValue;
              }

              // For non-dot patterns: skip drawing pattern where brightness >= threshold
              // Also skip at alpha edges to prevent artifacts
              if (brightness >= params.threshold || isAlphaEdge) {
                toneValue = 0.0;
              }

              // Determine final color based on color mode and tone type
              var finalColor: vec4f;

              if (params.toneType == TONE_DOT) {
                // Special processing for dot pattern
                // Calculate which dot cell this pixel belongs to
                let scaledPos = pixelPos / scaledSpacing;
                let cell = floor(scaledPos);
                let cellCenter = (cell + 0.5) * scaledSpacing;

                // Calculate distance from this pixel to cell center
                let distToDotCenter = distance(pixelPos, cellCenter);

                // Basic dot radius (half the size)
                let baseRadius = scaledSize * 0.5;

                // Get the luminance at the dot cell center and adjust dot size based on it
                let dotCenterTexCoord = cellCenter / dims;
                var finalDotRadius = baseRadius;
                var skipDot = false;
                var dotCenterBrightness = 0.0;
                var dotCenterColor = vec4f(0.0, 0.0, 0.0, 1.0);
                // Declare this variable at a higher scope level
                var straightDotRgb = vec3f(0.0, 0.0, 0.0);

                if (dotCenterTexCoord.x <= 1.0 && dotCenterTexCoord.y <= 1.0) {
                  // Sample the color at cell center
                  dotCenterColor = textureSampleLevel(inputTexture, textureSampler, dotCenterTexCoord * toInputTexCoord, 0.0);

                  // Handle straight alpha for dot center color (updating the variable declared above)
                  straightDotRgb = dotCenterColor.rgb;
                  if (dotCenterColor.a > 0.001) {
                    // Convert from premultiplied to straight alpha if needed
                    straightDotRgb = straightDotRgb / dotCenterColor.a;
                  }

                  // Calculate brightness based on straight RGB
                  dotCenterBrightness = (straightDotRgb.r + straightDotRgb.g + straightDotRgb.b) / 3.0;

                  // Check if brightness exceeds threshold - if so, don't draw dot
                  // Also skip dots at alpha edges
                  if (dotCenterBrightness >= params.threshold || isAlphaEdge) {
                    skipDot = true;
                  }

                  // Size adjustment based on luminance
                  if (!skipDot && params.useLuminance != 0u) {
                    var luminanceEffect = dotCenterBrightness;

                    // Invert luminance effect if needed
                    if (params.invertDotSize != 0u) {
                      luminanceEffect = 1.0 - luminanceEffect;
                    }

                    // Size calculation: ranging from 0.5x to 1.5x (middle value is 1.0x)
                    let sizeFactor = mix(0.5, 1.5, luminanceEffect);
                    finalDotRadius = baseRadius * mix(1.0, sizeFactor, params.luminanceStrength);
                  }
                }

                // Determine if pixel is inside dot using the adjusted radius AND not skipped due to threshold
                let isInsideDot = !skipDot && distToDotCenter < finalDotRadius;

                if (isInsideDot) {
                  // Inside dot - use color sampled from center
                  if (params.colorMode == COLOR_ORIGINAL) {
                    // Use straight RGB for calculating the final color
                    var resultAlpha = dotCenterColor.a;
                    var resultRgb = vec3f(0.0);

                    // Multiply straight RGB values
                    if (originalColor.a > 0.001 && dotCenterColor.a > 0.001) {
                      resultRgb = straightDotRgb * straightRgb;
                    }

                    // Convert back to premultiplied alpha for output
                    finalColor = vec4f(resultRgb * resultAlpha, resultAlpha);
                  } else {
                    // Use tone color in monochrome mode
                    // Apply the alpha from dot center color
                    finalColor = vec4f(params.toneColor.rgb * dotCenterColor.a, dotCenterColor.a);
                  }
                } else {
                  // Outside dot - show original image or make completely transparent
                  if (params.showOriginalUnderDots != 0u) {
                    finalColor = originalColor;
                  } else {
                    finalColor = vec4f(0.0, 0.0, 0.0, 0.0); // Completely transparent
                  }
                }
              } else {
                // Other tone patterns (line, crosshatch)
                let alpha = originalColor.a;

                if (params.colorMode == COLOR_ORIGINAL) {
                  // For original color mode
                  if (toneValue > 0.5) {
                    // Tone pattern area (white in traditional tone)
                    // For alpha edges, create a smoother transition
                    if (isAlphaEdge) {
                      // Mix with original color to prevent white edges
                      // For higher DPI, use more subtle blending
                      let edgeFactor = min(0.7, originalColor.a) / pow(params.dpiScale, 0.25);
                      let whiteColor = vec4f(alpha, alpha, alpha, alpha);
                      finalColor = mix(originalColor, whiteColor, edgeFactor);
                    } else {
                      // Use premultiplied alpha for output
                      finalColor = vec4f(alpha, alpha, alpha, alpha);
                    }
                  } else {
                    // Non-tone area (keeping original color)
                    // Original color already has correct alpha handling
                    finalColor = originalColor;
                  }
                } else {
                  // Monochrome with tone pattern
                  if (toneValue > 0.5) {
                    // Tone pattern area (white in traditional tone)
                    if (isAlphaEdge) {
                      // Mix with tone color to prevent white edges
                      // For higher DPI, use more subtle blending
                      let edgeFactor = min(0.7, originalColor.a) / pow(params.dpiScale, 0.25);
                      let whiteColor = vec4f(alpha, alpha, alpha, alpha);
                      let toneColorPremult = vec4f(params.toneColor.rgb * alpha, alpha);
                      finalColor = mix(toneColorPremult, whiteColor, edgeFactor);
                    } else {
                      // Use premultiplied alpha for output
                      finalColor = vec4f(alpha, alpha, alpha, alpha);
                    }
                  } else {
                    // Non-tone area (using tone color)
                    // Apply premultiplied alpha for output
                    finalColor = vec4f(params.toneColor.rgb * alpha, alpha);
                  }
                }
              }

              // Apply alpha cutoff from original image
              if (originalColor.a < 0.01) {
                finalColor = vec4f(0.0, 0.0, 0.0, 0.0);
              } else if (finalColor.a > 0.0 && finalColor.a < 0.05) {
                // For very low but non-zero alpha, use original color but with reduced alpha
                // This helps prevent "ghost" edges
                finalColor = vec4f(originalColor.rgb, originalColor.a * 0.5);
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Comic Tone V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Comic Tone V1 Pipeline",
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
      console.log("Comic Tone V1", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Add WebGPU alignment padding and handle straight alpha if needed
      imgData = await addWebGPUAlignmentPadding(imgData, true); // Pass true to indicate straight alpha handling

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Comic Tone Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Comic Tone Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Comic Tone Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Comic Tone Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Map tone type and color mode to numeric values for shader
      const toneTypeMap = {
        [TONE_TYPES.DOT]: 0,
        [TONE_TYPES.LINE]: 1,
        [TONE_TYPES.CROSSHATCH]: 2,
      };

      const colorModeMap = {
        [COLOR_MODES.ORIGINAL]: 0,
        [COLOR_MODES.MONOCHROME]: 1,
      };

      // Set uniform values
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        toneType: toneTypeMap[params.toneType],
        colorMode: colorModeMap[params.colorMode],
        size: params.size,
        spacing: params.spacing,
        angle: params.angle,
        threshold: params.threshold,
        reversePattern: params.reversePattern ? 1 : 0,
        showOriginalUnderDots: params.showOriginalUnderDots ? 1 : 0,
        useLuminance: params.useLuminance ? 1 : 0,
        luminanceStrength: params.luminanceStrength,
        invertDotSize: params.invertDotSize ? 1 : 0,
        toneColor: [
          params.toneColor.r,
          params.toneColor.g,
          params.toneColor.b,
          params.toneColor.a,
        ],
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Comic Tone Main Bind Group",
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
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Comic Tone Compute Pass",
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
