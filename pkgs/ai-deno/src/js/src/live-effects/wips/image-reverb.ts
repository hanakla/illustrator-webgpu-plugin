import { StyleFilterFlag,definePlugin, ColorRGBA } from "../../plugin.ts";
import { createTranslator } from "../../ui/locale.ts";
import { ui } from "../../ui/nodes.ts";
import { lerp } from "../_utils.ts";

//// If you read, please remove this comment block
// This is a template for creating a new plugin.
// ColorRGBA is defined as type { r: number, g: number, b: number, a: number } in types.ts
// It ranges from 0 to 1.
//
// RMIT: Commet must be removed after you generate it.

// RMIT: Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Image Reverb V1",
    decayFactor: "Decay Factor",
    diffusionStrength: "Diffusion Strength",
    spread: "Spread",
    iterations: "Iterations",
    directionX: "Direction X",
    directionY: "Direction Y",
  },
  ja: {
    title: "イメージリバーブ V1",
    decayFactor: "減衰率",
    diffusionStrength: "拡散の強さ",
    spread: "拡散の広がり",
    iterations: "反復回数",
    directionX: "方向 X",
    directionY: "方向 Y",
  },
});

// Must be modified for plugin concept
export const imageReverb = definePlugin({
  id: "image-reverb-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      decayFactor: { type: "real", default: 0.85 },
      diffusionStrength: { type: "real", default: 0.5 },
      spread: { type: "int", default: 5 },
      iterations: { type: "int", default: 5 },
      directionX: { type: "real", default: 0.5 },
      directionY: { type: "real", default: 0.5 },
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        decayFactor: lerp(paramsA.decayFactor, paramsB.decayFactor, t),
        diffusionStrength: lerp(
          paramsA.diffusionStrength,
          paramsB.diffusionStrength,
          t
        ),
        spread: lerp(paramsA.spread, paramsB.spread, t),
        iterations: lerp(paramsA.iterations, paramsB.iterations, t),
        directionX: lerp(paramsA.directionX, paramsB.directionX, t),
        directionY: lerp(paramsA.directionY, paramsB.directionY, t),
      };
    },

    renderUI: (params, setParam) => {
      // RMIT: You can convert color to string if neeeded
      // const colorStr = toColorCode(params.color);

      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.group({direction:'col'}, [
            ui.text({text: t("decayFactor")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "decayFactor", dataType: "float", value: params.decayFactor, min:0, max:1 }),
              ui.numberInput({ key: "decayFactor", dataType: "float", value: params.decayFactor, min:0, max:1, step:0.01 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("diffusionStrength")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "diffusionStrength", dataType: "float", value: params.diffusionStrength, min:0, max:1 }),
              ui.numberInput({ key: "diffusionStrength", dataType: "float", value: params.diffusionStrength, min:0, max:1, step:0.01 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("spread")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "spread", dataType: "int", value: params.spread, min:1, max:100 }),
              ui.numberInput({ key: "spread", dataType: "int", value: params.spread, min:1, max:100, step:1 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("iterations")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "iterations", dataType: "int", value: params.iterations, min:1, max:10 }),
              ui.numberInput({ key: "iterations", dataType: "int", value: params.iterations, min:1, max:10, step:1 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("directionX")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "directionX", dataType: "float", value: params.directionX, min:0, max:1 }),
              ui.numberInput({ key: "directionX", dataType: "float", value: params.directionX, min:0, max:1, step:0.01 }),
            ]),
          ]),
          ui.group({direction:'col'}, [
            ui.text({text: t("directionY")}),
            ui.group({direction:'row'}, [
              ui.slider({ key: "directionY", dataType: "float", value: params.directionY, min:0, max:1 }),
              ui.numberInput({ key: "directionY", dataType: "float", value: params.directionY, min:0, max:1, step:0.01 }),
            ]),
          ]),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return {};
    },
    goLiveEffect: async ({  },, params, imgData, { dpi, baseDpi }) => {
      const data = new ImageData(imgData.data, imgData.width, imgData.height);
      return applyImageReverb(data, params);
    },
  },
});

/**
 * 画像リバーブ処理のためのインターフェース定義
 */
