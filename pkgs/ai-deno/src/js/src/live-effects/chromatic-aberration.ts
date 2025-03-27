import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui/nodes.ts";
import { texts, createTranslator } from "../ui/locale.ts";
import {
  addWebGPUAlignmentPadding,
  lerp,
  paddingImageData,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

const t = createTranslator(
  texts({
    en: {
      title: "Chromatic Aberration V1",
      colorMode: "Color Mode",
      shiftType: "Shift Type",
      shiftTypeMove: "Move",
      shiftTypeZoom: "Zoom",
      strength: "Strength",
      angle: "Angle",
      opacity: "Opacity",
      blendMode: "Blend Mode",
      blendOver: "Over",
      blendeUnder: "Under",
      pastelMode: "Pastel",
      useFocusPoint: "Use Focus Point",
      focusPointX: "Focus Point X",
      focusPointY: "Focus Point Y",
      focusGradient: "Focus Gradient",
    },
    ja: {
      title: "色収差 V1",
      colorMode: "カラーモード",
      shiftType: "ずれタイプ",
      shiftTypeMove: "移動",
      shiftTypeZoom: "ズーム",
      strength: "強度",
      angle: "角度",
      opacity: "不透明度",
      blendMode: "ブレンドモード",
      blendOver: "上に合成",
      blendeUnder: "下に合成",
      pastelMode: "パステル",
      useFocusPoint: "フォーカスポイント使用",
      focusPointX: "フォーカスポイントX",
      focusPointY: "フォーカスポイントY",
      focusGradient: "フォーカス勾配",
    },
  })
);

export const chromaticAberration = definePlugin({
  id: "chromatic-aberration-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },

  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      colorMode: {
        type: "string",
        enum: ["rgb", "cmyk", "pastel", "rc"],
        default: "rgb",
      },
      shiftType: {
        type: "string",
        enum: ["move", "zoom"],
        default: "move",
      },
      strength: {
        type: "real",
        default: 1.0,
      },
      angle: {
        type: "real",
        default: 0.0,
      },
      opacity: {
        type: "real",
        default: 100,
      },
      blendMode: {
        type: "string",
        enum: ["over", "under"],
        default: "under",
      },
      useFocusPoint: {
        type: "bool",
        default: false,
      },
      focusPointX: {
        type: "real",
        default: 0.5,
      },
      focusPointY: {
        type: "real",
        default: 0.5,
      },
      focusGradient: {
        type: "real",
        default: 0.5,
      },
    },
    onEditParameters: (params) => params,
    onAdjustColors: (params, adjustColor) => params,
    onInterpolate: (params, paramsB, progress) => ({
      colorMode: params.colorMode,
      shiftType: params.shiftType,
      strength: lerp(params.strength, paramsB.strength, progress),
      angle: lerp(params.angle, paramsB.angle, progress),
      opacity: lerp(params.opacity, paramsB.opacity, progress),
      blendMode: params.blendMode,
      useFocusPoint: params.useFocusPoint,
      focusPointX: lerp(params.focusPointX, paramsB.focusPointX, progress),
      focusPointY: lerp(params.focusPointY, paramsB.focusPointY, progress),
      focusGradient: lerp(
        params.focusGradient,
        paramsB.focusGradient,
        progress
      ),
    }),
    onScaleParams: (params, scale) => ({
      colorMode: params.colorMode,
      shiftType: params.shiftType,
      strength: params.strength * scale,
      angle: params.angle,
      opacity: params.opacity,
      blendMode: params.blendMode,
      useFocusPoint: params.useFocusPoint,
      focusPointX: params.focusPointX,
      focusPointY: params.focusPointY,
      focusGradient: params.focusGradient,
    }),
    renderUI: (params) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorMode") }),
          ui.select({ key: "colorMode", value: params.colorMode, options: [
            {value: 'rgb', label: "RGB"},
            {value: 'cmyk', label: "CMYK"},
            {value: "rc", label: "Red & Cyan"},
            {value: 'pastel', label: t("pastelMode")},
          ]}),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("shiftType") }),
          ui.select({ key: "shiftType", value: params.shiftType, options: [
            {value: 'move', label: t("shiftTypeMove")},
            {value: 'zoom', label: t("shiftTypeZoom")},
          ] }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "strength", dataType: 'float', min: 0, max: 200, value: params.strength }),
            ui.numberInput({ key: "strength", dataType: 'float', value: params.strength }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "angle", dataType: 'float', min: 0, max: 360, value: params.angle }),
            ui.numberInput({ key: "angle", dataType: 'float', value: params.angle }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("opacity")}),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "opacity", dataType: 'float', min: 0, max: 100, value: params.opacity }),
            ui.numberInput({ key: "opacity", dataType: 'float', value: params.opacity }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Blend Mode"}),
          ui.select({ key: "blendMode", value: params.blendMode, options: [
            {value: 'over', label: t("blendOver")},
            {value: 'under', label: t('blendeUnder')}
          ]}),
        ]),

        ui.separator(),

        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "useFocusPoint", label: t("useFocusPoint"), value: params.useFocusPoint }),
        ]),

        !params.useFocusPoint ? null : (
          ui.group({ direction: "col" }, [
            ui.group({ direction: "col" }, [
              ui.text({ text: t("focusPointX") }),
              ui.group({ direction: "row" }, [
                ui.slider({ key: "focusPointX", dataType: 'float', min: 0, max: 1, value: params.focusPointX }),
                ui.numberInput({ key: "focusPointX", dataType: 'float', value: params.focusPointX }),
              ]),
            ]),

            ui.group({ direction: "col" }, [
              ui.text({ text: t("focusPointY") }),
              ui.group({ direction: "row" }, [
                ui.slider({ key: "focusPointY", dataType: 'float', min: 0, max: 1, value: params.focusPointY }),
                ui.numberInput({ key: "focusPointY", dataType: 'float', value: params.focusPointY }),
              ]),
            ]),

            ui.group({ direction: "col" }, [
              ui.text({ text: t("focusGradient") }),
              ui.group({ direction: "row" }, [
                ui.slider({ key: "focusGradient", dataType: 'float', min: 0.1, max: 5, value: params.focusGradient }),
                ui.numberInput({ key: "focusGradient", dataType: 'float', value: params.focusGradient }),
              ]),
            ]),
          ])
        ),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, async (device) => {
        const code = `
          struct Params {
            outputSize: vec2i,
            dpiScale: f32,
            strength: f32,
            angle: f32,
            colorMode: u32,  // 0: RGB, 1: CMYK, 2: Pastel, 3: Red & Cyan
            opacity: f32,
            blendMode: u32,  // 0: over, 1: under
            useFocusPoint: u32,  // 0: false, 1: true
            focusPointX: f32,
            focusPointY: f32,
            focusGradient: f32,
            isInPreview: u32,  // 0: false, 1: true
            shiftType: u32  // 0: move, 1: zoom
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          fn getOffset(angle: f32) -> vec2f {
            let radians = angle * 3.14159 / 180.0;
            return vec2f(cos(radians), sin(radians));
          }

          fn screenBlend(a: f32, b: f32) -> f32 {
              return 1.0 - (1.0 - a) * (1.0 - b);
          }

          // RGB から CMYK への変換関数
          fn rgbToCmyk(rgb: vec3f) -> vec4f {
              let r = rgb.r;
              let g = rgb.g;
              let b = rgb.b;

              let k = 1.0 - max(max(r, g), b);

              // 黒が1.0（完全な黒）の場合、他のチャンネルは0に
              if (k == 1.0) {
                  return vec4f(0.0, 0.0, 0.0, 1.0);
              }

              let c = (1.0 - r - k) / (1.0 - k);
              let m = (1.0 - g - k) / (1.0 - k);
              let y = (1.0 - b - k) / (1.0 - k);

              return vec4f(c, m, y, k);
          }

          // CMYK から RGB への変換関数
          fn cmykToRgb(cmyk: vec4f) -> vec3f {
              let c = cmyk.x;
              let m = cmyk.y;
              let y = cmyk.z;
              let k = cmyk.w;

              let r = (1.0 - c) * (1.0 - k);
              let g = (1.0 - m) * (1.0 - k);
              let b = (1.0 - y) * (1.0 - k);

              return vec3f(r, g, b);
          }

          // RGB各チャンネルをパステルカラーに変換する関数
          fn rgbChannelToPastel(r: f32, g: f32, b: f32) -> vec3f {
              // R -> パステルピンク (赤+少し青)
              let pastelPink = vec3f(min(r * 1.0, 1.0), r * 0.6, r * 0.8);

              // G -> パステルイエロー (緑+赤)
              let pastelYellow = vec3f(g * 0.8, min(g * 1.0, 1.0), g * 0.2);

              // B -> パステルシアン (青+緑)
              let pastelCyan = vec3f(b * 0.2, b * 0.8, min(b * 1.0, 1.0));

              return pastelPink + pastelYellow + pastelCyan;
          }

          // チャンネルの重なり具合を検出する関数
          fn detectChannelOverlap(r: f32, g: f32, b: f32) -> f32 {
            // 各チャンネルの存在を確認 (しきい値0.15以上で存在とみなす)
            let threshold = 0.15;
            let hasR = select(0.0, 1.0, r > threshold);
            let hasG = select(0.0, 1.0, g > threshold);
            let hasB = select(0.0, 1.0, b > threshold);

            // 存在するチャンネルの数
            let channelCount = hasR + hasG + hasB;

            // 3チャンネルすべてが存在する場合は1.0、そうでなければ0.0
            return select(0.0, 1.0, channelCount >= 2.5);
          }

          // フォーカスポイントにリングを描画する関数
          fn drawFocusRing(texCoord: vec2f, focusPoint: vec2f) -> f32 {
            let distance = length(texCoord - focusPoint);

            // リングの内側と外側の半径
            let innerRadius = 0.02;
            let outerRadius = 0.02;

            // 円の中が0.0、円の外が1.0になるようなスムーズな値を生成
            let ring = smoothstep(innerRadius - 0.005, innerRadius, distance) * (1.0 - smoothstep(outerRadius, outerRadius + 0.005, distance));

            return ring;
          }

          fn calculateDistanceBasedOffset(texCoord: vec2f, focusPoint: vec2f, baseOffset: vec2f, gradient: f32) -> vec2f {
            // フォーカスポイントからの距離を計算（0-1の範囲）
            let distance = length(texCoord - focusPoint);

            // 勾配に基づいて距離の効果を調整
            // gradientが1.0の場合は線形、大きいほど急峻、小さいほど緩やか
            let adjustedDistance = pow(distance, gradient);

            // 調整された距離に応じてオフセットを調整
            return baseOffset * adjustedDistance;
          }

          fn calculateZoomOffset(texCoord: vec2f, focusPoint: vec2f, strength: f32) -> vec2f {
            let direction = texCoord - focusPoint;
            let zoomStrength = strength / 100.0;
            return direction * zoomStrength;
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
            let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
            let dims = vec2f(params.outputSize);
            let texCoord = vec2f(id.xy) / dims;
            let toInputTexCoord = dims / dimsWithGPUPadding;

            // strengthをピクセル単位として処理し、テクスチャ座標に変換
            let basePixelOffset = getOffset(params.angle) * params.strength * params.dpiScale;
            let baseTexOffset = basePixelOffset / dims;

            // フォーカスポイント位置を取得（使用しない場合はデフォルト0.5, 0.5）
            let focusPoint = select(
              vec2f(0.5, 0.5),
              vec2f(params.focusPointX, params.focusPointY),
              params.useFocusPoint != 0u
            );

            // ずれタイプに応じてオフセットを計算
            var texOffset: vec2f;
            if (params.shiftType == 0u) { // 移動モード
              if (params.useFocusPoint != 0u) {
                texOffset = calculateDistanceBasedOffset(texCoord, focusPoint, baseTexOffset, params.focusGradient);
              } else {
                texOffset = baseTexOffset;
              }
            } else { // ズームモード
              let zoomOffset = calculateZoomOffset(texCoord, focusPoint, params.strength);

              // 角度に基づいて回転させる
              let angleRad = params.angle * 3.14159 / 180.0;
              let rotCos = cos(angleRad);
              let rotSin = sin(angleRad);
              let rotatedOffset = vec2f(
                zoomOffset.x * rotCos - zoomOffset.y * rotSin,
                zoomOffset.x * rotSin + zoomOffset.y * rotCos
              );

              texOffset = rotatedOffset;

              // フォーカスポイント使用時は距離に基づいて効果を調整
              if (params.useFocusPoint != 0u) {
                let distance = length(texCoord - focusPoint);
                let adjustedDistance = pow(distance, params.focusGradient);
                texOffset = texOffset * adjustedDistance;
              }
            }

            let opacityFactor = params.opacity / 100.0;

            var effectColor: vec4f;
            let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

            if (params.colorMode == 0u) { // RGB mode
              let redOffset = texCoord + texOffset;
              let blueOffset = texCoord - texOffset;

              let rs = textureSampleLevel(inputTexture, textureSampler, redOffset * toInputTexCoord, 0.0);
              let gs = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);
              let bs = textureSampleLevel(inputTexture, textureSampler, blueOffset * toInputTexCoord, 0.0);

              let a_red = rs.a;
              let a_green = gs.a;
              let a_blue = bs.a;

              let a = screenBlend(screenBlend(a_red, a_green), a_blue);

              effectColor = vec4f(
                rs.r,
                gs.g,
                bs.b,
                a
              );
            } else if (params.colorMode == 1u) { // CMYK mode
              let cyanOffset = texCoord + texOffset;
              let magentaOffset = texCoord + vec2f(-texOffset.y, texOffset.x) * 0.866;
              let yellowOffset = texCoord - texOffset;

              let cs = textureSampleLevel(inputTexture, textureSampler, cyanOffset * toInputTexCoord, 0.0);
              let ms = textureSampleLevel(inputTexture, textureSampler, magentaOffset * toInputTexCoord, 0.0);
              let ys = textureSampleLevel(inputTexture, textureSampler, yellowOffset * toInputTexCoord, 0.0);
              let origs = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              let cyanColor = vec3f(cs.r * 0.3, cs.g * 1.0, cs.b * 1.0);
              let magentaColor = vec3f(ms.r * 1.0, ms.g * 0.3, ms.b * 1.0);
              let yellowColor = vec3f(ys.r * 1.0, ys.g * 1.0, ys.b * 0.3);

              let combinedColor = vec3f(
                  max(max(cyanColor.r, magentaColor.r), yellowColor.r),
                  max(max(cyanColor.g, magentaColor.g), yellowColor.g),
                  max(max(cyanColor.b, magentaColor.b), yellowColor.b)
              );

              let a = screenBlend(screenBlend(cs.a, ms.a), ys.a) * opacityFactor;

              let strengthFactor = params.strength;
              let blendRatio = clamp(strengthFactor, 0.0, 1.0);
              let result = mixOklch(origs.rgb, combinedColor, blendRatio);

              effectColor = vec4f(result, a);
            } else if (params.colorMode == 2u) { // Pastel mode
              let ch1Offset = texCoord + texOffset;
              let ch2Offset = texCoord + vec2f(-texOffset.y, texOffset.x) * 0.866;
              let ch3Offset = texCoord - texOffset;

              let ch1s = textureSampleLevel(inputTexture, textureSampler, ch1Offset * toInputTexCoord, 0.0);
              let ch2s = textureSampleLevel(inputTexture, textureSampler, ch2Offset * toInputTexCoord, 0.0);
              let ch3s = textureSampleLevel(inputTexture, textureSampler, ch3Offset * toInputTexCoord, 0.0);
              let origs = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // pastel color
              let ch1 = vec3f(ch1s.r * 0.56, ch1s.g * 0.29, ch1s.b * 0.42);
              let ch2 = vec3f(ch2s.r * 0, ch2s.g * 0.28, ch2s.b * 0.45);
              let ch3 = vec3f(ch3s.r * 0.44, ch3s.g * 0.43, ch3s.b * 0.13);

              var combinedColor = vec3f(
                ch1.r + ch2.r + ch3.r,
                ch1.g + ch2.g + ch3.g,
                ch1.b + ch2.b + ch3.b,
              );

              let a = screenBlend(screenBlend(ch1s.a, ch2s.a), ch3s.a) * opacityFactor;

              let strengthFactor = params.strength;
              let blendRatio = clamp(strengthFactor, 0.0, 1.0);
              let result = mixOklch(origs.rgb, combinedColor, blendRatio);

              effectColor = vec4f(result, a);
            } else if (params.colorMode == 3u) { // Red & Cyan mode
              let redOffset = texCoord + texOffset;
              let cyanOffset = texCoord - texOffset;

              let rs = textureSampleLevel(inputTexture, textureSampler, redOffset * toInputTexCoord, 0.0);
              let gs = textureSampleLevel(inputTexture, textureSampler, cyanOffset * toInputTexCoord, 0.0);
              let bs = textureSampleLevel(inputTexture, textureSampler, cyanOffset * toInputTexCoord, 0.0);

              let a_red = rs.a;
              let a_green = gs.a;
              let a_blue = bs.a;

              let a = screenBlend(screenBlend(a_red, a_green), a_blue);

              effectColor = vec4f(
                rs.r,
                gs.g,
                bs.b,
                a
              );
            }

            // 不透明度に基づいてエフェクトの強さを調整
            // 不透明度が0の場合は元の画像をそのまま表示し、1の場合はエフェクトを完全に適用
            var finalColor: vec4f;

            if (opacityFactor <= 0.0) {
              // 不透明度が0以下の場合は元の画像をそのまま表示
              finalColor = originalColor;
            } else {
              // 通常のブレンド処理
              let blendedRgb = mixOklch(originalColor.rgb, effectColor.rgb, opacityFactor);

              // アルファ値の調整（元の透明度を維持）
              let alphaDifference = effectColor.a - originalColor.a;
              let adjustedAlpha = originalColor.a + alphaDifference * opacityFactor;

              finalColor = vec4f(blendedRgb, adjustedAlpha);
            }

            // プレビュー時にフォーカスポイントを表示
            if (params.useFocusPoint != 0u && params.isInPreview != 0u) {
              let focusPoint = vec2f(params.focusPointX, params.focusPointY);
              let ringIntensity = drawFocusRing(texCoord, focusPoint);

              let ringColor = vec4f(1.0, 1.0, 0.3, 1.0);

              finalColor = mixOklchVec4(finalColor, ringColor, ringIntensity);
            }

            textureStore(resultTexture, id.xy, finalColor);
          }

          // Drop-in replacement for mix() that works with vec3f rgb colors
          fn mixOklch(color1: vec3<f32>, color2: vec3<f32>, t: f32) -> vec3<f32> {
            // RGB -> Linear RGB
            let linearColor1 = vec3<f32>(
              select(color1.r / 12.92, pow((color1.r + 0.055) / 1.055, 2.4), color1.r <= 0.04045),
              select(color1.g / 12.92, pow((color1.g + 0.055) / 1.055, 2.4), color1.g <= 0.04045),
              select(color1.b / 12.92, pow((color1.b + 0.055) / 1.055, 2.4), color1.b <= 0.04045),
            );

            let linearColor2 = vec3<f32>(
              select(color2.r / 12.92, pow((color2.r + 0.055) / 1.055, 2.4), color2.r <= 0.04045),
              select(color2.g / 12.92, pow((color2.g + 0.055) / 1.055, 2.4), color2.g <= 0.04045),
              select(color2.b / 12.92, pow((color2.b + 0.055) / 1.055, 2.4), color2.b <= 0.04045),
            );

            // Linear RGB -> LMS
            let lms1 = mat3x3<f32>(
              0.4122214708, 0.5363325363, 0.0514459929,
              0.2119034982, 0.6806995451, 0.1073969566,
              0.0883024619, 0.2817188376, 0.6299787005
            ) * linearColor1;

            let lms2 = mat3x3<f32>(
              0.4122214708, 0.5363325363, 0.0514459929,
              0.2119034982, 0.6806995451, 0.1073969566,
              0.0883024619, 0.2817188376, 0.6299787005
            ) * linearColor2;

            // LMS -> Oklab
            let lms1_pow = vec3<f32>(pow(lms1.x, 1.0/3.0), pow(lms1.y, 1.0/3.0), pow(lms1.z, 1.0/3.0));
            let lms2_pow = vec3<f32>(pow(lms2.x, 1.0/3.0), pow(lms2.y, 1.0/3.0), pow(lms2.z, 1.0/3.0));

            let oklabMatrix = mat3x3<f32>(
              0.2104542553, 0.7936177850, -0.0040720468,
              1.9779984951, -2.4285922050, 0.4505937099,
              0.0259040371, 0.7827717662, -0.8086757660
            );

            let oklab1 = oklabMatrix * lms1_pow;
            let oklab2 = oklabMatrix * lms2_pow;

            // Oklab -> OKLCH
            let L1 = oklab1.x;
            let L2 = oklab2.x;
            let C1 = sqrt(oklab1.y * oklab1.y + oklab1.z * oklab1.z);
            let C2 = sqrt(oklab2.y * oklab2.y + oklab2.z * oklab2.z);
            let H1 = atan2(oklab1.z, oklab1.y);
            let H2 = atan2(oklab2.z, oklab2.y);

            // 色相の補間（最短経路）
            let hDiff = H2 - H1;
            let hDiffAdjusted = select(
              hDiff,
              hDiff - 2.0 * 3.14159265359,
              hDiff > 3.14159265359
            );
            let hDiffFinal = select(
              hDiffAdjusted,
              hDiffAdjusted + 2.0 * 3.14159265359,
              hDiffAdjusted < -3.14159265359
            );

            let L = mix(L1, L2, t);
            let C = mix(C1, C2, t);
            let H = H1 + t * hDiffFinal;

            // OKLCH -> Oklab
            let a = C * cos(H);
            let b = C * sin(H);

            // Oklab -> LMS
            let oklabInverseMatrix = mat3x3<f32>(
              1.0, 0.3963377774, 0.2158037573,
              1.0, -0.1055613458, -0.0638541728,
              1.0, -0.0894841775, -1.2914855480
            );

            let lms_pow = oklabInverseMatrix * vec3<f32>(L, a, b);
            let lms = vec3<f32>(
              pow(lms_pow.x, 3.0),
              pow(lms_pow.y, 3.0),
              pow(lms_pow.z, 3.0)
            );

            // LMS -> Linear RGB
            let lmsToRgbMatrix = mat3x3<f32>(
              4.0767416621, -3.3077115913, 0.2309699292,
              -1.2684380046, 2.6097574011, -0.3413193965,
              -0.0041960863, -0.7034186147, 1.7076147010
            );

            let linearRgb = lmsToRgbMatrix * lms;

            // Linear RGB -> RGB
            let rgbResult = vec3<f32>(
              select(12.92 * linearRgb.r, 1.055 * pow(linearRgb.r, 1.0/2.4) - 0.055, linearRgb.r <= 0.0031308),
              select(12.92 * linearRgb.g, 1.055 * pow(linearRgb.g, 1.0/2.4) - 0.055, linearRgb.g <= 0.0031308),
              select(12.92 * linearRgb.b, 1.055 * pow(linearRgb.b, 1.0/2.4) - 0.055, linearRgb.b <= 0.0031308),
            );

            return clamp(rgbResult, vec3<f32>(0.0), vec3<f32>(1.0));
          }

          fn mixOklchVec4(color1: vec4<f32>, color2: vec4<f32>, t: f32) -> vec4<f32> {
            return vec4<f32>(
              mixOklch(color1.rgb, color2.rgb, t),
              mix(color1.a, color2.a, t)
            );
          }
      `;

        const shader = device.createShaderModule({
          label: "Chromatic Aberration Shader",
          code,
        });

        const defs = makeShaderDataDefinitions(code);

        device.addEventListener("lost", (e) => {
          console.error(e);
        });

        device.addEventListener("uncapturederror", (e) => {
          console.error(e.error);
        });

        const pipeline = device.createComputePipeline({
          label: "Chromatic Aberration Pipeline",
          layout: "auto",
          compute: {
            module: shader,
            entryPoint: "computeMain",
          },
        });

        return { device, pipeline, defs };
      });
    },
    goLiveEffect: async ({ device, pipeline, defs }, params, imgData, env) => {
      console.log("Chromatic Aberration V1", params);
      // const size = Math.max(imgData.width, imgData.height);

      const dpiScale = env.dpi / env.baseDpi;

      imgData = await paddingImageData(
        imgData,
        Math.ceil(params.strength * dpiScale)
      );
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);
      const width = imgData.width;
      const height = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Input Texture",
        size: [width, height],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(defs.uniforms.params);

      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // カラーモードのマッピング: rgb=0, cmyk=1, pastel=2
      // prettier-ignore
      const colorModeValue = params.colorMode === "rgb" ? 0 :
        params.colorMode === "cmyk" ? 1 :
        params.colorMode === "pastel" ? 2 :
        params.colorMode === "rc" ? 3 :
        0;

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale,
        strength: params.strength,
        angle: params.angle,
        colorMode: colorModeValue,
        opacity: params.opacity,
        blendMode: params.blendMode === "over" ? 0 : 1,
        useFocusPoint: params.useFocusPoint ? 1 : 0,
        focusPointX: params.focusPointX,
        focusPointY: params.focusPointY,
        focusGradient: params.focusGradient,
        isInPreview: env.isInPreview ? 1 : 0,
        shiftType: params.shiftType === "move" ? 0 : 1,
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

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: width * height * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: width * 4, rowsPerImage: height },
        [width, height]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Chromatic Aberration Compute Pass",
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(width / 16),
        Math.ceil(height / 16)
      );
      computePass.end();

      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: width * 4 },
        [width, height]
      );

      device.queue.submit([commandEncoder.finish()]);

      // Read back and display the result
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = await removeWebGPUAlignmentPadding(
        new ImageData(new Uint8ClampedArray(resultData), width, height),
        outputWidth,
        outputHeight
      );

      return resultImageData;
    },
  },
});
