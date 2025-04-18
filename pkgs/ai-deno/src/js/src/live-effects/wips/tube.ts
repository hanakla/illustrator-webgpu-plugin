import { definePlugin, StyleFilterFlag } from "../../plugin.ts";
import { ui } from "../../ui/nodes.ts";
import {
  imageToFFT,
  fftToImage,
  FFTResult,
  ComplexArray,
  filterFFT,
  getOptimalDimensions,
} from "../_fft.ts";
import { resizeImageData } from "../_utils.ts";

/**
 * 真空管エミュレーションの設定パラメータ
 */
interface TubeEmulationParams {
  /** 真空管のドライブ量 (0.0〜10.0, デフォルト: 2.0) */
  drive: number;
  /** 真空管の温かさ (0.0〜1.0, デフォルト: 0.3) */
  warmth: number;
  /** 偶数次高調波の量 (0.0〜1.0, デフォルト: 0.5) */
  evenHarmonics: number;
  /** 奇数次高調波の量 (0.0〜1.0, デフォルト: 0.3) */
  oddHarmonics: number;
  /** トーンバランス (高域と低域のバランス) (-1.0〜1.0, デフォルト: 0.0) */
  toneBalance: number;
}

export const exprTube = definePlugin({
  id: "hanakla.tube",
  title: "Tube",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      drive: {
        type: "real",
        default: 2.0,
      },
      warmth: {
        type: "real",
        default: 0.3,
      },
      evenHarmonics: {
        type: "real",
        default: 0.5,
      },
      oddHarmonics: {
        type: "real",
        default: 0.3,
      },
      toneBalance: {
        type: "real",
        default: 0.0,
      },
    },
    onAdjustColors: (params, adjustColor) => params,
    onEditParameters: (params) => params,
    onScaleParams: (params, scaleFactor) => params,
    onInterpolate: (params1, params2, t) => {
      return {
        drive: params1.drive * (1 - t) + params2.drive * t,
        warmth: params1.warmth * (1 - t) + params2.warmth * t,
        evenHarmonics:
          params1.evenHarmonics * (1 - t) + params2.evenHarmonics * t,
        oddHarmonics: params1.oddHarmonics * (1 - t) + params2.oddHarmonics * t,
        toneBalance: params1.toneBalance * (1 - t) + params2.toneBalance * t,
      };
    },
    renderUI: (params, updateParams) => {
      console.log(params);
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: "Drive" }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "drive",
              dataType: "float",
              value: params.drive,
              min: 0,
              max: 10,
            }),
            ui.numberInput({
              key: "drive",
              value: params.drive,
              dataType: "float",
              min: 0,
              max: 10,
              step: 0.1,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: "Warmth" }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "warmth",
              dataType: "float",
              value: params.warmth,
              min: 0,
              max: 1,
            }),
            ui.numberInput({
              key: "warmth",
              value: params.warmth,
              dataType: "float",
              min: 0,
              max: 1,
              step: 0.01,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: "Even Harmonics" }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "evenHarmonics",
              value: params.evenHarmonics,
              dataType: "float",
              min: 0,
              max: 1,
            }),
            ui.numberInput({
              key: "evenHarmonics",
              dataType: "float",
              value: params.evenHarmonics,
              min: 0,
              max: 1,
              step: 0.01,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: "Odd Harmonics" }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "oddHarmonics",
              dataType: "float",
              value: params.oddHarmonics,
              min: 0,
              max: 1,
            }),
            ui.numberInput({
              key: "oddHarmonics",
              dataType: "float",
              value: params.oddHarmonics,
              min: 0,
              max: 1,
              step: 0.01,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: "Tone Balance" }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "toneBalance",
              dataType: "float",
              value: params.toneBalance,
              min: -1,
              max: 1,
            }),
            ui.numberInput({
              key: "toneBalance",
              dataType: "float",
              value: params.toneBalance,
              min: -1,
              max: 1,
              step: 0.01,
            }),
          ]),
        ]),
      ]);
    },
    goLiveEffect: async (init, params, input, env) => {
      const outputWidth = input.width,
        outputHeight = input.height;

      const fftSize = getOptimalDimensions(outputWidth, outputHeight);

      input = await resizeImageData(input, fftSize[0], fftSize[1]);

      return applyTubeEmulation(input, params);
    },
  },
});

/**
 * デフォルトのチューブエミュレーションパラメータ
 */
const DEFAULT_TUBE_PARAMS: TubeEmulationParams = {
  drive: 2.0,
  warmth: 0.3,
  evenHarmonics: 0.5,
  oddHarmonics: 0.3,
  toneBalance: 0.0,
};

