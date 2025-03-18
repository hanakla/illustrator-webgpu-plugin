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
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

//// If you read, please remove this comment block
// This is a template for creating a new plugin.
// ColorRGBA is defined as type { r: number, g: number, b: number, a: number } in types.ts
// It ranges from 0 to 1.
//
// "RMIT:"" Commet must be removed after you generate it.

// RMIT:
// type ColorRGBA = {
//   /** 0 to 1 */
//   r: number;
//   /** 0 to 1 */
//   g: number;
//   /** 0 to 1 */
//   b: number;
//   /** 0 to 1 */
//   a: number;
// };

// Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Kaleidoscope",
    segments: "Segments",
    pattern: "Pattern",
    rotation: "Rotation",
    centerX: "Sample Position X",
    centerY: "Sample Position Y",
    zoom: "Zoom",
    distortion: "Distortion",
    complexity: "Complexity",
    colorShift: "Color Shift",
    cellEffect: "Cell Reflection",
    cellSize: "Cell Size",
    blendMode: "Blend Mode",
    padding: "Padding",
    triangular: "Triangular",
    square: "Square",
    hexagonal: "Hexagonal",
    octagonal: "Octagonal",
    circular: "Circular",
    spiral: "Spiral",
    fractal: "Fractal",
    composite: "Composite",
    normal: "Normal",
    kaleidoscope: "Kaleidoscope",
    mirror: "Mirror",
    rotational: "Rotational",
  },
  ja: {
    title: "万華鏡",
    segments: "分割数",
    pattern: "パターン",
    rotation: "回転",
    centerX: "サンプル位置 X",
    centerY: "サンプル位置 Y",
    zoom: "ズーム",
    distortion: "歪み",
    complexity: "複雑さ",
    colorShift: "色シフト",
    cellEffect: "セル反射",
    cellSize: "セルサイズ",
    blendMode: "ブレンドモード",
    padding: "パディング",
    triangular: "三角形",
    square: "四角形",
    hexagonal: "六角形",
    octagonal: "八角形",
    circular: "円形",
    spiral: "渦巻き",
    fractal: "フラクタル",
    composite: "複合",
    normal: "ノーマル",
    kaleidoscope: "万華鏡",
    mirror: "ミラー",
    rotational: "回転",
  },
});

