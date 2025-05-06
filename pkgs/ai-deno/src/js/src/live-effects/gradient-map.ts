import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag, definePlugin, ColorRGBA } from "../plugin.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui, ClickEventHandler, ChangeEventHandler } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
  parseColorCode,
  toColorCode,
  createCanvas,
} from "./_utils.ts";
import {
  createGPUDevice,
  includeOklabMix,
  includeOklchMix,
} from "./_shared.ts";

// Type for color stop
type ColorStop = {
  color: ColorRGBA;
  position: number;
};

const t = createTranslator({
  en: {
    title: "Gradient Map",
    preset: "Presets",
    custom: "Custom",
    blackAndWhite: "B&W",
    sepia: "Sepia",
    duotone: "Duotone",
    rainbow: "Rainbow",
    colorStops: "Colors",
    addStop: "Add Color",
    position: "Pos",
    jsonEdit: "Edit as JSON",
    sortByPosition: "Sort by Position",
    colorAdjustment: "Color Adjustment",
    hue: "Hue",
    saturation: "Saturation",
    lightness: "Lightness",
    apply: "Apply to All Colors",
    strength: "Strength",
  },
  ja: {
    title: "グラデーションマップ",
    preset: "プリセット",
    custom: "カスタム",
    blackAndWhite: "白黒",
    sepia: "セピア",
    duotone: "ツートン",
    rainbow: "虹色",
    colorStops: "カラー",
    addStop: "色を追加",
    position: "位置",
    jsonEdit: "JSONで編集",
    sortByPosition: "位置で並び替え",
    colorAdjustment: "色調補正",
    hue: "色相",
    saturation: "彩度",
    lightness: "明度",
    apply: "すべての色に適用",
    strength: "適用度",
  },
});

// Presets for gradient map
const PRESETS = {
  custom: null, // Custom is handled separately
  blackAndWhite: [
    { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 },
  ],
  sepia: [
    { color: { r: 0.2, g: 0.05, b: 0, a: 1 }, position: 0 },
    { color: { r: 1, g: 0.9, b: 0.7, a: 1 }, position: 1 },
  ],
  duotone: [
    { color: { r: 0.05, g: 0.2, b: 0.6, a: 1 }, position: 0 },
    { color: { r: 1, g: 0.8, b: 0.2, a: 1 }, position: 1 },
  ],
  rainbow: [
    { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 1, g: 1, b: 0, a: 1 }, position: 0.2 },
    { color: { r: 0, g: 1, b: 0, a: 1 }, position: 0.4 },
    { color: { r: 0, g: 1, b: 1, a: 1 }, position: 0.6 },
    { color: { r: 0, g: 0, b: 1, a: 1 }, position: 0.8 },
    { color: { r: 1, g: 0, b: 1, a: 1 }, position: 1 },
  ],
};

// Convert ColorRGBA to HSV string
function colorToHsvString(color: ColorRGBA): string {
  // Convert RGB to HSV
  const r = color.r;
  const g = color.g;
  const b = color.b;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Calculate hue (in degrees 0-360)
  let h = 0;
  if (delta === 0) {
    h = 0; // No color, achromatic (gray)
  } else if (max === r) {
    h = ((g - b) / delta) % 6;
    if (h < 0) h += 6;
    h *= 60;
  } else if (max === g) {
    h = ((b - r) / delta + 2) * 60;
  } else {
    // max === b
    h = ((r - g) / delta + 4) * 60;
  }

  // Calculate saturation (0-100%)
  const s = max === 0 ? 0 : (delta / max) * 100;

  // Calculate value (0-100%)
  const v = max * 100;

  return `hsv(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(v)}%)`;
}

// HSV color adjustment function
function adjustHsv(
  h: number,
  s: number,
  v: number,
  hueAdjust: number,
  saturationAdjust: number,
  lightnessAdjust: number
): [number, number, number] {
  // Adjust hue (0-360 degrees)
  h = (h + hueAdjust) % 360;
  if (h < 0) h += 360; // Ensure positive value

  // Adjust saturation (0-1)
  s = Math.max(0, Math.min(1, s * saturationAdjust));

  // Adjust value/lightness (0-1)
  v = Math.max(0, Math.min(1, v * lightnessAdjust));

  return [h, s, v];
}

