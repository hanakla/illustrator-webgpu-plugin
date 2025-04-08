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
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
  parseColorCode,
  toColorCode,
} from "./_utils.ts";
import { createGPUDevice, includeOklchMix } from "./_shared.ts";

// 翻訳テキスト
const t = createTranslator({
  en: {
    title: "Color Correction V1",
    conditionTitle: "Color Range Settings",
    condition: "Filter",
    targetColor: "Target Color",
    colorDistance: "Color Distance",
    hsvMode: "HSV Mode",
    hue: "Hue",
    hueRange: "Hue Range",
    saturation: "Saturation",
    saturationRange: "Saturation Range",
    brightness: "Brightness",
    brightnessRange: "Brightness Range",
    adjustments: "Adjustments",
    hueShift: "Hue Shift",
    saturationScale: "Saturation",
    brightnessScale: "Brightness",
    contrast: "Contrast",
    mix: "Mix",
    blendMode: "Blend Mode",
    normal: "Normal",
    add: "Add",
    multiply: "Multiply",
    featherEdges: "Feather Edges",
    previewMask: "Preview Selected Area",
    advanced: "Advanced Settings",
  },
  ja: {
    title: "色調補正 V1",
    conditionTitle: "対象色の範囲",
    condition: "フィルタ",
    targetColor: "対象色",
    colorDistance: "色の距離",
    hsvMode: "HSVモード",
    hue: "色相",
    hueRange: "色相範囲",
    saturation: "彩度",
    saturationRange: "彩度範囲",
    brightness: "明度",
    brightnessRange: "明度範囲",
    adjustments: "調整",
    hueShift: "色相シフト",
    saturationScale: "彩度",
    brightnessScale: "明度",
    contrast: "コントラスト",
    mix: "ミックス",
    blendMode: "ブレンドモード",
    normal: "通常",
    add: "加算",
    multiply: "乗算",
    featherEdges: "エッジをぼかす",
    previewMask: "選択範囲をプレビュー",
    advanced: "詳細設定",
  },
});

const defaultCondition = {
  targetHue: 0.0,
  hueRange: 180.0, // 180以上で「すべての色相」を意味する
  saturationMin: 0.0,
  saturationMax: 1.0,
  brightnessMin: 0.0,
  brightnessMax: 1.0,
};