// Kaleidoscope filter plugin
export const kaleidoscope = definePlugin({
  id: "kaleidoscope",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      pattern: {
        type: "string",
        enum: [
          "triangular",
          "square",
          "hexagonal",
          "octagonal",
          "circular",
          "spiral",
          "fractal",
          "composite",
        ],
        default: "triangular",
      },
      segments: {
        type: "int",
        default: 6,
        min: 2,
        max: 36,
      },
      rotation: {
        type: "real",
        default: 0.0,
        min: 0.0,
        max: 360.0,
      },
      centerX: {
        type: "real",
        default: 0.5,
        min: -1.0,
        max: 2.0,
      },
      centerY: {
        type: "real",
        default: 0.5,
        min: -1.0,
        max: 2.0,
      },
      zoom: {
        type: "real",
        default: 1.0,
        min: 0.1,
        max: 5.0,
      },
      distortion: {
        type: "real",
        default: 0.0,
        min: 0.0,
        max: 1.0,
      },
      complexity: {
        type: "real",
        default: 0.5,
        min: 0.0,
        max: 1.0,
      },
      colorShift: {
        type: "real",
        default: 0.0,
        min: 0.0,
        max: 1.0,
      },
      cellEffect: {
        type: "real",
        default: 0.0,
        min: 0.0,
        max: 1.0,
      },
      cellSize: {
        type: "real",
        default: 0.2,
        min: 0.05,
        max: 1.0,
      },
      blendMode: {
        type: "string",
        enum: ["normal", "kaleidoscope", "mirror", "rotational"],
        default: "normal",
      },
      padding: {
        type: "int",
        default: 0,
        min: 0,
        max: 500,
      },
    },
    onEditParameters: (params) => {
      // Normalize parameters
      return {
        ...params,
        segments: Math.max(2, Math.min(36, Math.round(params.segments))),
        rotation: ((params.rotation % 360) + 360) % 360,
        centerX: Math.max(-1.0, Math.min(2.0, params.centerX)),
        centerY: Math.max(-1.0, Math.min(2.0, params.centerY)),
        zoom: Math.max(0.1, Math.min(5.0, params.zoom)),
        distortion: Math.max(0.0, Math.min(1.0, params.distortion)),
        complexity: Math.max(0.0, Math.min(1.0, params.complexity)),
        colorShift: Math.max(0.0, Math.min(1.0, params.colorShift)),
        cellEffect: Math.max(0.0, Math.min(1.0, params.cellEffect)),
        cellSize: Math.max(0.05, Math.min(1.0, params.cellSize)),
        padding: Math.max(0, Math.min(500, Math.round(params.padding))),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      // RMIT: If parameter has color, pass it to adjustColor(rgba)
      return {
        ...params,
        // Ex.
        // color: adjustColor(params.color),
      };
    },
    onScaleParams(params, scaleFactor) {
      // Kaleidoscope parameters are mostly relative values (0-1) or angles,
      // so they don't need to be scaled with DPI
      // However, padding should be scaled with DPI
      return {
        ...params,
        padding: Math.round(params.padding * scaleFactor),
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // Interpolate parameters
      return {
        pattern: t < 0.5 ? paramsA.pattern : paramsB.pattern,
        segments: Math.round(lerp(paramsA.segments, paramsB.segments, t)),
        rotation: lerp(paramsA.rotation, paramsB.rotation, t),
        centerX: lerp(paramsA.centerX, paramsB.centerX, t),
        centerY: lerp(paramsA.centerY, paramsB.centerY, t),
        zoom: lerp(paramsA.zoom, paramsB.zoom, t),
        distortion: lerp(paramsA.distortion, paramsB.distortion, t),
        complexity: lerp(paramsA.complexity, paramsB.complexity, t),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t),
        cellEffect: lerp(paramsA.cellEffect, paramsB.cellEffect, t),
        cellSize: lerp(paramsA.cellSize, paramsB.cellSize, t),
        blendMode: t < 0.5 ? paramsA.blendMode : paramsB.blendMode,
        padding: Math.round(lerp(paramsA.padding, paramsB.padding, t)),
      };
    },

    renderUI: (params, setParam) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("pattern") }),
          ui.select({ key: "pattern", value: params.pattern, options: [
            { label: t("triangular"), value: "triangular" },
            { label: t("square"), value: "square" },
            { label: t("hexagonal"), value: "hexagonal" },
            { label: t("octagonal"), value: "octagonal" },
            { label: t("circular"), value: "circular" },
            { label: t("spiral"), value: "spiral" },
            { label: t("fractal"), value: "fractal" },
            { label: t("composite"), value: "composite" },
          ]}),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("blendMode") }),
          ui.select({ key: "blendMode", value: params.blendMode, options: [
            { label: t("normal"), value: "normal" },
            { label: t("kaleidoscope"), value: "kaleidoscope" },
            { label: t("mirror"), value: "mirror" },
            { label: t("rotational"), value: "rotational" },
          ]}),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("segments") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "segments", dataType: "int", min: 2, max: 36, value: params.segments }),
            ui.numberInput({ key: "segments", dataType: "int", value: params.segments }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("rotation") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "rotation", dataType: "float", min: 0, max: 360, value: params.rotation }),
            ui.numberInput({ key: "rotation", dataType: "float", value: params.rotation }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("centerX") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "centerX", dataType: "float", min: -1.0, max: 2.0, value: params.centerX }),
            ui.numberInput({ key: "centerX", dataType: "float", value: params.centerX }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("centerY") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "centerY", dataType: "float", min: -1.0, max: 2.0, value: params.centerY }),
            ui.numberInput({ key: "centerY", dataType: "float", value: params.centerY }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("zoom") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "zoom", dataType: "float", min: 0.1, max: 5.0, value: params.zoom }),
            ui.numberInput({ key: "zoom", dataType: "float", value: params.zoom }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("distortion") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "distortion", dataType: "float", min: 0.0, max: 1.0, value: params.distortion }),
            ui.numberInput({ key: "distortion", dataType: "float", value: params.distortion }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("complexity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "complexity", dataType: "float", min: 0.0, max: 1.0, value: params.complexity }),
            ui.numberInput({ key: "complexity", dataType: "float", value: params.complexity }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: "float", min: 0.0, max: 1.0, value: params.colorShift }),
            ui.numberInput({ key: "colorShift", dataType: "float", value: params.colorShift }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("padding") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "padding", dataType: "int", min: 0, max: 500, value: params.padding }),
            ui.numberInput({ key: "padding", dataType: "int", value: params.padding }),
          ]),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Kaleidoscope)" },
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: i32,
              baseDpi: i32,
              segments: i32,
              patternType: i32, // 0: triangular, 1: square, 2: hexagonal, 3: octagonal, 4: circular, 5: spiral, 6: fractal, 7: composite
              rotation: f32,    // in degrees
              centerX: f32,     // normalized 0-1 (sampling position)
              centerY: f32,     // normalized 0-1 (sampling position)
              zoom: f32,        // scale factor
              distortion: f32,  // 0-1
              complexity: f32,  // 0-1
              colorShift: f32,  // 0-1
              cellEffect: f32,  // 0-1
              cellSize: f32,    // cell size for reflection effect
              blendMode: i32    // 0: normal, 1: kaleidoscope, 2: mirror, 3: rotational
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Convert degrees to radians
            fn degToRad(degrees: f32) -> f32 {
              return degrees * 3.14159265359 / 180.0;
            }

            // Rotate a 2D point around a center
            fn rotate2D(point: vec2f, center: vec2f, angle: f32) -> vec2f {
              let s = sin(angle);
              let c = cos(angle);
              let p = point - center;
              return vec2f(
                p.x * c - p.y * s,
                p.x * s + p.y * c
              ) + center;
            }

            // Hash function to generate pseudo-random numbers
            fn hash(n: f32) -> f32 {
              return fract(sin(n) * 43758.5453);
            }

            // Hash function for 2D coordinates
            fn hash2D(p: vec2f) -> f32 {
              return hash(p.x + p.y * 57.0);
            }

            // Random 2D vector
            fn random2D(p: vec2f) -> vec2f {
              return vec2f(
                hash(p.x * 127.1 + p.y * 311.7),
                hash(p.x * 269.5 + p.y * 183.3)
              ) * 2.0 - 1.0;
            }

            // Voronoi/cellular noise for cell-based reflection
            fn voronoi(uv: vec2f, cellSize: f32) -> vec2f {
              let scaledUV = uv / cellSize;
              let cellUV = floor(scaledUV);
              let fractUV = vec2f(fract(scaledUV.x), fract(scaledUV.y));

              var minDist = 8.0;
              var cellPoint = vec2f(0.0, 0.0);
              var cellCenter = vec2f(0.0, 0.0);

              // Check surrounding cells (3x3 grid)
              for (var y = -1.0; y <= 1.0; y += 1.0) {
                for (var x = -1.0; x <= 1.0; x += 1.0) {
                  let cell = cellUV + vec2f(x, y);

                  // Get random point within this cell
                  let cellRandom = random2D(cell);
                  let pointPos = vec2f(x, y) + 0.5 + 0.5 * cellRandom;

                  // Calculate distance to this point
                  let diff = pointPos - fractUV;
                  let dist = length(diff);

                  if (dist < minDist) {
                    minDist = dist;
                    cellPoint = cell + pointPos;
                    cellCenter = cell + vec2f(0.5, 0.5);
                  }
                }
              }

              return vec2f(minDist, distance(cellPoint, cellCenter));
            }

            // Apply cell reflection/refraction effect
            fn applyCellEffect(coord: vec2f, center: vec2f, cellEffect: f32, cellSize: f32) -> vec2f {
              if (cellEffect <= 0.0) {
                return coord;
              }

              let voronoiResult = voronoi(coord, cellSize);
              let cellDistance = voronoiResult.x;
              let centerDistance = voronoiResult.y;

              // Create a refraction-like effect at cell boundaries
              let distortionStrength = smoothstep(0.0, 0.4, cellDistance) * (1.0 - smoothstep(0.4, 0.5, cellDistance));
              let distortionDirection = normalize(coord - center) * (centerDistance * 0.5 + 0.5);

              // Apply the distortion
              return coord + distortionDirection * distortionStrength * cellEffect * 0.1;
            }

            // Generic distortion function
            fn applyDistortion(coord: vec2f, center: vec2f, distortionAmount: f32) -> vec2f {
              if (distortionAmount <= 0.0) {
                return coord;
              }

              let offset = coord - center;
              let distance = length(offset);
              let angle = atan2(offset.y, offset.x);

              // Apply wave distortion
              let wave = sin(distance * 10.0 * distortionAmount) * distortionAmount * 0.1;
              let distortedDistance = distance * (1.0 + wave);

              // Apply twirl distortion
              let twirl = distortionAmount * 5.0 * (1.0 - smoothstep(0.0, 0.5, distance));
              let distortedAngle = angle + twirl;

              return vec2f(
                center.x + cos(distortedAngle) * distortedDistance,
                center.y + sin(distortedAngle) * distortedDistance
              );
            }

            // Spiral transform
            fn spiralTransform(coord: vec2f, center: vec2f, complexity: f32, rotation: f32) -> vec2f {
              let offset = coord - center;
              let distance = length(offset);
              let angle = atan2(offset.y, offset.x) + rotation;

              // Apply logarithmic spiral transformation
              let spiralFactor = 0.1 + complexity * 0.4;
              let spiralAngle = angle + distance * spiralFactor * 10.0;

              return vec2f(
                center.x + cos(spiralAngle) * distance,
                center.y + sin(spiralAngle) * distance
              );
            }

            // Fractal transform using simplified Julia set approach
            fn fractalTransform(coord: vec2f, center: vec2f, complexity: f32, iterations: i32) -> vec2f {
              let z = (coord - center) * 2.0; // Scale to make patterns more visible
              let c = vec2f(
                -0.8 + complexity * 0.6,
                0.156
              );

              var result = z;
              for (var i = 0; i < iterations; i++) {
                if (length(result) > 2.0) {
                  break;
                }

                // z = z^2 + c (complex number math)
                result = vec2f(
                  result.x * result.x - result.y * result.y,
                  2.0 * result.x * result.y
                ) + c;
              }

              return center + result * 0.25; // Scale back down
            }

            // Apply triangular kaleidoscope pattern
            fn triangularPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the angle
              let segmentAngle = 2.0 * 3.14159265359 / f32(segments);
              let segmentIndex = floor(angle / segmentAngle);
              let segmentPosition = angle - segmentAngle * segmentIndex;

              // Mirror alternate segments
              let isEven = segmentIndex % 2.0;
              let finalAngle = select(segmentAngle - segmentPosition, segmentPosition, isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(finalAngle) * distance,
                sin(finalAngle) * distance
              );

              return finalOffset + center;
            }

            // Apply square kaleidoscope pattern
            fn squarePattern(uv: vec2f, center: vec2f, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Mirror across both axes
              let mirroredOffset = vec2f(abs(offset.x), abs(offset.y));

              return mirroredOffset + center;
            }

            // Apply hexagonal kaleidoscope pattern
            fn hexagonalPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              // Hexagonal is a variant of triangular with some adjustments
              let segmentCount = segments * 2; // Double segments for hexagonal effect
              return triangularPattern(uv, center, segmentCount, rotation);
            }

            // Apply octagonal kaleidoscope pattern
            fn octagonalPattern(uv: vec2f, center: vec2f, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the angle into 8 parts
              let segmentAngle = 2.0 * 3.14159265359 / 8.0;
              let segmentIndex = floor(angle / segmentAngle);
              let segmentPosition = angle - segmentAngle * segmentIndex;

              // Mirror every second segment
              let isEven = segmentIndex % 2.0;
              let finalAngle = select(segmentAngle - segmentPosition, segmentPosition, isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(finalAngle) * distance,
                sin(finalAngle) * distance
              );

              return finalOffset + center;
            }

            // Apply circular kaleidoscope pattern
            fn circularPattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32) -> vec2f {
              let rotatedUV = rotate2D(uv, center, rotation);
              let offset = rotatedUV - center;

              // Convert to polar coordinates
              let angle = atan2(offset.y, offset.x);
              let distance = length(offset);

              // Segment the radial distance
              let segmentWidth = 0.1; // Adjust based on desired effect
              let segmentIndex = floor(distance / segmentWidth);
              let isEven = segmentIndex % 2.0;

              // Mirror every second circular ring
              let finalDistance = select(distance,
                segmentWidth * (segmentIndex + 1.0) - (distance - segmentWidth * segmentIndex),
                isEven < 0.5);

              // Convert back to cartesian coordinates
              let finalOffset = vec2f(
                cos(angle) * finalDistance,
                sin(angle) * finalDistance
              );

              return finalOffset + center;
            }

            // Composite pattern that combines multiple patterns
            fn compositePattern(uv: vec2f, center: vec2f, segments: i32, rotation: f32, complexity: f32) -> vec2f {
              // First apply triangular pattern
              let pattern1 = triangularPattern(uv, center, segments, rotation);

              // Then apply circular pattern with slight modification
              let pattern2 = circularPattern(pattern1, center, segments, rotation + 0.3);

              // Mix based on complexity
              let mix = smoothstep(0.3, 0.7, complexity);
              return mix * pattern2 + (1.0 - mix) * pattern1;
            }

            // Blend two coordinates based on blend mode
            fn blendCoordinates(coord1: vec2f, coord2: vec2f, blendMode: i32, factor: f32) -> vec2f {
              if (blendMode == 0) { // Normal
                return coord1;
              } else if (blendMode == 1) { // Kaleidoscope
                return mix(coord1, coord2, factor);
              } else if (blendMode == 2) { // Mirror
                let dist1 = length(coord1);
                let dist2 = length(coord2);
                return select(coord1, coord2, dist1 > dist2);
              } else { // Rotational
                let angle = factor * 6.28318;
                let c = cos(angle);
                let s = sin(angle);
                return c * coord1 + s * coord2;
              }
            }

            // Helper function for float fraction part
            fn fract(x: f32) -> f32 {
              return x - floor(x);
            }

            // Apply HSV color shift
            fn shiftColor(color: vec4f, shift: f32) -> vec4f {
              if (shift <= 0.0) {
                return color;
              }

              // Simple HSV shift (hue rotation)
              // Convert RGB to HSV-like space
              let maxC = max(max(color.r, color.g), color.b);
              let minC = min(min(color.r, color.g), color.b);
              let delta = maxC - minC;

              var h: f32 = 0.0;
              if (delta > 0.0) {
                if (maxC == color.r) {
                  h = 6.0 + (color.g - color.b) / delta;
                } else if (maxC == color.g) {
                  h = 2.0 + (color.b - color.r) / delta;
                } else {
                  h = 4.0 + (color.r - color.g) / delta;
                }
                h = h % 6.0;
              }

              // Apply hue shift
              h = (h + shift * 6.0) % 6.0;

              // Convert back to RGB
              let sector = floor(h);
              let f = h - sector;

              let p = minC;
              let q = minC + (maxC - minC) * (1.0 - f);
              let t = minC + (maxC - minC) * f;

              var newColor: vec3f;

              if (sector == 0.0) {
                newColor = vec3f(maxC, t, p);
              } else if (sector == 1.0) {
                newColor = vec3f(q, maxC, p);
              } else if (sector == 2.0) {
                newColor = vec3f(p, maxC, t);
              } else if (sector == 3.0) {
                newColor = vec3f(p, q, maxC);
              } else if (sector == 4.0) {
                newColor = vec3f(t, p, maxC);
              } else {
                newColor = vec3f(maxC, p, q);
              }

              return vec4f(newColor, color.a);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dims = vec2f(textureDimensions(inputTexture));
                let texCoord = vec2f(id.xy) / dims;

                // Fixed kaleidoscope center at image center
                let kaleidoscopeCenter = vec2f(0.5, 0.5);

                // Sample position based on centerX/Y parameters
                let samplePosition = vec2f(params.centerX, params.centerY);

                // Calculate texture coordinate offset from sample position
                let sampleOffset = kaleidoscopeCenter - samplePosition;

                // Apply zoom and offset to the texture coordinates
                let offsetCoord = (texCoord - kaleidoscopeCenter) / params.zoom + sampleOffset + kaleidoscopeCenter;

                // Apply cellular effect (refraction through cells)
                let cellCoord = applyCellEffect(offsetCoord, kaleidoscopeCenter, params.cellEffect, params.cellSize);

                // Apply distortion if enabled
                let distortedCoord = applyDistortion(cellCoord, kaleidoscopeCenter, params.distortion);

                // Apply appropriate kaleidoscope pattern based on the selected type
                var finalCoord1: vec2f;
                var finalCoord2: vec2f;

                // Generate two different coordinates for blending
                if (params.patternType == 0) {
                    // Triangular
                    finalCoord1 = triangularPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = triangularPattern(distortedCoord, kaleidoscopeCenter, params.segments * 2, degToRad(params.rotation + 30.0));
                } else if (params.patternType == 1) {
                    // Square
                    finalCoord1 = squarePattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation));
                    finalCoord2 = squarePattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation + 45.0));
                } else if (params.patternType == 2) {
                    // Hexagonal
                    finalCoord1 = hexagonalPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = hexagonalPattern(distortedCoord, kaleidoscopeCenter, params.segments + 2, degToRad(params.rotation + 15.0));
                } else if (params.patternType == 3) {
                    // Octagonal
                    finalCoord1 = octagonalPattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation));
                    finalCoord2 = octagonalPattern(distortedCoord, kaleidoscopeCenter, degToRad(params.rotation + 22.5));
                } else if (params.patternType == 4) {
                    // Circular
                    finalCoord1 = circularPattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation));
                    finalCoord2 = circularPattern(distortedCoord, kaleidoscopeCenter, params.segments + 1, degToRad(params.rotation));
                } else if (params.patternType == 5) {
                    // Spiral
                    finalCoord1 = spiralTransform(distortedCoord, kaleidoscopeCenter, params.complexity, degToRad(params.rotation));
                    finalCoord2 = spiralTransform(distortedCoord, kaleidoscopeCenter, params.complexity * 0.7, degToRad(params.rotation + 30.0));
                } else if (params.patternType == 6) {
                    // Fractal
                    let iterations = 2 + i32(params.complexity * 8.0);
                    finalCoord1 = fractalTransform(distortedCoord, kaleidoscopeCenter, params.complexity, iterations);
                    finalCoord2 = fractalTransform(distortedCoord, kaleidoscopeCenter, params.complexity * 1.1, iterations - 1);
                } else {
                    // Composite
                    finalCoord1 = compositePattern(distortedCoord, kaleidoscopeCenter, params.segments, degToRad(params.rotation), params.complexity);
                    finalCoord2 = compositePattern(distortedCoord, kaleidoscopeCenter, params.segments + 1, degToRad(params.rotation + 10.0), params.complexity * 0.8);
                }

                // Blend the two coordinates based on blend mode
                let blendedCoord = blendCoordinates(finalCoord1, finalCoord2, params.blendMode, params.complexity);

                // Loop coordinates to create seamless tiling effect
                let loopedCoord = vec2f(
                    blendedCoord.x - floor(blendedCoord.x),
                    blendedCoord.y - floor(blendedCoord.y)
                );

                // Apply one final cell effect for refraction at seams
                let finalCellCoord = applyCellEffect(loopedCoord, kaleidoscopeCenter, params.cellEffect * 0.5, params.cellSize * 0.5);

                // Sample the original texture at the transformed coordinates
                let sampledColor = textureSampleLevel(inputTexture, textureSampler, finalCellCoord, 0.0);

                // Apply color shifting if enabled
                let finalColor = shiftColor(sampledColor, params.colorShift);

                textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Kaleidoscope Shader",
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
            label: "Kaleidoscope Pipeline",
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
      {
        /* RMIT: return value from initLiveEffect -> */ device,
        pipeline,
        pipelineDef,
      },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      // Input images default DPI is 72 get as `baseDpi`.
      // If the `dpi` changes, the size of the elements MUST be according to visual elements
      // and parameters will not change.

      console.log("Kaleidoscope Effect", params);

      // if this effect needs to exand over original size, do it padding
      // imgData = await paddingImageData(imgData, numOfPxByParams);
      imgData = await paddingImageData(imgData, params.padding);

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

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Map pattern type string to integer for shader
      const patternTypeMap = {
        triangular: 0,
        square: 1,
        hexagonal: 2,
        octagonal: 3,
        circular: 4,
        spiral: 5,
        fractal: 6,
        composite: 7,
      };

      // Map blend mode string to integer for shader
      const blendModeMap = {
        normal: 0,
        kaleidoscope: 1,
        mirror: 2,
        rotational: 3,
      };

      // Set uniform values
      uniformValues.set({
        inputDpi: dpi,
        baseDpi: baseDpi,
        segments: params.segments,
        patternType: patternTypeMap[params.pattern] || 0,
        rotation: params.rotation,
        centerX: params.centerX,
        centerY: params.centerY,
        zoom: params.zoom,
        distortion: params.distortion,
        complexity: params.complexity,
        colorShift: params.colorShift,
        cellEffect: params.cellEffect,
        cellSize: params.cellSize,
        blendMode: blendModeMap[params.blendMode] || 0,
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
        label: "Kaleidoscope Compute Pass",
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