// Convert HSV string to ColorRGBA
function hsvStringToColor(hsvStr: string): ColorRGBA {
  // Match hsv(h, s%, v%) format
  const hsvMatch = hsvStr.match(/hsv\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
  if (hsvMatch) {
    const h = parseInt(hsvMatch[1], 10); // 0-360
    const s = parseInt(hsvMatch[2], 10) / 100; // 0-1
    const v = parseInt(hsvMatch[3], 10) / 100; // 0-1

    // Convert HSV to RGB
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0,
      g = 0,
      b = 0;

    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }

    return {
      r: r + m,
      g: g + m,
      b: b + m,
      a: 1,
    };
  }

  // Default to black if can't parse
  return { r: 0, g: 0, b: 0, a: 1 };
}

// Convert preset to JSON string
function presetToJsonString(presetName: string): string {
  if (presetName === "custom") {
    return JSON.stringify([
      ["hsv(0, 0%, 0%)", 0],
      ["hsv(0, 0%, 100%)", 1],
    ]);
  }

  const preset = PRESETS[presetName];
  if (!preset) {
    return JSON.stringify([
      ["hsv(0, 0%, 0%)", 0],
      ["hsv(0, 0%, 100%)", 1],
    ]);
  }

  const jsonArray = preset.map((stop) => [
    colorToHsvString(stop.color),
    stop.position,
  ]);

  return JSON.stringify(jsonArray);
}

// Parse JSON string to color stops and ensure they're sorted
function parseColorStopsJson(jsonStr: string): ColorStop[] {
  try {
    const parsed = JSON.parse(jsonStr) as [string, number][];
    if (!Array.isArray(parsed)) return getDefaultColorStops();

    const colorStops = parsed.map(([colorStr, position]) => ({
      color: hsvStringToColor(colorStr),
      position: position,
    }));

    // Sort by position
    return colorStops;
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return getDefaultColorStops();
  }
}