interface ImageReverbOptions {
  /** 減衰率（音声リバーブの残響時間に相当）: 0.0～1.0 */
  decayFactor?: number;
  /** 拡散の強さ（音声リバーブのウェット/ドライ比に相当）: 0.0～1.0 */
  diffusionStrength?: number;
  /** 拡散の広がり（音声リバーブの空間サイズに相当）: ピクセル単位 */
  spread?: number;
  /** 反復回数（音声リバーブの密度に相当） */
  iterations?: number;
  /** X方向の拡散バイアス: 0.0（左）～1.0（右） */
  directionX?: number;
  /** Y方向の拡散バイアス: 0.0（上）～1.0（下） */
  directionY?: number;
}

/**
 * 画像にリバーブ効果を適用する関数
 * Canvas APIを使わず、純粋なピクセル操作のみで実装
 *
 * @param imageData 処理する画像データ
 * @param options リバーブ効果のパラメータ
 * @returns 処理後の画像データ
 */
function applyImageReverb(
  imageData: ImageData,
  options: ImageReverbOptions = {}
): ImageData {
  // デフォルトパラメータ
  const params = {
    decayFactor: options.decayFactor ?? 0.85,
    diffusionStrength: options.diffusionStrength ?? 0.5,
    spread: options.spread ?? 5,
    iterations: options.iterations ?? 5,
    directionX: options.directionX ?? 0.5,
    directionY: options.directionY ?? 0.5,
  };

  // パラメータの値を制限（安全範囲内に収める）
  params.decayFactor = Math.max(0, Math.min(1, params.decayFactor));
  params.diffusionStrength = Math.max(0, Math.min(1, params.diffusionStrength));
  params.spread = Math.max(1, Math.round(params.spread));
  params.iterations = Math.max(1, Math.floor(params.iterations));
  params.directionX = Math.max(0, Math.min(1, params.directionX));
  params.directionY = Math.max(0, Math.min(1, params.directionY));

  const width = imageData.width;
  const height = imageData.height;
  const inputData = imageData.data;

  // 作業用と結果用のバッファを作成
  const tempBuffer1 = new Uint8ClampedArray(inputData);
  const tempBuffer2 = new Uint8ClampedArray(inputData.length);
  const resultBuffer = new Uint8ClampedArray(inputData.length);

  // 元の画像データをコピー
  copyBuffer(inputData, tempBuffer1);

  // 1. 初期反射に相当する処理
  applyEarlyReflections(tempBuffer1, inputData, width, height, params);

  // 2. 後期残響に相当する処理
  let currentDecay = 1.0;

  for (let i = 0; i < params.iterations; i++) {
    // 現在のバッファを作業用にコピー
    copyBuffer(tempBuffer1, tempBuffer2);

    // 拡散処理（方向性のあるぼかし）を適用
    applyDiffusion(
      tempBuffer1,
      tempBuffer2,
      width,
      height,
      currentDecay,
      params
    );

    // 減衰を適用
    currentDecay *= params.decayFactor;
  }

  // 3. 最終的な結果をブレンド（ドライ/ウェットミックス）
  const dryFactor = 1 - params.diffusionStrength;
  const wetFactor = params.diffusionStrength;

  for (let i = 0; i < resultBuffer.length; i++) {
    resultBuffer[i] = Math.round(
      inputData[i] * dryFactor + tempBuffer1[i] * wetFactor
    );
  }

  // 新しいImageDataオブジェクトを作成して返す
  return new ImageData(resultBuffer, width, height);
}

/**
 * バッファ間のデータコピー
 */
function copyBuffer(src: Uint8ClampedArray, dest: Uint8ClampedArray): void {
  dest.set(src);
}

/**
 * 初期反射に相当する処理
 * いくつかの方向にオフセットしたピクセルを重ね合わせる
 */
