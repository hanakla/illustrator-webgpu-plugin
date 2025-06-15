import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
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
import { createGPUDevice } from "./_shared.ts";

const t = createTranslator({
  en: {
    title: "VHS & Interlace Effect",
    intensity: "Effect Intensity",
    noise: "Noise Amount",
    noiseDistortion: "Noise Distortion",
    colorShift: "Color Shift",
    scanlines: "Scanlines",
    interlaceGap: "Interlace Gap",
    brightnessJitter: "Brightness Jitter",
    trackingError: "Tracking Error",
    verticalJitter: "Vertical Distortion",
    tilt: "Line Tilt",
    vhsColor: "VHS Color Tone",
    enableVHSColor: "Enable VHS Color",
    randomSeed: "Random Seed",
    applyToTransparent: "Apply to Transparent Areas",
  },
  ja: {
    title: "VHS & インターレース効果",
    intensity: "効果の強度",
    noise: "ノイズ量",
    noiseDistortion: "ノイズ歪み",
    colorShift: "色ずれ",
    scanlines: "スキャンライン",
    interlaceGap: "インターレース間隔",
    brightnessJitter: "明るさのゆらぎ",
    trackingError: "トラッキングエラー",
    verticalJitter: "縦方向の歪み",
    tilt: "線の傾斜",
    vhsColor: "VHS色調",
    enableVHSColor: "VHS色調を有効化",
    randomSeed: "ランダムシード",
    applyToTransparent: "透明部分にも適用",
  },
});

const MAX_VERTICAL_JITTER_PIXELS = 100;