// Get default color stops
function getDefaultColorStops(): ColorStop[] {
  return [
    { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
    { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 },
  ];
}

export const gradientMap = definePlugin({
  id: "gradient-map",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      preset: {
        type: "string",
        enum: ["custom", "blackAndWhite", "sepia", "duotone", "rainbow"],
        default: "custom",
      },
      colorStops: {
        type: "string",
        default: JSON.stringify([
          ["hsv(0, 0%, 0%)", 0],
          ["hsv(0, 0%, 100%)", 1],
        ]),
      },
      strength: {
        type: "real",
        default: 100.0,
      },
    },
    onEditParameters: (params) => {
      // If using a preset, override colorStops with preset values
      if (params.preset !== "custom" && PRESETS[params.preset]) {
        return {
          ...params,
          colorStops: presetToJsonString(params.preset),
        };
      }

      // Sort the color stops in the JSON string
      try {
        const colorStops = parseColorStopsJson(params.colorStops);
        const sortedJsonStr = JSON.stringify(
          colorStops.map((stop) => [
            colorToHsvString(stop.color),
            stop.position,
          ])
        );

        return {
          ...params,
          colorStops: sortedJsonStr,
        };
      } catch (e) {
        // If JSON parsing fails, return unchanged
        return params;
      }
    },
    onAdjustColors: (params, adjustColor) => {
      try {
        // Parse the JSON string to color stops
        const colorStops = parseColorStopsJson(params.colorStops);

        // Adjust colors in the color stops
        const adjustedColorStops = colorStops.map((stop) => ({
          color: adjustColor(stop.color),
          position: stop.position,
        }));

        // Convert back to JSON string with HSV format
        const adjustedJsonStr = JSON.stringify(
          adjustedColorStops.map((stop) => [
            colorToHsvString(stop.color),
            stop.position,
          ])
        );

        return {
          ...params,
          colorStops: adjustedJsonStr,
        };
      } catch (e) {
        // If JSON parsing fails, return unchanged
        return params;
      }
    },
    onScaleParams(params, scaleFactor) {
      // No scaling needed for gradient map parameters
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // If different presets, just switch at 50%
      if (paramsA.preset !== paramsB.preset) {
        return t < 0.5 ? paramsA : paramsB;
      }

      try {
        // Parse JSON strings to color stops
        const stopsA = parseColorStopsJson(paramsA.colorStops);
        const stopsB = parseColorStopsJson(paramsB.colorStops);

        // For simplicity, we're just interpolating corresponding stops
        // A more advanced version would handle different numbers/positions of stops
        const minLength = Math.min(stopsA.length, stopsB.length);
        const interpolatedStops = [...stopsA];

        for (let i = 0; i < minLength; i++) {
          interpolatedStops[i] = {
            color: {
              r: lerp(stopsA[i].color.r, stopsB[i].color.r, t),
              g: lerp(stopsA[i].color.g, stopsB[i].color.g, t),
              b: lerp(stopsA[i].color.b, stopsB[i].color.b, t),
              a: lerp(stopsA[i].color.a, stopsB[i].color.a, t),
            },
            position: lerp(stopsA[i].position, stopsB[i].position, t),
          };
        }

        // Convert back to JSON string with HSV format
        const interpolatedJsonStr = JSON.stringify(
          interpolatedStops.map((stop) => [
            colorToHsvString(stop.color),
            stop.position,
          ])
        );

        return {
          preset: t < 0.5 ? paramsA.preset : paramsB.preset,
          colorStops: interpolatedJsonStr,
        };
      } catch (e) {
        // If JSON parsing fails, return based on t
        return t < 0.5 ? paramsA : paramsB;
      }
    },

    renderUI: (params, { setParam, useStateObject }) => {
      // Parse color stops from JSON string
      const colorStops = parseColorStopsJson(params.colorStops);

      // Use state object for color adjustment temporary values
      const [colorAdjustState, setColorAdjustState] = useStateObject({
        hueAdjust: 0,
        saturationAdjust: 1.0,
        lightnessAdjust: 1.0,
      });

      // Preset selection handler
      const handlePresetChange: ChangeEventHandler<string> = (e) => {
        const selectedPreset = e.value;
        const jsonStr = presetToJsonString(selectedPreset);
        setParam({ preset: selectedPreset, colorStops: jsonStr });
      };

      // JSON text input handler
      const handleJsonChange: ChangeEventHandler<string> = (e) => {
        try {
          // Validate that it's valid JSON
          JSON.parse(e.value);
          // Update the colorStops parameter
          setParam({ colorStops: e.value, preset: "custom" });
        } catch (err) {
          console.error("Invalid JSON:", err);
        }
      };

      // Color adjustment handlers
      const handleHueChange: ChangeEventHandler<number> = (e) => {
        setColorAdjustState({
          ...colorAdjustState,
          hueAdjust: e.value,
        });
      };

      const handleSaturationChange: ChangeEventHandler<number> = (e) => {
        setColorAdjustState({
          ...colorAdjustState,
          saturationAdjust: e.value,
        });
      };

      const handleLightnessChange: ChangeEventHandler<number> = (e) => {
        setColorAdjustState({
          ...colorAdjustState,
          lightnessAdjust: e.value,
        });
      };

      // Color stop handlers
      const handleColorStopColorChange =
        (index: number): ChangeEventHandler<ColorRGBA> =>
        (e) => {
          const newStops = [...colorStops];
          newStops[index] = { ...colorStops[index], color: e.value };
          // Sort by position
          const sortedStops = newStops.sort((a, b) => a.position - b.position);
          // Convert to JSON string with HSV format
          const jsonStr = JSON.stringify(
            sortedStops.map((s) => [colorToHsvString(s.color), s.position])
          );
          setParam({ colorStops: jsonStr, preset: "custom" });
        };

      const handleColorStopPositionChange =
        (index: number): ChangeEventHandler<number> =>
        (e) => {
          const newStops = [...colorStops];
          newStops[index] = { ...colorStops[index], position: e.value };
          const jsonStr = JSON.stringify(
            newStops.map((s) => [colorToHsvString(s.color), s.position])
          );
          setParam({ colorStops: jsonStr, preset: "custom" });
        };

      const handleColorStopRemove =
        (index: number): ClickEventHandler =>
        () => {
          // Don't allow removing if only 2 stops remain
          if (colorStops.length <= 2) return;

          const newStops = [...colorStops];
          newStops.splice(index, 1);
          // Convert to JSON string with HSV format
          const jsonStr = JSON.stringify(
            newStops.map((s) => [colorToHsvString(s.color), s.position])
          );
          setParam({ colorStops: jsonStr, preset: "custom" });
        };

      // Add color stop handler
      const handleAddColorStop: ClickEventHandler = () => {
        // Determine middle position for new stop
        let newPosition = 0.5;
        if (colorStops.length >= 2) {
          // Find largest gap between stops
          let maxGap = 0;
          let gapPosition = 0.5;

          for (let i = 0; i < colorStops.length - 1; i++) {
            const gap = colorStops[i + 1].position - colorStops[i].position;
            if (gap > maxGap) {
              maxGap = gap;
              gapPosition = colorStops[i].position + gap / 2;
            }
          }
          newPosition = gapPosition;
        }

        // Create a new color by interpolating the colors at neighboring positions
        const newColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

        const newStop = { color: newColor, position: newPosition };
        const newStops = [...colorStops, newStop].sort(
          (a, b) => a.position - b.position
        );

        // Convert to JSON string with HSV format
        const jsonStr = JSON.stringify(
          newStops.map((s) => [colorToHsvString(s.color), s.position])
        );
        setParam({ colorStops: jsonStr, preset: "custom" });
      };

      // Sort by position handler
      const handleSortByPosition: ClickEventHandler = () => {
        // Sort existing color stops by position
        const sortedStops = [...colorStops].sort(
          (a, b) => a.position - b.position
        );

        // Convert to JSON string with HSV format
        const jsonStr = JSON.stringify(
          sortedStops.map((s) => [colorToHsvString(s.color), s.position])
        );

        setParam({ colorStops: jsonStr, preset: "custom" });
      };

      // Apply color adjustments handler
      const handleApplyAdjustments: ClickEventHandler = () => {
        // Get current adjustment values from state
        const { hueAdjust, saturationAdjust, lightnessAdjust } =
          colorAdjustState;

        // Apply adjustments to all color stops
        try {
          const parsed = JSON.parse(params.colorStops) as [string, number][];
          if (!Array.isArray(parsed)) return;

          // Adjust each color stop
          const adjustedStops = parsed.map(([colorStr, position]) => {
            // Parse the HSV string
            const hsvMatch = colorStr.match(
              /hsv\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/
            );
            if (!hsvMatch) return [colorStr, position];

            const h = parseInt(hsvMatch[1], 10);
            const s = parseInt(hsvMatch[2], 10) / 100;
            const v = parseInt(hsvMatch[3], 10) / 100;

            // Apply adjustments
            const [newH, newS, newV] = adjustHsv(
              h,
              s,
              v,
              hueAdjust,
              saturationAdjust,
              lightnessAdjust
            );

            // Create new HSV string
            const newColorStr = `hsv(${Math.round(newH)}, ${Math.round(
              newS * 100
            )}%, ${Math.round(newV * 100)}%)`;

            return [newColorStr, position];
          });

          // Update color stops
          const newJsonStr = JSON.stringify(adjustedStops);

          // Reset adjustment values in state FIRST
          setColorAdjustState({
            hueAdjust: 0,
            saturationAdjust: 1.0,
            lightnessAdjust: 1.0,
          });

          // Then update params to ensure UI refresh
          setParam({
            colorStops: newJsonStr,
            preset: "custom",
          });
        } catch (err) {
          console.error("Failed to apply color adjustments:", err);
        }
      };

      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("preset") }),
          ui.select({
            key: "preset",
            value: params.preset,
            options: [
              { label: t("custom"), value: "custom" },
              { label: t("blackAndWhite"), value: "blackAndWhite" },
              { label: t("sepia"), value: "sepia" },
              { label: t("duotone"), value: "duotone" },
              { label: t("rainbow"), value: "rainbow" },
            ],
            onChange: handlePresetChange
          }),
        ]),

        ui.separator(),

        // Strength slider (0-100%)
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              dataType: 'float',
              min: 0,
              max: 100,
              value: params.strength,
              key: "strength"
            }),
            ui.numberInput({
              dataType: 'float',
              min: 0,
              max: 100,
              value: params.strength,
              key: "strength"
            }),
          ]),
        ]),

        ui.separator(),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("jsonEdit") }),
          ui.textInput({
            value: params.colorStops,
            onChange: handleJsonChange
          }),
        ]),

        ui.separator(),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorStops") }),
          ...colorStops.map((stop, index) =>
            ui.group({ direction: "row" }, [
              ui.colorInput({
                value: stop.color,
                onChange: handleColorStopColorChange(index)
              }),
              ui.text({ text: t("position") }),
              ui.slider({
                dataType: 'float',
                min: 0,
                max: 1,
                value: stop.position,
                onChange: handleColorStopPositionChange(index)
              }),
              ui.numberInput({
                dataType: 'float',
                min: 0,
                max: 1,
                value: stop.position,
                onChange: handleColorStopPositionChange(index)
              }),
              ui.button({
                text: "×",
                disabled: colorStops.length <= 2,
                onClick: handleColorStopRemove(index)
              }),
            ])
          ),
          ui.group({ direction: "row" }, [
            ui.button({
              text: t("addStop"),
              onClick: handleAddColorStop
            }),
            ui.button({
              text: t("sortByPosition"),
              onClick: handleSortByPosition
            }),
          ]),
        ]),

        ui.separator(),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorAdjustment") }),

          // Hue adjustment slider (-180 to +180 degrees)
          ui.group({ direction: "row" }, [
            ui.text({ text: t("hue") }),
            ui.slider({
              dataType: 'int',
              min: -180,
              max: 180,
              value: colorAdjustState.hueAdjust,
              onChange: handleHueChange
            }),
            ui.numberInput({
              dataType: 'int',
              min: -180,
              max: 180,
              value: colorAdjustState.hueAdjust,
              onChange: handleHueChange
            }),
          ]),

          // Saturation adjustment slider (0 to 2)
          ui.group({ direction: "row" }, [
            ui.text({ text: t("saturation") }),
            ui.slider({
              dataType: 'float',
              min: 0,
              max: 2,
              value: colorAdjustState.saturationAdjust,
              onChange: handleSaturationChange
            }),
            ui.numberInput({
              dataType: 'float',
              min: 0,
              max: 2,
              value: colorAdjustState.saturationAdjust,
              onChange: handleSaturationChange
            }),
          ]),

          // Lightness adjustment slider (0 to 2)
          ui.group({ direction: "row" }, [
            ui.text({ text: t("lightness") }),
            ui.slider({
              dataType: 'float',
              min: 0,
              max: 2,
              value: colorAdjustState.lightnessAdjust,
              onChange: handleLightnessChange
            }),
            ui.numberInput({
              dataType: 'float',
              min: 0,
              max: 2,
              value: colorAdjustState.lightnessAdjust,
              onChange: handleLightnessChange
            }),
          ]),

          // Apply button
          ui.button({
            text: t("apply"),
            onClick: handleApplyAdjustments
          }),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Gradient Map)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              colorStopCount: i32,
              strength: f32,
            }

            struct ColorStop {
              color: vec4f,
              position: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;
            @group(0) @binding(4) var<storage, read> colorStops: array<ColorStop>;

            fn getLuminance(color: vec3f) -> f32 {
              // Standard luminance calculation (Rec. 709 coefficients)
              return dot(color, vec3f(0.2126, 0.7152, 0.0722));
            }

            fn getGradientColor(luminance: f32) -> vec4f {
              // Handle edge cases
              if (params.colorStopCount <= 0) {
                return vec4f(luminance, luminance, luminance, 1.0);
              }
              if (params.colorStopCount == 1) {
                return colorStops[0].color;
              }

              // Find the two color stops to interpolate between
              var lowerIndex = 0;
              var upperIndex = 1;

              for (var i = 1; i < params.colorStopCount; i++) {
                if (colorStops[i].position <= luminance) {
                  lowerIndex = i;
                  upperIndex = min(i + 1, params.colorStopCount - 1);
                }
              }

              // Special case: luminance is below first stop
              if (luminance <= colorStops[0].position) {
                return colorStops[0].color;
              }

              // Special case: luminance is above last stop
              if (luminance >= colorStops[params.colorStopCount - 1].position) {
                return colorStops[params.colorStopCount - 1].color;
              }

              // Interpolate between the two color stops
              let lowerStop = colorStops[lowerIndex];
              let upperStop = colorStops[upperIndex];

              let range = upperStop.position - lowerStop.position;
              if (range <= 0.0) {
                return lowerStop.color;
              }

              let factor = (luminance - lowerStop.position) / range;
              // Use Oklch color space interpolation for more perceptually uniform results
              return mixOklabVec4(lowerStop.color, upperStop.color, factor);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // Sample the original color
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // Calculate luminance from RGB
              let luminance = getLuminance(originalColor.rgb);

              // Get color from gradient map
              let gradientColor = getGradientColor(luminance);

              // Apply strength (mix between original and gradient mapped color)
              let mixStrength = params.strength / 100.0; // Convert 0-100% to 0-1
              var finalColor = originalColor; // Initialize with original color

              if (mixStrength >= 1.0) {
                // Full strength - use gradient color directly
                finalColor = vec4f(gradientColor.rgb, originalColor.a);
              } else if (mixStrength <= 0.0) {
                // Zero strength - use original color (already set)
              } else {
                // Mix colors using Oklch interpolation for better results
                finalColor = vec4f(
                  mixOklab(originalColor.rgb, gradientColor.rgb, mixStrength),
                  originalColor.a
                );
              }

              textureStore(resultTexture, id.xy, finalColor);
            }

            // This is includes below 2 functions
            // fn mixOklab(rgbColor1: vec3<f32>, rgbColor2: vec3<f32>, t: f32) -> vec3<f32>;
            // fn mixOklabVec4(rgbColor1: vec4<f32>, rgbColor2: vec4<f32>, t: f32) -> vec4<f32>;
            ${includeOklabMix()}
          `;

          const shader = device.createShaderModule({
            label: "Gradient Map Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Gradient Map Pipeline",
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
      console.log("Gradient Map", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Add WebGPU alignment padding
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Parse color stops from JSON string
      const colorStops = parseColorStopsJson(params.colorStops).sort(
        (a, b) => a.position - b.position
      );

      // Create textures
      const texture = device.createTexture({
        label: "Gradient Map Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Gradient Map Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Gradient Map Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // Create uniform buffer for parameters
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Gradient Map Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Set uniform values
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        colorStopCount: colorStops.length,
        strength: params.strength,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      // Create storage buffer for color stops
      const colorStopData = new Float32Array(colorStops.length * 8); // vec4f + float + padding

      // Fill color stop data
      for (let i = 0; i < colorStops.length; i++) {
        const stop = colorStops[i];
        const baseIndex = i * 8;

        colorStopData[baseIndex] = stop.color.r;
        colorStopData[baseIndex + 1] = stop.color.g;
        colorStopData[baseIndex + 2] = stop.color.b;
        colorStopData[baseIndex + 3] = stop.color.a;
        colorStopData[baseIndex + 4] = stop.position;
        // Indices 5, 6, 7 are padding
      }

      const colorStopBuffer = device.createBuffer({
        label: "Gradient Map Color Stops Buffer",
        size: colorStopData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(colorStopBuffer, 0, colorStopData);

      const bindGroup = device.createBindGroup({
        label: "Gradient Map Main Bind Group",
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
          {
            binding: 4,
            resource: { buffer: colorStopBuffer },
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
        label: "Gradient Map Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Gradient Map Compute Pass",
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