/**
 * 真空管エミュレーションを適用した画像を生成する
 *
 * @param imageData 入力画像データ
 * @param params 真空管エミュレーションのパラメータ
 * @returns 真空管エミュレーションが適用された画像データ
 *
 * この関数は画像に対して真空管アンプの特性を模倣した効果を適用します。
 * 以下の効果が含まれます：
 *
 * 1. 非線形特性によるソフトクリッピング（暗部・明部の圧縮）
 * 2. 偶数次/奇数次高調波の付加（周波数領域での変化）
 * 3. 周波数特性の変化（トーンバランス）
 * 4. 色温度の変化（真空管の「温かさ」）
 */
function applyTubeEmulation(
  imageData: ImageData,
  params: Partial<TubeEmulationParams> = {}
): ImageData {
  // デフォルトパラメータとマージ
  const tubeParams: TubeEmulationParams = {
    ...DEFAULT_TUBE_PARAMS,
    ...params,
  };

  // FFT処理
  const fftResult = imageToFFT(imageData);

  // 真空管効果を周波数領域で適用
  const processedFFT = applyTubeEffectInFrequencyDomain(fftResult, tubeParams);

  // 周波数領域から空間領域に戻す
  let resultImageData = fftToImage(processedFFT);

  // 空間領域でも真空管効果を適用（非線形転送特性）
  resultImageData = applyTubeEffectInSpatialDomain(resultImageData, tubeParams);

  return resultImageData;
}

/**
 * 周波数領域で真空管効果を適用
 * @param fftResult FFT処理結果
 * @param params 真空管パラメータ
 * @returns 処理後のFFT結果
 */
function applyTubeEffectInFrequencyDomain(
  fftResult: FFTResult,
  params: TubeEmulationParams
): FFTResult {
  const { width, height, channels } = fftResult;
  const result: FFTResult = {
    width,
    height,
    channels: {
      r: { real: [...channels.r.real], imag: [...channels.r.imag] },
      g: { real: [...channels.g.real], imag: [...channels.g.imag] },
      b: { real: [...channels.b.real], imag: [...channels.b.imag] },
      a: { real: [...channels.a.real], imag: [...channels.a.imag] },
    },
  };

  // ハーモニクス処理用の周波数フィルタリング関数
  // const harmonicsFilter = (
  //   x: number,
  //   y: number,
  //   w: number,
  //   h: number,
  //   harmonic: number
  // ): boolean => {
  //   const centerX = 0;
  //   const centerY = 0;
  //   const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

  //   // 基本周波数の半径を計算
  //   const baseRadius = Math.min(w, h) / 4;

  //   // 倍音の半径（基本周波数の倍数）
  //   const harmonicRadius = baseRadius * harmonic;

  //   // 倍音の帯域を通過させる
  //   return distance > harmonicRadius * 0.8 && distance < harmonicRadius * 1.2;
  // };

  // 各チャンネルに対して処理
  ["r", "g", "b", "a"].forEach((channel) => {
    const complexArray =
      result.channels[channel as keyof typeof result.channels];

    // 偶数次高調波を強調
    if (params.evenHarmonics > 0) {
      applyHarmonics(complexArray, width, height, 2, params.evenHarmonics);
      applyHarmonics(
        complexArray,
        width,
        height,
        4,
        params.evenHarmonics * 0.5
      );
    }

    // 奇数次高調波を強調
    if (params.oddHarmonics > 0) {
      applyHarmonics(complexArray, width, height, 3, params.oddHarmonics);
      applyHarmonics(complexArray, width, height, 5, params.oddHarmonics * 0.3);
    }

    // トーンバランス（周波数特性）の調整
    applyToneBalance(complexArray, width, height, params.toneBalance);
  });

  return result;
}

/**
 * 高調波を強調する処理
 */
function applyHarmonics(
  complexArray: ComplexArray,
  width: number,
  height: number,
  harmonic: number,
  intensity: number
): void {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  // 高調波の半径
  const baseRadius = Math.min(width, height) / 4;
  const harmonicRadius = baseRadius * harmonic;
  const bandWidth = harmonicRadius * 0.2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 中心を原点とした座標
      const xCentered = x - halfWidth;
      const yCentered = y - halfHeight;

      // 中心からの距離
      const distance = Math.sqrt(xCentered ** 2 + yCentered ** 2);

      // 指定した高調波の帯域内にあるか
      if (Math.abs(distance - harmonicRadius) < bandWidth) {
        const i = y * width + x;

        // 高調波を増幅
        complexArray.real[i] *= 1 + intensity;
        complexArray.imag[i] *= 1 + intensity;
      }
    }
  }
}

/**
 * トーンバランス（周波数特性）を調整
 */