export const vhsInterlace = definePlugin({
  id: "vhs-interlace-effect-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Stylize",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 1.0,
      },
      noise: {
        type: "real",
        default: 0.2,
      },
      noiseDistortion: {
        type: "real",
        default: 0.0,
      },
      colorShift: {
        type: "real",
        default: 2.0,
      },
      scanlines: {
        type: "real",
        default: 0.5,
      },
      interlaceGap: {
        type: "int",
        default: 2,
      },
      brightnessJitter: {
        type: "real",
        default: 0.1,
      },
      trackingError: {
        type: "real",
        default: 0.5,
      },
      verticalJitter: {
        type: "real",
        default: 0.05,
      },
      tilt: {
        type: "real",
        default: 0.0,
      },
      randomSeed: {
        type: "real",
        default: 0.5,
      },
      enableVHSColor: {
        type: "bool",
        default: true,
      },
      vhsColor: {
        type: "color",
        default: {
          r: 0.9,
          g: 0.7,
          b: 0.8,
          a: 0.3,
        },
      },
      applyToTransparent: {
        type: "bool",
        default: true,
      },
    },
    onEditParameters: (params) => {
      // パラメータの正規化
      return {
        ...params,
        intensity: Math.max(0, Math.min(2, params.intensity)),
        noise: Math.max(0, Math.min(1, params.noise)),
        noiseDistortion: Math.max(0, Math.min(1, params.noiseDistortion)),
        colorShift: Math.max(0, Math.min(10, params.colorShift)),
        scanlines: Math.max(0, Math.min(1, params.scanlines)),
        interlaceGap: Math.max(1, Math.min(10, params.interlaceGap)),
        brightnessJitter: Math.max(0, Math.min(0.5, params.brightnessJitter)),
        trackingError: Math.max(0, Math.min(2, params.trackingError)),
        verticalJitter: Math.max(0, Math.min(1, params.verticalJitter)),
        tilt: Math.max(-0.5, Math.min(0.5, params.tilt)),
        randomSeed: Math.max(0, Math.min(1, params.randomSeed)),
        applyToTransparent: !!params.applyToTransparent,
      };
    },
    onAdjustColors: (params, adjustColor) => {
      // 色パラメータの調整
      return {
        ...params,
        vhsColor: adjustColor(params.vhsColor),
      };
    },
    onScaleParams(params, scaleFactor) {
      // パラメータのスケーリング
      return {
        ...params,
        intensity: params.intensity,
        noise: params.noise,
        noiseDistortion: params.noiseDistortion,
        colorShift: params.colorShift * scaleFactor,
        scanlines: params.scanlines,
        interlaceGap: Math.max(
          1,
          Math.round(params.interlaceGap * scaleFactor)
        ),
        brightnessJitter: params.brightnessJitter,
        trackingError: params.trackingError * scaleFactor,
        verticalJitter: params.verticalJitter,
        tilt: params.tilt,
        randomSeed: params.randomSeed,
        enableVHSColor: params.enableVHSColor,
        vhsColor: params.vhsColor,
        applyToTransparent: params.applyToTransparent,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // パラメータの補間
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t),
        noise: lerp(paramsA.noise, paramsB.noise, t),
        noiseDistortion: lerp(
          paramsA.noiseDistortion,
          paramsB.noiseDistortion,
          t
        ),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t),
        scanlines: lerp(paramsA.scanlines, paramsB.scanlines, t),
        interlaceGap: Math.round(
          lerp(paramsA.interlaceGap, paramsB.interlaceGap, t)
        ),
        brightnessJitter: lerp(
          paramsA.brightnessJitter,
          paramsB.brightnessJitter,
          t
        ),
        trackingError: lerp(paramsA.trackingError, paramsB.trackingError, t),
        verticalJitter: lerp(paramsA.verticalJitter, paramsB.verticalJitter, t),
        tilt: lerp(paramsA.tilt, paramsB.tilt, t),
        randomSeed: lerp(paramsA.randomSeed, paramsB.randomSeed, t),
        enableVHSColor:
          t < 0.5 ? paramsA.enableVHSColor : paramsB.enableVHSColor,
        vhsColor: {
          r: lerp(paramsA.vhsColor.r, paramsB.vhsColor.r, t),
          g: lerp(paramsA.vhsColor.g, paramsB.vhsColor.g, t),
          b: lerp(paramsA.vhsColor.b, paramsB.vhsColor.b, t),
          a: lerp(paramsA.vhsColor.a, paramsB.vhsColor.a, t),
        },
        applyToTransparent:
          t < 0.5 ? paramsA.applyToTransparent : paramsB.applyToTransparent,
      };
    },
    renderUI: (params, { setParam }) => {
      // UI レンダリング
      const vhsColorStr = toColorCode(params.vhsColor);

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
          ui.text({ text: t("noise") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "noise", dataType: 'float', min: 0, max: 1, value: params.noise }),
            ui.numberInput({ key: "noise", dataType: 'float', value: params.noise }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("noiseDistortion") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "noiseDistortion", dataType: 'float', min: 0, max: 1, value: params.noiseDistortion }),
            ui.numberInput({ key: "noiseDistortion", dataType: 'float', value: params.noiseDistortion }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: 'float', min: 0, max: 10, value: params.colorShift }),
            ui.numberInput({ key: "colorShift", dataType: 'float', value: params.colorShift }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("scanlines") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "scanlines", dataType: 'float', min: 0, max: 1, value: params.scanlines }),
            ui.numberInput({ key: "scanlines", dataType: 'float', value: params.scanlines }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("interlaceGap") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "interlaceGap", dataType: 'int', min: 1, max: 10, value: params.interlaceGap }),
            ui.numberInput({ key: "interlaceGap", dataType: 'int', value: params.interlaceGap }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("brightnessJitter") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "brightnessJitter", dataType: 'float', min: 0, max: 0.5, value: params.brightnessJitter }),
            ui.numberInput({ key: "brightnessJitter", dataType: 'float', value: params.brightnessJitter }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("trackingError") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "trackingError", dataType: 'float', min: 0, max: 2, value: params.trackingError }),
            ui.numberInput({ key: "trackingError", dataType: 'float', value: params.trackingError }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("verticalJitter") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "verticalJitter", dataType: 'float', min: 0, max: 1, value: params.verticalJitter }),
            ui.numberInput({ key: "verticalJitter", dataType: 'float', value: params.verticalJitter }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("tilt") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "tilt", dataType: 'float', min: -0.5, max: 0.5, value: params.tilt }),
            ui.numberInput({ key: "tilt", dataType: 'float', value: params.tilt }),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "enableVHSColor", value: params.enableVHSColor, label: t("enableVHSColor") }),
          ui.group({ direction: "row" }, [
            ui.text({ text: t("vhsColor") }),
            ui.colorInput({ key: "vhsColor", value: params.vhsColor }),
            ui.textInput({ key: "vhsColorText", value: vhsColorStr, onChange: (e) => {
              setParam({ vhsColor: parseColorCode(e.value) })
            }}),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("randomSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "randomSeed", dataType: 'float', min: 0, max: 1, value: params.randomSeed }),
            ui.numberInput({ key: "randomSeed", dataType: 'float', value: params.randomSeed }),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.checkbox({ key: "applyToTransparent", value: params.applyToTransparent, label: t("applyToTransparent") }),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(VHS & Interlace Effect)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiRatio: f32,
              intensity: f32,
              noise: f32,
              noiseDistortion: f32,
              colorShift: f32,
              scanlines: f32,
              interlaceGap: i32,
              brightnessJitter: f32,
              trackingError: f32,
              verticalJitter: f32,
              tilt: f32,
              enableVHSColor: i32,
              vhsColor: vec4f,
              seed: f32,
              applyToTransparent: i32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn rand(co: vec2f) -> f32 {
              return fract(sin(dot(co, vec2f(12.9898, 78.233))) * 43758.5453);
            }

            fn noise1D(x: f32) -> f32 {
              return fract(sin(x) * 10000.0);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let toInputTexCoord = dims / adjustedDims;
              let texCoord = vec2f(id.xy) / dims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) {
                return;
              }

              // オリジナルのカラーをサンプリング
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // 効果の強度に基づいて効果を適用
              let effectStrength = params.intensity;
              if (effectStrength <= 0.0) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // 透明部分をスキップするかどうかをチェック
              if (params.applyToTransparent == 0 && originalColor.a < 0.01) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              // 最終的な色を初期化
              var finalColor = originalColor;

              // 基本パラメータを設定
              let dpiRatio = params.dpiRatio;
              let tiltFactor = params.tilt;

              // 縦方向の歪みを計算
              var willSampleCoord = texCoord;
              let verticalDistortEffect = params.verticalJitter * effectStrength;

              if (verticalDistortEffect > 0.0) {
                // 非周期的な縦方向歪みを計算（水平位置とシードに依存）
                let xNoise = rand(vec2f(texCoord.x * 500.0, params.seed * 100.0)) * 2.0 - 1.0;
                let timeSeed = params.seed * 10.0;

                // 異なる周波数の歪みを組み合わせて自然な揺れを作成
                let verticalNoiseA = sin(texCoord.x * 150.0 + timeSeed) * 0.5;
                let verticalNoiseB = sin(texCoord.x * 370.0 + timeSeed * 1.5) * 0.3;
                let verticalNoiseC = noise1D(texCoord.x * 5.0 + timeSeed) * 0.2;

                // MAX_VERTICAL_JITTER_PIXELSからテクスチャ座標の重みを計算
                let MAX_VERTICAL_JITTER_WEIGHT = ${MAX_VERTICAL_JITTER_PIXELS} * dpiRatio / f32(dims.y);

                // 垂直ノイズ値を計算し、正規化空間の重みでスケーリング
                let verticalOffsetWeight = (verticalNoiseA + verticalNoiseB + verticalNoiseC + xNoise) * verticalDistortEffect * MAX_VERTICAL_JITTER_WEIGHT;

                // 中央を軸とした歪み効果（中央からの距離に応じて強度を調整）
                let distanceFromCenter = abs(texCoord.x - 0.5);
                let centeredEffectWeight = verticalOffsetWeight * (1.0 + distanceFromCenter);

                // テクスチャ座標にY方向のオフセットを適用（既に正規化空間の重み）
                willSampleCoord = vec2f(
                    texCoord.x,
                    texCoord.y + centeredEffectWeight
                );
              }

              finalColor = textureSampleLevel(inputTexture, textureSampler, willSampleCoord * toInputTexCoord, 0.0);

              // ノイズ効果を歪んだ画像に適用
              {
                let noiseIntensity = params.noise * effectStrength * 0.8;
                let noiseDistortionEffect = params.noiseDistortion * effectStrength;

                // Compute base coordinates for noise sampling
                // (Rounded to original pixel grid for dpi-aware noise pattern)
                let baseNoiseCoordX = floor(willSampleCoord.x * dims.x / dpiRatio);
                let baseNoiseCoordY = floor(willSampleCoord.y * dims.y / dpiRatio);

                // ノイズ歪み用の座標計算 - ノイズ自体を歪ませる
                let noiseSeedX = baseNoiseCoordX * 0.03 /*(ad-lib)*/ ;
                let noiseSeedY = baseNoiseCoordY * 0.03 /*(ad-lib)*/ ;

                // ノイズ座標自体の歪み（ノイズ自体を歪ませる - 画像ではなく）
                var distortedNoiseX = baseNoiseCoordX;
                var distortedNoiseY = baseNoiseCoordY;

                // Apply "noise distortion" to noise coordinates
                distortedNoiseX = baseNoiseCoordX + sin(noiseSeedX * 0.1 + params.seed * 50.0) * noiseDistortionEffect * 10.0;
                distortedNoiseY = baseNoiseCoordY + cos(noiseSeedY * 0.1 + params.seed * 60.0) * noiseDistortionEffect * 10.0;

                let noise1 = rand(vec2f(distortedNoiseX * 0.1, distortedNoiseY * 0.1 + params.seed * 10.0));
                let noise2 = rand(vec2f(distortedNoiseX * 0.05, distortedNoiseY * 0.05 - params.seed * 20.0));
                let noise3 = rand(vec2f(distortedNoiseX * 0.02, distortedNoiseY * 0.02 + params.seed * 30.0));
                let combinedNoise = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2) * noiseIntensity;

                // Add a random high-brightness noise spike (VHS "sparkle" effect)
                let sparkleThreshold = 0.97 - (noiseIntensity * 0.1); // ノイズ強度に応じて閾値を調整
                let sparkle = select(0.0, 1.0, noise1 > sparkleThreshold);

                let noiseColor = vec3f(combinedNoise);
                let adjustedNoise = (noiseColor - vec3f(0.5)) * noiseIntensity + vec3f(sparkle) * noiseIntensity;

                finalColor = vec4f(finalColor.rgb + adjustedNoise, finalColor.a);

                // 透明部分にも効果を与える場合のアルファ値調整
                if (params.applyToTransparent != 0 && finalColor.a < 0.01) {
                    let noiseAlpha = length(adjustedNoise) * 0.5;
                    finalColor.a = max(finalColor.a, noiseAlpha);
                }
              }

              // 色ズレエフェクトを適用
              if (params.colorShift > 0.0) {
                // 色ズレ効果を大幅に強化
                let colorShiftIntensity = params.colorShift * dpiRatio * effectStrength * 5.0;

                // ピクセル単位での横方向シフト量
                let redPixelShift = colorShiftIntensity;
                let bluePixelShift = -colorShiftIntensity * 0.7;

                // テクスチャ座標に変換
                let redShift = redPixelShift / dims.x;
                let blueShift = bluePixelShift / dims.x;

                // 各色チャンネルを異なる位置からサンプリング
                let redTexCoord = vec2f(willSampleCoord.x + redShift, willSampleCoord.y);
                let blueTexCoord = vec2f(willSampleCoord.x + blueShift, willSampleCoord.y);

                let redSample = textureSampleLevel(
                    inputTexture,
                    textureSampler,
                    redTexCoord * toInputTexCoord,
                    0.0
                );

                let blueSample = textureSampleLevel(
                    inputTexture,
                    textureSampler,
                    blueTexCoord * toInputTexCoord,
                    0.0
                );

                let greenChannel = finalColor.g;

                let redAlpha = redSample.a;
                let blueAlpha = blueSample.a;

                let finalAlpha = max(redAlpha, max(blueAlpha, finalColor.a));

                // 直接色チャンネルを置き換え
                finalColor = vec4f(redSample.r, greenChannel, blueSample.b, finalAlpha);
              }

              // dpiに依存しない物理Y座標を計算
              let centeredX = willSampleCoord.x - 0.5;
              let basePhysicalY = f32(id.y) / dpiRatio;
              let tiltedPhysicalY = basePhysicalY - centeredX * tiltFactor * f32(dims.y) / dpiRatio;
              let physicalY = tiltedPhysicalY;

              // 物理サイズベースでインターレースの間隔を計算
              let physicalGap = f32(params.interlaceGap);
              // インターレースラインかどうかを判定
              let isInterlaceLine = (floor(physicalY) % (physicalGap * 2.0)) < physicalGap;

              if (isInterlaceLine) {
                finalColor = vec4f(finalColor.rgb * vec3f(1.05), finalColor.a);

                if (params.trackingError > 0.0) {
                  // ピクセルグリッドに合わせたノイズ座標の計算（ノイズ効果と同様のアプローチ）
                  let baseNoiseCoordX = floor(willSampleCoord.x * dims.x / dpiRatio);
                  let baseNoiseCoordY = floor(physicalY);

                  // トラッキングエラーの強度
                  let trackOffset = noise1D(baseNoiseCoordY * 0.1 + params.seed) * params.trackingError * effectStrength * 10.0;

                  // 各色チャンネルを異なるオフセットでサンプリング
                  let redTexCoord = vec2f(willSampleCoord.x + trackOffset * 0.015, willSampleCoord.y);
                  let blueTexCoord = vec2f(willSampleCoord.x - trackOffset * 0.010, willSampleCoord.y);

                  let redSample = textureSampleLevel(inputTexture, textureSampler, redTexCoord * toInputTexCoord, 0.0);
                  let greenSample = finalColor;
                  let blueSample = textureSampleLevel(inputTexture, textureSampler, blueTexCoord * toInputTexCoord, 0.0);

                  // 色ずれしたイメージを合成
                  let chromaOffset = vec4f(
                      redSample.r,
                      greenSample.g,
                      blueSample.b,
                      max(redSample.a, max(blueSample.a, finalColor.a))
                  );

                  // 通常のオフセットカラー
                  let offsetTexCoord = vec2f(willSampleCoord.x + trackOffset * 0.005, willSampleCoord.y);
                  let offsetColor = textureSampleLevel(inputTexture, textureSampler, offsetTexCoord * toInputTexCoord, 0.0);

                  // 通常のオフセットと色ずれオフセットを組み合わせる
                  finalColor = mix(
                      finalColor,
                      mix(offsetColor, chromaOffset, 0.7),
                      min(1.0, params.trackingError * effectStrength)
                  );
                }
              } else {
                finalColor = vec4f(finalColor.rgb * vec3f(0.95), finalColor.a);
              }

              if (params.scanlines > 0.0) {
                let scanlineIntensity = params.scanlines * effectStrength;
                // 物理サイズベースでスキャンラインの周波数を計算
                let physicalScanY = willSampleCoord.y * dims.y / dpiRatio;

                // 中央を軸とした傾斜計算
                let centeredX = willSampleCoord.x - 0.5; // 横方向の中心からのオフセット
                // 傾斜を適用してスキャンライン
                let tiltedScanY = physicalScanY - centeredX * params.tilt * f32(dims.y) / dpiRatio;
                let scanlineFreq = tiltedScanY * physicalGap;

                // スキャンラインの位置
                let scanlinePhase = fract(scanlineFreq);

                // スキャンラインの端でディスプレースメントを強める
                let displaceIntensity = pow(abs(sin(scanlinePhase * 6.28318)), 8.0) * 0.5;

                // スキャンラインに沿った水平方向の微小なディスプレースメント
                let horizontalNoise = (rand(vec2f(tiltedScanY * 0.1, params.seed)) * 2.0 - 1.0);

                // 効果を強化
                let displacementAmount = horizontalNoise * displaceIntensity * 0.02 * scanlineIntensity;

                // ディスプレースメントを適用したテクスチャ座標でサンプリング
                let displacedCoord = vec2f(
                    willSampleCoord.x + displacementAmount,
                    willSampleCoord.y
                );
                let displacedColor = textureSampleLevel(inputTexture, textureSampler, displacedCoord * toInputTexCoord, 0.0);

                // 通常のスキャンライン効果
                let scanlineValue = sin(scanlineFreq) * 0.5 + 0.5;
                let scanlineEffect = pow(scanlineValue, 1.0) * scanlineIntensity;

                // ディスプレースメント効果と通常のスキャンライン効果を組み合わせる
                finalColor = mix(finalColor, displacedColor, min(1.0, displaceIntensity * scanlineIntensity * 0.3));
                finalColor = vec4f(finalColor.rgb * vec3f(1.0 - scanlineEffect * 0.2), finalColor.a);

                // 透明部分にもスキャンライン効果を与える場合
                if (params.applyToTransparent != 0 && finalColor.a < 0.01) {
                    let scanAlpha = scanlineEffect * 0.3;
                    finalColor.a = max(finalColor.a, scanAlpha);
                }
              }

              if (params.brightnessJitter > 0.0) {
                  let jitter = (rand(vec2f(params.seed, physicalY * 0.1)) * 2.0 - 1.0) * params.brightnessJitter * effectStrength;
                  finalColor = vec4f(finalColor.rgb * vec3f(1.0 + jitter), finalColor.a);
              }

              if (params.enableVHSColor != 0) {
                  let vhsColor = params.vhsColor;
                  finalColor = vec4f(mix(finalColor.rgb, vhsColor.rgb, vhsColor.a * effectStrength), finalColor.a);
              }

              finalColor = vec4f(clamp(finalColor.rgb, vec3f(0.0), vec3f(1.0)), finalColor.a);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "VHS & Interlace Effect Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          // 明示的なバインドグループレイアウトを作成
          const bindGroupLayout = device.createBindGroupLayout({
            label: "VHS Effect Bind Group Layout",
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                  sampleType: "float",
                  viewDimension: "2d",
                },
              },
              {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                  access: "write-only",
                  format: "rgba8unorm",
                  viewDimension: "2d",
                },
              },
              {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                sampler: {
                  type: "filtering",
                },
              },
              {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                  type: "uniform",
                },
              },
            ],
          });

          // 明示的なパイプラインレイアウトを作成
          const pipelineLayout = device.createPipelineLayout({
            label: "VHS Effect Pipeline Layout",
            bindGroupLayouts: [bindGroupLayout],
          });

          const pipeline = device.createComputePipeline({
            label: "VHS & Interlace Effect Pipeline",
            layout: pipelineLayout,
            compute: {
              module: shader,
              entryPoint: "computeMain",
            },
          });

          return { device, pipeline, pipelineDef, bindGroupLayout };
        }
      );
    },
    goLiveEffect: async (
      { device, pipeline, pipelineDef, bindGroupLayout },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("VHS & Interlace Effect V1", params);

      const dpiRatio = dpi / baseDpi;

      // 色ズレと縦方向の歪みに応じてパディングサイズを計算
      const colorShiftPadding = Math.ceil(params.colorShift * dpiRatio * 5); // colorShiftIntensityに相当
      const verticalJitterPadding = Math.ceil(
        MAX_VERTICAL_JITTER_PIXELS * dpiRatio * params.verticalJitter
      );
      const maxPadding = Math.max(colorShiftPadding, verticalJitterPadding, 1);

      // 効果に応じたパディングを追加
      imgData = await paddingImageData(imgData, maxPadding + 10);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // WebGPUアライメントのためのパディングも追加
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

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
        magFilter: "nearest",
        minFilter: "nearest",
      });

      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const seed = params.randomSeed * 10000;

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiRatio,
        intensity: params.intensity,
        noise: params.noise,
        noiseDistortion: params.noiseDistortion,
        colorShift: params.colorShift,
        scanlines: params.scanlines,
        interlaceGap: params.interlaceGap,
        brightnessJitter: params.brightnessJitter,
        trackingError: params.trackingError,
        verticalJitter: params.verticalJitter,
        tilt: params.tilt,
        enableVHSColor: params.enableVHSColor ? 1 : 0,
        vhsColor: [
          params.vhsColor.r,
          params.vhsColor.g,
          params.vhsColor.b,
          params.vhsColor.a,
        ],
        seed: seed,
        applyToTransparent: params.applyToTransparent ? 1 : 0,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Main Bind Group",
        layout: bindGroupLayout,
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

      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "VHS & Interlace Effect Compute Pass",
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