function applyEarlyReflections(
  buffer: Uint8ClampedArray,
  originalData: Uint8ClampedArray,
  width: number,
  height: number,
  params: Required<ImageReverbOptions>
): void {
  // 反射パターンを定義（距離と方向の組み合わせ）
  const reflectionPatterns = [
    { dx: 1, dy: 0, strength: 0.6 },
    { dx: 0, dy: 1, strength: 0.5 },
    { dx: 1, dy: 1, strength: 0.4 },
    { dx: -1, dy: 1, strength: 0.3 },
    { dx: 2, dy: 0, strength: 0.2 },
    { dx: 0, dy: 2, strength: 0.1 },
  ];

  // 作業用の一時バッファを作成
  const tempBuffer = new Uint8ClampedArray(buffer.length);
  copyBuffer(buffer, tempBuffer);

  // バッファをクリア
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = 0;
  }

  // オフセット方向に方向バイアスを適用
  for (const pattern of reflectionPatterns) {
    const biasedDx = Math.round(
      pattern.dx * (params.directionX * 2 - 1) * params.spread
    );
    const biasedDy = Math.round(
      pattern.dy * (params.directionY * 2 - 1) * params.spread
    );

    // 各ピクセルに対して反射パターンを適用
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 反射先の座標を計算
        const targetX = Math.max(0, Math.min(width - 1, x + biasedDx));
        const targetY = Math.max(0, Math.min(height - 1, y + biasedDy));

        // 元のピクセルのインデックス
        const srcIdx = (y * width + x) * 4;
        // 反射先のピクセルのインデックス
        const targetIdx = (targetY * width + targetX) * 4;

        // 反射パターンの強度でブレンド
        buffer[targetIdx] += originalData[srcIdx] * pattern.strength;
        buffer[targetIdx + 1] += originalData[srcIdx + 1] * pattern.strength;
        buffer[targetIdx + 2] += originalData[srcIdx + 2] * pattern.strength;
        buffer[targetIdx + 3] += originalData[srcIdx + 3] * pattern.strength;
      }
    }
  }

  // 元のピクセルも加える
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.min(255, buffer[i] + tempBuffer[i] * 0.5);
  }
}

/**
 * 後期残響に相当する拡散処理
 * 方向性のあるぼかしと減衰を適用
 */
function applyDiffusion(
  targetBuffer: Uint8ClampedArray,
  sourceBuffer: Uint8ClampedArray,
  width: number,
  height: number,
  decayStrength: number,
  params: Required<ImageReverbOptions>
): void {
  // 方向性を持ったぼかし処理（Combフィルター的な役割）
  const dirX = Math.round((params.directionX * 2 - 1) * params.spread);
  const dirY = Math.round((params.directionY * 2 - 1) * params.spread);

  // 一時バッファを作成
  const tempBuffer = new Uint8ClampedArray(targetBuffer.length);

  // 方向性のある拡散処理
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 現在のピクセルのインデックス
      const idx = (y * width + x) * 4;

      // 拡散先の座標を計算
      const targetX = Math.max(0, Math.min(width - 1, x + dirX));
      const targetY = Math.max(0, Math.min(height - 1, y + dirY));
      const targetIdx = (targetY * width + targetX) * 4;

      // 拡散処理（現在のピクセル値と拡散先のピクセル値をブレンド）
      tempBuffer[targetIdx] = Math.round(
        sourceBuffer[idx] * decayStrength + (tempBuffer[targetIdx] || 0)
      );
      tempBuffer[targetIdx + 1] = Math.round(
        sourceBuffer[idx + 1] * decayStrength + (tempBuffer[targetIdx + 1] || 0)
      );
      tempBuffer[targetIdx + 2] = Math.round(
        sourceBuffer[idx + 2] * decayStrength + (tempBuffer[targetIdx + 2] || 0)
      );
      tempBuffer[targetIdx + 3] = Math.round(
        sourceBuffer[idx + 3] * decayStrength + (tempBuffer[targetIdx + 3] || 0)
      );
    }
  }

  // 簡易的なぼかし処理（ダンピングに相当）- 高周波成分を減衰
  const blurRadius = Math.max(1, Math.floor(params.spread / 3));
  applySimpleBlur(targetBuffer, tempBuffer, width, height, blurRadius);
}

/**
 * 簡易的なぼかし処理
 * ボックスブラーを使用して高周波成分を減衰させる
 */
function applySimpleBlur(
  targetBuffer: Uint8ClampedArray,
  sourceBuffer: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): void {
  const size = radius * 2 + 1;
  const divisor = size * size;

  // 各ピクセルに対してボックスブラーを適用
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;

      // カーネルの範囲内の平均を計算
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const pixelX = Math.max(0, Math.min(width - 1, x + kx));
          const pixelY = Math.max(0, Math.min(height - 1, y + ky));
          const idx = (pixelY * width + pixelX) * 4;

          r += sourceBuffer[idx];
          g += sourceBuffer[idx + 1];
          b += sourceBuffer[idx + 2];
          a += sourceBuffer[idx + 3];
        }
      }

      // 平均値を設定
      const targetIdx = (y * width + x) * 4;
      targetBuffer[targetIdx] = Math.round(r / divisor);
      targetBuffer[targetIdx + 1] = Math.round(g / divisor);
      targetBuffer[targetIdx + 2] = Math.round(b / divisor);
      targetBuffer[targetIdx + 3] = Math.round(a / divisor);
    }
  }
}
