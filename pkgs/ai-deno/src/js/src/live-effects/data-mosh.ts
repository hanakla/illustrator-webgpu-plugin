import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
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
  createCanvas,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

// Helper function to calculate necessary padding based on parameters
function calculatePaddingNeeded(params, dpiScale, width, height) {
  // Base padding calculation with intensity and blockSize
  const intensityPadding = Math.ceil(
    params.intensity * 5 * params.blockSize * dpiScale
  );

  // Additional padding for pixel shuffle effect
  const shufflePadding = Math.ceil(
    params.pixelShuffle * Math.max(width, height) * 0.5 * dpiScale
  );

  // Additional padding for line shift effect
  const lineShiftPadding = Math.ceil(params.lineShift * width * 0.3 * dpiScale);

  // Additional padding for glitch effect
  const glitchPadding = Math.ceil(
    params.glitchFactor * Math.max(width, height) * 0.5 * dpiScale
  );

  // Color shift padding
  const colorShiftPadding = Math.ceil(
    params.colorShift * Math.max(width, height) * 0.05 * dpiScale
  );

  // Calculate the total padding needed (maximum of all effects)
  return Math.max(
    intensityPadding,
    shufflePadding,
    lineShiftPadding,
    glitchPadding,
    colorShiftPadding
  );
}

const t = createTranslator({
  en: {
    title: "DataMosh Extreme",
    intensity: "Intensity",
    blockSize: "Block Size",
    direction: "Direction",
    horizontal: "Horizontal",
    vertical: "Vertical",
    both: "Both",
    seed: "Randomness Seed",
    colorShift: "Color Shift",
    glitchFactor: "Glitch Factor",
    pixelShuffle: "Pixel Shuffle",
    lineShift: "Line Shift",
    corruption: "Corruption",
    bitCorruption: "Bit Corruption",
    bitShift: "Bit Shift",
    headerGlitch: "Header Glitch",
  },
  ja: {
    title: "データモッシュ極限",
    intensity: "強度",
    blockSize: "ブロックサイズ",
    direction: "方向",
    horizontal: "水平",
    vertical: "垂直",
    both: "両方",
    seed: "ランダムシード",
    colorShift: "色ずれ",
    glitchFactor: "グリッチ係数",
    pixelShuffle: "ピクセルシャッフル",
    lineShift: "ライン移動",
    corruption: "破損効果",
    bitCorruption: "ビット破損",
    bitShift: "ビットシフト",
    headerGlitch: "ヘッダーグリッチ",
  },
});