function applyToneBalance(
  complexArray: ComplexArray,
  width: number,
  height: number,
  balance: number
): void {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  const maxDistance = Math.sqrt(halfWidth ** 2 + halfHeight ** 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 中心を原点とした座標
      const xCentered = x - halfWidth;
      const yCentered = y - halfHeight;

      // 中心からの距離（正規化）
      const distance = Math.sqrt(xCentered ** 2 + yCentered ** 2) / maxDistance;

      // バランスに応じたフィルタ係数
      // balance > 0: 高域強調 (高周波を増幅)
      // balance < 0: 低域強調 (低周波を増幅)
      let factor = 1.0;
      if (balance > 0) {
        // 高域強調
        factor = 1.0 + balance * distance;
      } else if (balance < 0) {
        // 低域強調
        factor = 1.0 - Math.abs(balance) * (1.0 - distance);
      }

      const i = y * width + x;
      complexArray.real[i] *= factor;
      complexArray.imag[i] *= factor;
    }
  }
}

/**
 * 空間領域で真空管効果を適用（非線形転送特性）
 * @param imageData 入力画像データ
 * @param params 真空管パラメータ
 * @returns 処理後の画像データ
 */
function applyTubeEffectInSpatialDomain(
  imageData: ImageData,
  params: TubeEmulationParams
): ImageData {
  const { width, height, data } = imageData;
  const result = new ImageData(width, height);

  // 非線形転送関数を適用
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    // 真空管特有の非線形転送関数
    const rOut = tubeShaperFunction(r, params.drive);
    const gOut = tubeShaperFunction(g, params.drive);
    const bOut = tubeShaperFunction(b, params.drive);

    // 温かさを適用（赤みを増強、青みを減少）
    const rWarm = rOut + params.warmth * 0.2;
    const gWarm = gOut;
    const bWarm = bOut - params.warmth * 0.1;

    // 0〜255の範囲に戻す
    result.data[i] = Math.min(255, Math.max(0, Math.round(rWarm * 255)));
    result.data[i + 1] = Math.min(255, Math.max(0, Math.round(gWarm * 255)));
    result.data[i + 2] = Math.min(255, Math.max(0, Math.round(bWarm * 255)));
    result.data[i + 3] = data[i + 3]; // アルファチャンネルはそのまま
  }

  return result;
}

/**
 * 真空管の非線形転送関数
 * @param x 入力値 (0.0〜1.0)
 * @param drive ドライブ量 (歪みの量)
 * @returns 出力値 (0.0〜1.0)
 */
function tubeShaperFunction(x: number, drive: number): number {
  // 入力をドライブ量に応じて増幅
  const xDriven = x * drive;

  // 真空管型の非線形関数（ソフトクリッピング）
  // 特に偶数次高調波を生成する特性を持つ
  return (
    Math.tanh(xDriven) * (1 - Math.exp(-xDriven * 3)) * (1 / Math.tanh(drive))
  );
}

/**
 * ビンテージ真空管プリセット
 */
const TUBE_PRESETS = {
  // クラシックなチューブプリアンプ
  VINTAGE_WARM: {
    drive: 3.0,
    warmth: 0.6,
    evenHarmonics: 0.7,
    oddHarmonics: 0.2,
    toneBalance: -0.3,
  },

  // モダンなハイゲインチューブ
  MODERN_BRIGHT: {
    drive: 4.0,
    warmth: 0.2,
    evenHarmonics: 0.4,
    oddHarmonics: 0.6,
    toneBalance: 0.4,
  },

  // クリーンなチューブバッファ
  CLEAN_TUBE: {
    drive: 1.2,
    warmth: 0.2,
    evenHarmonics: 0.3,
    oddHarmonics: 0.1,
    toneBalance: 0.0,
  },

  // ロータリースピーカーのような効果
  ROTARY_CABINET: {
    drive: 1.8,
    warmth: 0.5,
    evenHarmonics: 0.6,
    oddHarmonics: 0.4,
    toneBalance: -0.2,
  },
};

/**
 * 使用例
 *
 * // 基本的な使い方
 * const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
 * const ctx = canvas.getContext('2d');
 * const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
 *
 * // デフォルトのチューブエミュレーション
 * const tubeImageData = applyTubeEmulation(imageData);
 *
 * // カスタムパラメータを使う
 * const customTubeImageData = applyTubeEmulation(imageData, {
 *   drive: 3.5,
 *   warmth: 0.5
 * });
 *
 * // プリセットを使う
 * const vintageImageData = applyTubeEmulation(imageData, TUBE_PRESETS.VINTAGE_WARM);
 *
 * // 結果を描画
 * ctx.putImageData(tubeImageData, 0, 0);
 */