export const selectiveColorCorrection = definePlugin({
  id: "color-correction-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      // ブレンドモード
      blendMode: {
        type: "string",
        enum: ["normal", "multiply"],
        default: "normal",
      },

      // ミックス (色調補正の適用度合い)
      mix: {
        type: "real",
        default: 1.0,
      },

      // エッジぼかし
      featherEdges: {
        type: "real",
        default: 0.2,
      },

      // マスクプレビュー
      previewMask: {
        type: "bool",
        default: false,
      },

      // 条件を表示するかどうか
      useCondition: {
        type: "bool",
        default: false,
      },

      // 色選択パラメータ
      targetHue: {
        type: "real",
        default: 0.0,
      },
      hueRange: {
        type: "real",
        default: 180.0, // 180以上で「すべての色相」を意味する
      },
      saturationMin: {
        type: "real",
        default: 0.0,
      },
      saturationMax: {
        type: "real",
        default: 1.0,
      },
      brightnessMin: {
        type: "real",
        default: 0.0,
      },
      brightnessMax: {
        type: "real",
        default: 1.0,
      },

      // 調整パラメータ
      hueShift: {
        type: "real",
        default: 0.0,
      },
      saturationScale: {
        type: "real",
        default: 0.0, // -1〜1の範囲 (0がニュートラル)
      },
      brightnessScale: {
        type: "real",
        default: 0.0, // -1〜1の範囲 (0がニュートラル)
      },
      contrast: {
        type: "real",
        default: 0.0, // -1〜1の範囲 (0がニュートラル)
      },
    },
    onAdjustColors: (params, adjustColor) => {
      const dummy: ColorRGBA = { r: 1, g: 0, b: 0, a: 0 };
      // TODO: Implement color adjustment
      return params;
    },
    onEditParameters: (params) => {
      // パラメータの正規化
      const normalizedParams = { ...params };

      // 色相を0-360の範囲に制限
      normalizedParams.targetHue =
        ((normalizedParams.targetHue % 360) + 360) % 360;
      normalizedParams.hueRange = Math.max(
        0,
        Math.min(180, normalizedParams.hueRange)
      );

      // 彩度と明度を0-1の範囲に制限
      normalizedParams.saturationMin = Math.max(
        0,
        Math.min(1, normalizedParams.saturationMin)
      );
      normalizedParams.saturationMax = Math.max(
        normalizedParams.saturationMin,
        Math.min(1, normalizedParams.saturationMax)
      );

      normalizedParams.brightnessMin = Math.max(
        0,
        Math.min(1, normalizedParams.brightnessMin)
      );
      normalizedParams.brightnessMax = Math.max(
        normalizedParams.brightnessMin,
        Math.min(1, normalizedParams.brightnessMax)
      );

      // 調整パラメータの制限
      normalizedParams.hueShift = Math.max(
        -180,
        Math.min(180, normalizedParams.hueShift)
      );
      normalizedParams.saturationScale = Math.max(
        -1,
        Math.min(1, normalizedParams.saturationScale)
      );
      normalizedParams.brightnessScale = Math.max(
        -1,
        Math.min(1, normalizedParams.brightnessScale)
      );
      normalizedParams.contrast = Math.max(
        -1,
        Math.min(1, normalizedParams.contrast)
      );

      // ミックスを0-1の範囲に制限
      normalizedParams.mix = Math.max(0, Math.min(1, normalizedParams.mix));

      // エッジぼかし
      normalizedParams.featherEdges = Math.max(
        0,
        Math.min(1, params.featherEdges)
      );

      return normalizedParams;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // 文字列とブール値のパラメータの補間
      const result = {
        blendMode: t < 0.5 ? paramsA.blendMode : paramsB.blendMode,
        previewMask: t < 0.5 ? paramsA.previewMask : paramsB.previewMask,
        useCondition: t < 0.5 ? paramsA.useCondition : paramsB.useCondition,

        // 数値パラメータの線形補間
        mix: lerp(paramsA.mix, paramsB.mix, t),
        featherEdges: lerp(paramsA.featherEdges, paramsB.featherEdges, t),

        // 色選択パラメータの補間
        targetHue: lerp(paramsA.targetHue, paramsB.targetHue, t),
        hueRange: lerp(paramsA.hueRange, paramsB.hueRange, t),
        saturationMin: lerp(paramsA.saturationMin, paramsB.saturationMin, t),
        saturationMax: lerp(paramsA.saturationMax, paramsB.saturationMax, t),
        brightnessMin: lerp(paramsA.brightnessMin, paramsB.brightnessMin, t),
        brightnessMax: lerp(paramsA.brightnessMax, paramsB.brightnessMax, t),

        // 調整パラメータの補間
        hueShift: lerp(paramsA.hueShift, paramsB.hueShift, t),
        saturationScale: lerp(
          paramsA.saturationScale,
          paramsB.saturationScale,
          t
        ),
        brightnessScale: lerp(
          paramsA.brightnessScale,
          paramsB.brightnessScale,
          t
        ),
        contrast: lerp(paramsA.contrast, paramsB.contrast, t),
      };

      return result;
    },

    renderUI: (params, setParam) => {
      const adjustmentsComponent = ui.group({ direction: "col" }, [
        // 色相シフト
        ui.group({ direction: "col" }, [
          ui.text({ text: t("hueShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "hueShift",
              dataType: "float",
              min: -180,
              max: 180,
              value: params.hueShift,
            }),
            ui.numberInput({
              key: "hueShift",
              dataType: "float",
              value: params.hueShift,
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ hueShift: 0 });
              },
            }),
          ]),
        ]),

        // 彩度調整
        ui.group({ direction: "col" }, [
          ui.text({ text: t("saturationScale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "saturationScale",
              dataType: "float",
              min: -1,
              max: 1,
              value: params.saturationScale,
            }),
            ui.numberInput({
              key: "saturationScale",
              dataType: "float",
              value: params.saturationScale,
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ saturationScale: 0 });
              },
            }),
          ]),
        ]),

        // 明度調整
        ui.group({ direction: "col" }, [
          ui.text({ text: t("brightnessScale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "brightnessScale",
              dataType: "float",
              min: -1,
              max: 1,
              value: params.brightnessScale,
            }),
            ui.numberInput({
              key: "brightnessScale",
              dataType: "float",
              value: params.brightnessScale,
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ brightnessScale: 0 });
              },
            }),
          ]),
        ]),

        // コントラスト
        ui.group({ direction: "col" }, [
          ui.text({ text: t("contrast") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "contrast",
              dataType: "float",
              min: -1,
              max: 1,
              value: params.contrast,
            }),
            ui.numberInput({
              key: "contrast",
              dataType: "float",
              value: params.contrast,
            }),
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ contrast: 0 });
              },
            }),
          ]),
        ]),

        // ミックス
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
            ui.button({
              text: "Reset",
              onClick: () => {
                setParam({ mix: 1.0 });
              },
            }),
          ]),
        ]),
      ]);

      // 色選択UIコンポーネント
      const colorConditionComponent = ui.group({ direction: "col" }, [
        // 選択範囲をプレビュー（色選択条件セクション内の一番上に移動）
        ui.checkbox({
          key: "previewMask",
          value: params.previewMask,
          label: t("previewMask"),
        }),

        // エッジをぼかす（選択範囲をプレビューの下に配置）
        ui.group({ direction: "col" }, [
          ui.text({ text: t("featherEdges") }),
          ui.slider({
            key: "featherEdges",
            dataType: "float",
            min: 0,
            max: 1,
            value: params.featherEdges,
          }),
        ]),

        ui.separator(),

        // 色相設定
        ui.group({ direction: "col" }, [
          ui.text({ text: t("hue") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "targetHue",
              dataType: "float",
              min: 0,
              max: 360,
              value: params.targetHue,
            }),
            ui.numberInput({
              key: "targetHue",
              dataType: "float",
              value: params.targetHue,
            }),
          ]),
        ]),

        // 色相範囲
        ui.group({ direction: "col" }, [
          ui.text({ text: t("hueRange") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "hueRange",
              dataType: "float",
              min: 0,
              max: 180,
              value: params.hueRange,
            }),
            ui.numberInput({
              key: "hueRange",
              dataType: "float",
              value: params.hueRange,
            }),
          ]),
        ]),

        // 彩度範囲
        ui.group({ direction: "col" }, [
          ui.text({ text: t("saturationRange") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "saturationMin",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.saturationMin,
            }),
            ui.text({ text: "-" }),
            ui.slider({
              key: "saturationMax",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.saturationMax,
            }),
          ]),
        ]),

        // 明度範囲
        ui.group({ direction: "col" }, [
          ui.text({ text: t("brightnessRange") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "brightnessMin",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.brightnessMin,
            }),
            ui.text({ text: "-" }),
            ui.slider({
              key: "brightnessMax",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.brightnessMax,
            }),
          ]),
        ]),
      ]);

      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.group({ direction: "row" }, [
            ui.text({ text: t("blendMode") }),
            ui.select({
              key: "blendMode",
              value: params.blendMode,
              options: [
                { label: t("normal"), value: "normal" },
                { label: t("multiply"), value: "multiply" }
              ]
            }),
          ]),
        ]),

        ui.separator(),

        ui.text({ text: t("adjustments") }),
        adjustmentsComponent,

        ui.separator(),

        ui.checkbox({
          key: "useCondition",
          value: params.useCondition,
          label: t("conditionTitle"),
        }),

        // 条件セクション（チェックボックスがオンの場合のみ表示）
        params.useCondition ? colorConditionComponent : null,
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Selective Color Correction)" },
        },
        (device) => {
          const code = `
            struct ColorCondition {
              targetHue: f32,
              hueRange: f32,
              saturationMin: f32,
              saturationMax: f32,
              brightnessMin: f32,
              brightnessMax: f32,
              hueShift: f32,
              saturationScale: f32,
              brightnessScale: f32,
              contrast: f32,
            }

            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              blendMode: i32,  // 0: normal, 1: multiply
              featherEdges: f32,
              previewMask: i32,
              mix: f32,
              @align(16) condition: ColorCondition,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // RGB to HSV conversion
            fn rgb2hsv(rgb: vec3f) -> vec3f {
              let K = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
              let p = mix(vec4f(rgb.bg, K.wz), vec4f(rgb.gb, K.xy), step(rgb.b, rgb.g));
              let q = mix(vec4f(p.xyw, rgb.r), vec4f(rgb.r, p.yzx), step(p.x, rgb.r));

              let d = q.x - min(q.w, q.y);
              let e = 1.0e-10;

              return vec3f(
                abs(q.z + (q.w - q.y) / (6.0 * d + e)),
                d / (q.x + e),
                q.x
              );
            }

            // HSV to RGB conversion
            fn hsv2rgb(hsv: vec3f) -> vec3f {
              let K = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
              let p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);

              return hsv.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), hsv.y);
            }

            // 色条件に基づくマッチ係数を計算
            fn calculateMatchFactor(hsv: vec3f, condition: ColorCondition, featherAmount: f32) -> f32 {
              // 色相範囲が360度（または十分大きい値）の場合、すべての色相がマッチするとみなす
              let isFullHueRange = condition.hueRange >= 180.0;

              var hueMatch = 0.0;
              if (isFullHueRange) {
                // 色相範囲が最大の場合は、色相に関係なく完全マッチ
                hueMatch = 1.0;
              } else {
                // 色相を0-1に正規化
                let targetHueNorm = condition.targetHue / 360.0;
                let hueRangeNorm = condition.hueRange / 360.0;

                // 色相の距離を計算（色相は循環するので最短距離を考慮）
                var hueDist = abs(hsv.x - targetHueNorm);
                hueDist = min(hueDist, 1.0 - hueDist); // 循環性を考慮

                // 色相のマッチ度を計算（フェザリングを考慮）
                if (hueDist <= hueRangeNorm) {
                  // エッジをぼかすためのスムースステップ
                  if (featherAmount > 0.0) {
                    let featherEdge = hueRangeNorm * featherAmount;
                    let innerEdge = hueRangeNorm - featherEdge;

                    if (hueDist <= innerEdge) {
                      hueMatch = 1.0;
                    } else {
                      hueMatch = 1.0 - smoothstep(innerEdge, hueRangeNorm, hueDist);
                    }
                  } else {
                    hueMatch = 1.0;
                  }
                }
              }

              // 彩度と明度の条件チェック
              // 彩度範囲が最大（min=0, max=1）の場合は常にマッチ
              let isFullSatRange = condition.saturationMin <= 0.01 && condition.saturationMax >= 0.99;
              var satMatch = 0.0;

              if (isFullSatRange) {
                satMatch = 1.0;
              } else if (hsv.y >= condition.saturationMin && hsv.y <= condition.saturationMax) {
                // エッジをぼかす
                let satLowerDist = hsv.y - condition.saturationMin;
                let satUpperDist = condition.saturationMax - hsv.y;
                let satEdge = (condition.saturationMax - condition.saturationMin) * featherAmount * 0.5;

                if (satLowerDist >= satEdge && satUpperDist >= satEdge) {
                  satMatch = 1.0;
                } else {
                  satMatch = min(
                    smoothstep(0.0, satEdge, satLowerDist),
                    smoothstep(0.0, satEdge, satUpperDist)
                  );
                }
              }

              // 明度範囲が最大（min=0, max=1）の場合は常にマッチ
              let isFullBrightRange = condition.brightnessMin <= 0.01 && condition.brightnessMax >= 0.99;
              var brightMatch = 0.0;

              if (isFullBrightRange) {
                brightMatch = 1.0;
              } else if (hsv.z >= condition.brightnessMin && hsv.z <= condition.brightnessMax) {
                // エッジをぼかす
                let brightLowerDist = hsv.z - condition.brightnessMin;
                let brightUpperDist = condition.brightnessMax - hsv.z;
                let brightEdge = (condition.brightnessMax - condition.brightnessMin) * featherAmount * 0.5;

                if (brightLowerDist >= brightEdge && brightUpperDist >= brightEdge) {
                  brightMatch = 1.0;
                } else {
                  brightMatch = min(
                    smoothstep(0.0, brightEdge, brightLowerDist),
                    smoothstep(0.0, brightEdge, brightUpperDist)
                  );
                }
              }

              // 全ての条件を組み合わせる
              return hueMatch * satMatch * brightMatch;
            }

            fn adjustColor(hsv: vec3f, condition: ColorCondition) -> vec3f {
              var adjustedHsv = hsv;

              // Shift hue
              adjustedHsv.x = fract(adjustedHsv.x + condition.hueShift / 360.0);

              // Saturation (Neutral at 1.0)
              if (condition.saturationScale < 1.0) {
                // 0-1 range: Decrease saturation
                adjustedHsv.y = adjustedHsv.y * condition.saturationScale;
              } else if (condition.saturationScale > 1.0) {
                // 1-2 range: Increase saturation
                let saturationIncrease = (condition.saturationScale - 1.0);
                adjustedHsv.y = adjustedHsv.y + (1.0 - adjustedHsv.y) * saturationIncrease;
              }

              // Brightness (Neutral at 1.0)
              if (condition.brightnessScale < 1.0) {
                adjustedHsv.z = adjustedHsv.z * condition.brightnessScale;
              } else if (condition.brightnessScale > 1.0) {
                let brightnessIncrease = (condition.brightnessScale - 1.0);
                adjustedHsv.z = adjustedHsv.z + (1.0 - adjustedHsv.z) * brightnessIncrease;
              }

              var rgb = hsv2rgb(adjustedHsv);

              if (condition.contrast != 1.0) {
                let mid = vec3f(0.5);
                rgb = mix(mid, rgb, condition.contrast);
              }

              return rgb;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let originalHsv = rgb2hsv(originalColor.rgb);

              var finalColor = originalColor.rgb;
              var matchFactor = calculateMatchFactor(originalHsv, params.condition, params.featherEdges);
              var maskColor = vec3f(0.0);

              if (matchFactor > 0.0) {
                let adjustedRgb = adjustColor(originalHsv, params.condition);

                if (params.blendMode == 0) { // Normal
                  finalColor = mix(originalColor.rgb, adjustedRgb, matchFactor);
                } else { // Multiply
                  var currentColor = originalColor.rgb;
                  currentColor = mix(currentColor, adjustedRgb, matchFactor * 0.5);

                  let secondHsv = rgb2hsv(currentColor);
                  let secondAdjusted = adjustColor(secondHsv, params.condition);
                  finalColor = mix(currentColor, secondAdjusted, matchFactor * 0.5);
                }

                maskColor = vec3f(matchFactor);
              }

              if (params.previewMask != 0) {
                textureStore(resultTexture, id.xy, vec4f(maskColor, originalColor.a));
              } else {
                let mixedColor = mixOklch(originalColor.rgb, finalColor, params.mix);
                textureStore(resultTexture, id.xy, vec4f(mixedColor, originalColor.a));
              }
            }

            // This is includes below 2 functions
            // fn mixOklch(color1: vec3<f32>, color2: vec3<f32>, t: f32) -> vec3<f32>;
            // fn mixOklchVec4(color1: vec4<f32>, color2: vec4<f32>, t: f32) -> vec4<f32>;
            ${includeOklchMix()}
          `;

          const shader = device.createShaderModule({
            label: "Selective Color Correction Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Selective Color Correction Pipeline",
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
      console.log("Selective Color Correction V1", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // WebGPUの256バイトアライメントに合わせる
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // テクスチャの作成
      const texture = device.createTexture({
        label: "Selective Color Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Selective Color Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Selective Color Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
      });

      // ユニフォームバッファの作成
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Selective Color Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // ブレンドモードの整数値変換
      const blendModeInt = params.blendMode === "multiply" ? 1 : 0;

      // ユニフォーム値を設定
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        blendMode: blendModeInt,
        featherEdges: params.featherEdges,
        previewMask: params.previewMask ? 1 : 0,
        mix: params.mix,
        condition: {
          ...(params.useCondition ? params : defaultCondition),

          // JSの-1〜1の値をシェーダーで使う0〜2の値に変換
          hueShift: params.hueShift,
          saturationScale: params.saturationScale + 1.0, // -1〜1 → 0〜2
          brightnessScale: params.brightnessScale + 1.0, // -1〜1 → 0〜2
          contrast: params.contrast + 1.0, // -1〜1 → 0〜2

          _padding1: 0,
          _padding2: 0,
        },
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Selective Color Main Bind Group",
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

      // ソーステクスチャの更新
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      // コンピュートシェーダーの実行
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Selective Color Compute Pass",
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();

      // 結果をステージングバッファにコピー
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );

      device.queue.submit([commandEncoder.finish()]);

      // 結果を読み取り
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );

      // WebGPUのパディングを元のサイズに戻す
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