export const dataMosh = definePlugin({
  id: "datamosh-filter",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 0.5,
      },
      blockSize: {
        type: "int",
        default: 8,
      },
      direction: {
        type: "string",
        enum: ["horizontal", "vertical", "both"],
        default: "both",
      },
      seed: {
        type: "int",
        default: 42,
      },
      colorShift: {
        type: "real",
        default: 0.2,
      },
      glitchFactor: {
        type: "real",
        default: 0.3,
      },
      pixelShuffle: {
        type: "real",
        default: 0.2,
      },
      lineShift: {
        type: "real",
        default: 0.0,
      },
      corruption: {
        type: "real",
        default: 0.0,
      },
      bitCorruption: {
        type: "real",
        default: 0.0,
      },
      bitShift: {
        type: "int",
        default: 0,
      },
      headerGlitch: {
        type: "real",
        default: 0.0,
      },
    },
    onEditParameters: (params) => {
      // Normalize parameters
      const intensity = Math.max(0, Math.min(2, params.intensity));
      const blockSize = Math.max(1, Math.min(64, params.blockSize));
      const seed = Math.max(0, Math.min(1000, params.seed));
      const colorShift = Math.max(0, Math.min(2, params.colorShift));
      const glitchFactor = Math.max(0, Math.min(1, params.glitchFactor));
      const pixelShuffle = Math.max(0, Math.min(1, params.pixelShuffle));
      const lineShift = Math.max(0, Math.min(1, params.lineShift));
      const corruption = Math.max(0, Math.min(1, params.corruption));
      const bitCorruption = Math.max(0, Math.min(1, params.bitCorruption));
      const bitShift = Math.max(-7, Math.min(7, params.bitShift));
      const headerGlitch = Math.max(0, Math.min(1, params.headerGlitch));

      return {
        ...params,
        intensity,
        blockSize,
        seed,
        colorShift,
        glitchFactor,
        pixelShuffle,
        lineShift,
        corruption,
        bitCorruption,
        bitShift,
        headerGlitch,
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        blockSize: Math.round(params.blockSize * scaleFactor),
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t),
        blockSize: Math.round(lerp(paramsA.blockSize, paramsB.blockSize, t)),
        direction: t < 0.5 ? paramsA.direction : paramsB.direction,
        seed: Math.round(lerp(paramsA.seed, paramsB.seed, t)),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t),
        glitchFactor: lerp(paramsA.glitchFactor, paramsB.glitchFactor, t),
        pixelShuffle: lerp(paramsA.pixelShuffle, paramsB.pixelShuffle, t),
        lineShift: lerp(paramsA.lineShift, paramsB.lineShift, t),
        corruption: lerp(paramsA.corruption, paramsB.corruption, t),
        bitCorruption: lerp(paramsA.bitCorruption, paramsB.bitCorruption, t),
        bitShift: Math.round(lerp(paramsA.bitShift, paramsB.bitShift, t)),
        headerGlitch: lerp(paramsA.headerGlitch, paramsB.headerGlitch, t),
      };
    },

    renderUI: (params, setParam) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "intensity", dataType: 'float', min: 0, max: 2, value: params.intensity }),
            ui.numberInput({ key: "intensity", dataType: 'float', value: params.intensity }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("blockSize") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "blockSize", dataType: 'int', min: 1, max: 64, value: params.blockSize }),
            ui.numberInput({ key: "blockSize", dataType: 'int', value: params.blockSize }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("direction") }),
          ui.select({ key: "direction", value: params.direction, options: [
            { label: t("horizontal"), value: 'horizontal' },
            { label: t("vertical"), value: 'vertical' },
            { label: t("both"), value: 'both' }] }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: 'float', min: 0, max: 2, value: params.colorShift }),
            ui.numberInput({ key: "colorShift", dataType: 'float', value: params.colorShift }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("glitchFactor") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "glitchFactor", dataType: 'float', min: 0, max: 1, value: params.glitchFactor }),
            ui.numberInput({ key: "glitchFactor", dataType: 'float', value: params.glitchFactor }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("pixelShuffle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "pixelShuffle", dataType: 'float', min: 0, max: 1, value: params.pixelShuffle }),
            ui.numberInput({ key: "pixelShuffle", dataType: 'float', value: params.pixelShuffle }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("lineShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "lineShift", dataType: 'float', min: 0, max: 1, value: params.lineShift }),
            ui.numberInput({ key: "lineShift", dataType: 'float', value: params.lineShift }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("corruption") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "corruption", dataType: 'float', min: 0, max: 1, value: params.corruption }),
            ui.numberInput({ key: "corruption", dataType: 'float', value: params.corruption }),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("bitCorruption") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bitCorruption", dataType: 'float', min: 0, max: 1, value: params.bitCorruption }),
            ui.numberInput({ key: "bitCorruption", dataType: 'float', value: params.bitCorruption }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("bitShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bitShift", dataType: 'int', min: -7, max: 7, value: params.bitShift }),
            ui.numberInput({ key: "bitShift", dataType: 'int', value: params.bitShift }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("headerGlitch") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "headerGlitch", dataType: 'float', min: 0, max: 1, value: params.headerGlitch }),
            ui.numberInput({ key: "headerGlitch", dataType: 'float', value: params.headerGlitch }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "seed", dataType: 'int', min: 0, max: 1000, value: params.seed }),
            ui.numberInput({ key: "seed", dataType: 'int', value: params.seed }),
          ]),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(DataMosh Filter)" },
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: f32,
              baseDpi: f32,
              intensity: f32,
              blockSize: i32,
              directionMode: i32, // 0: horizontal, 1: vertical, 2: both
              seed: i32,
              colorShift: f32,
              glitchFactor: f32,
              pixelShuffle: f32,
              lineShift: f32,
              corruption: f32,
              bitCorruption: f32,
              bitShift: i32,
              headerGlitch: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn hash(value: u32) -> u32 {
              var state = value;
              state = state ^ 2747636419u;
              state = state * 2654435769u;
              state = state ^ (state >> 16u);
              state = state * 2654435769u;
              state = state ^ (state >> 16u);
              state = state * 2654435769u;
              return state;
            }

            fn random(seed: i32, pos: vec2u) -> f32 {
              let h = hash(pos.x + 1933u * pos.y + u32(seed) * 7919u);
              return f32(h) / 4294967295.0;
            }

            fn repeat(v: f32, length: f32) -> f32 {
                return v - floor(v / length) * length;
            }

            // Convert float (0-1) to byte (0-255)
            fn floatToByte(v: f32) -> u32 {
                return u32(clamp(v * 255.0, 0.0, 255.0));
            }

            // Convert byte (0-255) to float (0-1)
            fn byteToFloat(v: u32) -> f32 {
                return f32(v) / 255.0;
            }

            // Bit manipulation functions
            fn invertBits(value: u32) -> u32 {
                return ~value & 0xFFu; // Invert all bits but stay in 0-255 range
            }

            fn flipBit(value: u32, position: u32) -> u32 {
                let mask = 1u << position;
                return value ^ mask;
            }

            fn shiftBits(value: u32, shift: i32) -> u32 {
                if (shift > 0) {
                    return (value << u32(shift)) & 0xFFu;
                } else if (shift < 0) {
                    return (value >> u32(-shift)) & 0xFFu;
                }
                return value;
            }

            fn applyBitCorruption(value: u32, seed: i32, position: vec2u, bitCorruption: f32) -> u32 {
                var result = value;
                let rand = random(seed + 12345, position);

                // Randomly corrupt bits based on corruption level
                if (rand < bitCorruption * 0.3) {
                    // Complete bit inversion (all bits)
                    result = invertBits(result);
                } else if (rand < bitCorruption * 0.6) {
                    // Flip specific bits
                    let bitPos = u32(random(seed + 23456, position) * 8.0);
                    result = flipBit(result, bitPos);

                    // Flip a second bit with 50% chance
                    if (random(seed + 34567, position) < 0.5) {
                        let bitPos2 = u32(random(seed + 45678, position) * 8.0);
                        result = flipBit(result, bitPos2);
                    }
                }

                return result;
            }

            fn applyHeaderGlitch(color: vec4f, position: vec2u, headerGlitch: f32, seed: i32, dpiScale: f32) -> vec4f {
                var result = color;

                // Header glitch affects top portion of the image
                let dims = vec2f(textureDimensions(inputTexture));
                let normalizedY = f32(position.y) / dims.y;

                // Only apply to top 20% of the image with decreasing probability
                if (normalizedY < 0.2 && random(seed + 56789, position) < headerGlitch * (1.0 - normalizedY * 5.0)) {
                    let rand = random(seed + 67890, position);

                    if (rand < 0.3) {
                        // Replace with file format header-like patterns
                        if (random(seed + 78901, position) < 0.5) {
                            // Create patterns that look like corrupted headers
                            // High contrast patterns
                            let patternSize = max(1.0, dpiScale * 2.0); // Scale pattern size with DPI
                            let pattern = i32(f32(position.x) / patternSize + f32(position.y) / patternSize) % 6;

                            if (pattern == 0) {
                                result = vec4f(1.0, 0.0, 0.0, color.a); // Red
                            } else if (pattern == 1) {
                                result = vec4f(0.0, 0.0, 0.0, color.a); // Black
                            } else if (pattern == 2) {
                                result = vec4f(1.0, 1.0, 1.0, color.a); // White
                            } else if (pattern == 3) {
                                result = vec4f(0.0, 0.0, 1.0, color.a); // Blue
                            } else if (pattern == 4) {
                                result = vec4f(0.0, 1.0, 0.0, color.a); // Green
                            } else {
                                result = vec4f(1.0, 1.0, 0.0, color.a); // Yellow
                            }
                        } else {
                            // Checkerboard pattern - scaled with DPI
                            let checkerSize = max(2.0, 4.0 * dpiScale);
                            let checker = (i32(f32(position.x) / checkerSize) + i32(f32(position.y) / checkerSize)) % 2;
                            result = vec4f(f32(checker), f32(checker), f32(checker), color.a);
                        }
                    } else if (rand < 0.6) {
                        // Horizontal stripe pattern - scaled with DPI
                        let stripeHeight = max(2.0, 4.0 * dpiScale);
                        let stripe = i32(f32(position.y) / stripeHeight) % 4;
                        if (stripe == 0 || stripe == 2) {
                            result = vec4f(0.0, 0.0, 0.0, color.a);
                        } else {
                            result = vec4f(1.0, 1.0, 1.0, color.a);
                        }
                    } else {
                        // Complete color inversion
                        result = vec4f(1.0 - color.r, 1.0 - color.g, 1.0 - color.b, color.a);
                    }
                }

                return result;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dims = vec2f(textureDimensions(inputTexture));

                // Calculate DPI scaling factor
                let dpiScale = params.inputDpi / params.baseDpi;

                // Apply DPI scaling to blockSize
                let scaledBlockSize = f32(params.blockSize) * dpiScale;
                var blockSizeI = i32(scaledBlockSize);
                if (blockSizeI < 1) {
                    blockSizeI = 1; // Ensure minimum size of 1
                }

                // Block position
                let blockX = i32(id.x) / blockSizeI;
                let blockY = i32(id.y) / blockSizeI;

                // Generate several random values for different effects
                let rand = random(params.seed, vec2u(u32(blockX), u32(blockY)));
                let rand2 = random(params.seed + 1000, vec2u(u32(blockX), u32(blockY)));
                let rand3 = random(params.seed + 2000, vec2u(u32(blockX), u32(blockY)));
                let rand4 = random(params.seed + 3000, vec2u(u32(id.x), u32(id.y)));

                // Extreme block displacement with DPI scaling
                let scale = 5.0; // Larger displacement scale
                let displacementX = params.intensity * (rand - 0.5) * scale * scaledBlockSize;
                let displacementY = params.intensity * (rand2 - 0.5) * scale * scaledBlockSize;

                // Apply displacement based on direction mode
                var offsetX = 0.0;
                var offsetY = 0.0;

                if (params.directionMode == 0 || params.directionMode == 2) {
                    offsetX = displacementX;
                }

                if (params.directionMode == 1 || params.directionMode == 2) {
                    offsetY = displacementY;
                }

                // Pixel shuffle - completely random placement
                var shuffleX = 0.0;
                var shuffleY = 0.0;

                if (params.pixelShuffle > 0.0) {
                    if (rand3 < params.pixelShuffle) {
                        shuffleX = (random(params.seed + 4000, id.xy) - 0.5) * dims.x * 0.5 * dpiScale;
                        shuffleY = (random(params.seed + 5000, id.xy) - 0.5) * dims.y * 0.5 * dpiScale;
                    }
                }

                // Line shift effect (horizontal scanlines shift)
                var lineOffset = 0.0;
                if (params.lineShift > 0.0) {
                    let lineRand = random(params.seed + 6000, vec2u(0, id.y));
                    if (lineRand < params.lineShift * 0.5) {
                        // Every few lines gets a major shift
                        lineOffset = (lineRand * 2.0) * dims.x * 0.3 * dpiScale;
                    }
                }

                // Glitch blocks effect - some blocks get completely moved
                var glitchX = 0.0;
                var glitchY = 0.0;

                if (rand4 < params.glitchFactor * 0.3) {
                    // Major block displacement
                    let glitchRandX = random(params.seed + 7000, vec2u(u32(blockX), u32(blockY)));
                    let glitchRandY = random(params.seed + 8000, vec2u(u32(blockX), u32(blockY)));

                    glitchX = (glitchRandX - 0.5) * dims.x * 0.5 * dpiScale;
                    glitchY = (glitchRandY - 0.5) * dims.y * 0.3 * dpiScale;
                }

                // Final coordinate calculation with all effects combined
                let texCoordDisplaced = vec2f(
                    repeat((f32(id.x) + offsetX + shuffleX + lineOffset + glitchX) / dims.x, 1.0),
                    repeat((f32(id.y) + offsetY + shuffleY + glitchY) / dims.y, 1.0)
                );

                // Extreme color channel splitting with DPI scaling
                let colorShiftScale = params.colorShift * 0.3; // Stronger color shift

                let redShiftX = colorShiftScale * (rand - 0.5) * dims.x / 20.0 * dpiScale;
                let redShiftY = colorShiftScale * (rand3 - 0.5) * dims.y / 30.0 * dpiScale;

                let greenShiftX = colorShiftScale * (rand2 - 0.5) * dims.x / 25.0 * dpiScale;
                let greenShiftY = 0.0;

                let blueShiftX = colorShiftScale * (rand3 - 0.5) * dims.x / 15.0 * dpiScale;
                let blueShiftY = colorShiftScale * (rand - 0.5) * dims.y / 35.0 * dpiScale;

                let texCoordR = vec2f(
                    repeat(texCoordDisplaced.x + redShiftX / dims.x, 1.0),
                    repeat(texCoordDisplaced.y + redShiftY / dims.y, 1.0)
                );

                let texCoordG = vec2f(
                    repeat(texCoordDisplaced.x + greenShiftX / dims.x, 1.0),
                    repeat(texCoordDisplaced.y + greenShiftY / dims.y, 1.0)
                );

                let texCoordB = vec2f(
                    repeat(texCoordDisplaced.x + blueShiftX / dims.x, 1.0),
                    repeat(texCoordDisplaced.y + blueShiftY / dims.y, 1.0)
                );

                // Sample colors with possible corruptions
                var colorR = textureSampleLevel(inputTexture, textureSampler, texCoordR, 0.0).r;
                var colorG = textureSampleLevel(inputTexture, textureSampler, texCoordG, 0.0).g;
                var colorB = textureSampleLevel(inputTexture, textureSampler, texCoordB, 0.0).b;
                var colorA = textureSampleLevel(inputTexture, textureSampler, texCoordDisplaced, 0.0).a;

                // Apply bit-level corruptions if enabled
                if (params.bitCorruption > 0.0) {
                    // Convert float colors (0-1) to byte values (0-255)
                    var byteR = floatToByte(colorR);
                    var byteG = floatToByte(colorG);
                    var byteB = floatToByte(colorB);

                    // Apply bit corruptions to each channel
                    byteR = applyBitCorruption(byteR, params.seed, id.xy, params.bitCorruption);
                    byteG = applyBitCorruption(byteG, params.seed + 1000, id.xy, params.bitCorruption);
                    byteB = applyBitCorruption(byteB, params.seed + 2000, id.xy, params.bitCorruption);

                    // Apply bit shifting if enabled
                    if (params.bitShift != 0) {
                        byteR = shiftBits(byteR, params.bitShift);
                        byteG = shiftBits(byteG, params.bitShift);
                        byteB = shiftBits(byteB, params.bitShift);
                    }

                    // Convert back to float colors (0-1)
                    colorR = byteToFloat(byteR);
                    colorG = byteToFloat(byteG);
                    colorB = byteToFloat(byteB);
                }

                // Corruption effect - some pixels get completely wrong values
                if (params.corruption > 0.0) {
                    // Bit corruption simulation
                    if (rand4 < params.corruption * 0.2) {
                        // Complete color inversion
                        colorR = 1.0 - colorR;
                        colorG = 1.0 - colorG;
                        colorB = 1.0 - colorB;
                    } else if (rand4 < params.corruption * 0.5) {
                        // Value corruption - replace with random values
                        let corruptionRand = random(params.seed + 9000, id.xy);

                        if (corruptionRand < 0.3) {
                            // Replace with random value
                            colorR = random(params.seed + 10000, id.xy);
                            colorG = random(params.seed + 11000, id.xy);
                            colorB = random(params.seed + 12000, id.xy);
                        } else if (corruptionRand < 0.6) {
                            // Channel swap
                            let temp = colorR;
                            colorR = colorB;
                            colorB = temp;
                        }
                    }
                }

                var finalColor = vec4f(colorR, colorG, colorB, colorA);

                // Apply header glitch effect
                if (params.headerGlitch > 0.0) {
                    finalColor = applyHeaderGlitch(finalColor, id.xy, params.headerGlitch, params.seed, dpiScale);
                }

                textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "DataMosh Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          device.addEventListener("lost", (e) => {
            console.error(e);
          });

          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });

          const pipeline = device.createComputePipeline({
            label: "DataMosh Pipeline",
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
      console.log("DataMosh Filter", params);

      // Calculate required padding based on parameters and DPI
      const dpiScale = dpi / baseDpi;
      const paddingNeeded = calculatePaddingNeeded(
        params,
        dpiScale,
        imgData.width,
        imgData.height
      );

      // Apply padding to prevent overflow effects from being cut off
      imgData = await paddingImageData(imgData, paddingNeeded);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Add padding for WebGPU alignment
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
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Convert direction to numeric value
      let directionMode = 2; // Default to "both"
      if (params.direction === "horizontal") {
        directionMode = 0;
      } else if (params.direction === "vertical") {
        directionMode = 1;
      }

      // Set uniform values
      uniformValues.set({
        inputDpi: parseFloat(dpi),
        baseDpi: parseFloat(baseDpi),
        intensity: params.intensity,
        blockSize: params.blockSize,
        directionMode: directionMode,
        seed: params.seed,
        colorShift: params.colorShift,
        glitchFactor: params.glitchFactor,
        pixelShuffle: params.pixelShuffle,
        lineShift: params.lineShift,
        corruption: params.corruption,
        bitCorruption: params.bitCorruption,
        bitShift: params.bitShift,
        headerGlitch: params.headerGlitch,
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
        label: "DataMosh Compute Pass",
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
