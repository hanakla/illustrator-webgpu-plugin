/**
 * 画像のFFT処理のためのユーティリティ関数群
 */

/**
 * 複素数の配列を表す型
 */
export interface ComplexArray {
  /** 実部の配列 */
  real: number[];
  /** 虚部の配列 */
  imag: number[];
}

/**
 * FFT処理結果を表す型
 */
export interface FFTResult {
  /** 画像の幅 */
  width: number;
  /** 画像の高さ */
  height: number;
  /** 各色チャンネルのFFT結果 */
  channels: {
    /** 赤チャンネルのFFT結果 */
    r: ComplexArray;
    /** 緑チャンネルのFFT結果 */
    g: ComplexArray;
    /** 青チャンネルのFFT結果 */
    b: ComplexArray;
    /** a */
    a: ComplexArray;
  };
}

/**
 * ImageDataからFFT結果に変換する
 * @param imageData 画像データ
 * @returns FFT処理結果のオブジェクト
 *
 * 返り値の構造:
 * - width: 元画像の幅
 * - height: 元画像の高さ
 * - channels: 各色チャンネルのFFT結果
 *   - r: 赤チャンネルの複素数配列 (real, imag)
 *   - g: 緑チャンネルの複素数配列 (real, imag)
 *   - b: 青チャンネルの複素数配列 (real, imag)
 *
 * 各チャンネルの複素数配列は、画像のピクセル数 (width * height) と同じ長さの
 * 1次元配列として格納されます。画像座標 (x, y) のピクセルに対応するインデックスは
 * y * width + x となります。
 *
 * FFT結果の中心は画像の中心に対応します（シフト済み）。
 */
export function imageToFFT(imageData: ImageData): FFTResult {
  const { width, height, data } = imageData;

  // 各チャンネルの配列を準備
  const redChannel = new Array<number>(width * height);
  const greenChannel = new Array<number>(width * height);
  const blueChannel = new Array<number>(width * height);
  const alphaChannel = new Array<number>(width * height);

  // 画像データを各チャンネルに分離
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      redChannel[y * width + x] = data[i];
      greenChannel[y * width + x] = data[i + 1];
      blueChannel[y * width + x] = data[i + 2];
      alphaChannel[y * width + x] = data[i + 3];
    }
  }

  // 各チャンネルにFFT処理を適用
  const redFFT = perform2DFFT(redChannel, width, height);
  const greenFFT = perform2DFFT(greenChannel, width, height);
  const blueFFT = perform2DFFT(blueChannel, width, height);
  const alphaFFT = perform2DFFT(alphaChannel, width, height);

  return {
    width,
    height,
    channels: {
      r: redFFT,
      g: greenFFT,
      b: blueFFT,
      a: alphaFFT,
    },
  };
}

/**
 * FFT結果からImageDataに復元する
 * @param fftResult FFT処理結果のオブジェクト
 * @returns 復元されたImageData
 *
 * 入力パラメータの構造:
 * - width: 元画像の幅
 * - height: 元画像の高さ
 * - channels: 各色チャンネルのFFT結果
 *   - r: 赤チャンネルの複素数配列 (real, imag)
 *   - g: 緑チャンネルの複素数配列 (real, imag)
 *   - b: 青チャンネルの複素数配列 (real, imag)
 *   - a: aチャンネルの複素数配列 (real, imag)
 *
 * 返り値:
 * 復元された画像のImageDataオブジェクト（RGBA形式）
 */
export function fftToImage(fftResult: FFTResult): ImageData {
  const { width, height, channels } = fftResult;

  // 逆FFT処理を各チャンネルに適用
  const redChannel = performInverse2DFFT(channels.r, width, height);
  const greenChannel = performInverse2DFFT(channels.g, width, height);
  const blueChannel = performInverse2DFFT(channels.b, width, height);
  const alphaChannel = performInverse2DFFT(channels.a, width, height);

  // ImageDataを作成
  const imageData = new ImageData(width, height);

  // 各チャンネルからImageDataを構築
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const pixelIndex = i * 4;

      // 0-255の範囲に制限
      imageData.data[pixelIndex] = Math.min(255, Math.max(0, redChannel[i]));
      imageData.data[pixelIndex + 1] = Math.min(
        255,
        Math.max(0, greenChannel[i])
      );
      imageData.data[pixelIndex + 2] = Math.min(
        255,
        Math.max(0, blueChannel[i])
      );
      imageData.data[pixelIndex + 3] = Math.min(
        255,
        Math.max(0, alphaChannel[i])
      );
    }
  }

  return imageData;
}

/**
 * 画像の一部を周波数ドメインでフィルタリングする
 * @param fftResult FFT処理結果のオブジェクト
 * @param filterFunc フィルタリング関数 (x, y, width, height) => boolean
 * @returns フィルタリングされたFFT結果
 *
 * filterFuncは各ピクセル座標 (x, y) に対して呼び出され、
 * trueを返した場合はその周波数成分を保持し、falseの場合は除去します。
 * (x, y) の座標系は画像中心が原点 (0, 0) となるようにシフトされています。
 */
export function filterFFT(
  fftResult: FFTResult,
  filterFunc: (x: number, y: number, width: number, height: number) => boolean
): FFTResult {
  const { width, height, channels } = fftResult;
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  // 各チャンネルに対してフィルタリングを適用
  const filteredResult: FFTResult = {
    width,
    height,
    channels: {
      r: { real: [...channels.r.real], imag: [...channels.r.imag] },
      g: { real: [...channels.g.real], imag: [...channels.g.imag] },
      b: { real: [...channels.b.real], imag: [...channels.b.imag] },
    },
  };

  // 各ピクセルに対してフィルタリング関数を適用
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 中心を原点とした座標に変換
      const xCentered = x - halfWidth;
      const yCentered = y - halfHeight;

      // フィルタリング関数を適用
      if (!filterFunc(xCentered, yCentered, width, height)) {
        const i = y * width + x;

        // 周波数成分を0にする（除去）
        filteredResult.channels.r.real[i] = 0;
        filteredResult.channels.r.imag[i] = 0;
        filteredResult.channels.g.real[i] = 0;
        filteredResult.channels.g.imag[i] = 0;
        filteredResult.channels.b.real[i] = 0;
        filteredResult.channels.b.imag[i] = 0;
      }
    }
  }

  return filteredResult;
}

export function getOptimalDimensions(width, height) {
  // 画像が大きすぎる場合は縮小
  const maxDimension = 512; // 処理速度のため最大サイズを制限
  let scale = 1;

  if (width > maxDimension || height > maxDimension) {
    scale = Math.min(maxDimension / width, maxDimension / height);
    width *= scale;
    height *= scale;
  }

  // 2のべき乗に調整
  const optimalWidth = Math.pow(2, Math.floor(Math.log2(width)));
  const optimalHeight = Math.pow(2, Math.floor(Math.log2(height)));

  return [optimalWidth, optimalHeight];
}

/**
 * 2次元FFTを実行する内部関数
 * @param channel 入力チャンネル（0-255の値）
 * @param width 画像の幅
 * @param height 画像の高さ
 * @returns FFT結果の複素数配列
 */
function perform2DFFT(
  channel: number[],
  width: number,
  height: number
): ComplexArray {
  // 実数部と虚数部の配列を初期化
  const real = new Array<number>(width * height).fill(0);
  const imag = new Array<number>(width * height).fill(0);

  // 入力データを実数部にコピー（センターシフトを適用）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // センターシフト（中心を原点に）- FFT後の低周波数成分を中央に配置
      const factor = Math.pow(-1, x + y);
      real[y * width + x] = channel[y * width + x] * factor;
    }
  }

  // 行方向のFFT
  for (let y = 0; y < height; y++) {
    const rowReal = new Array<number>(width);
    const rowImag = new Array<number>(width);

    for (let x = 0; x < width; x++) {
      rowReal[x] = real[y * width + x];
      rowImag[x] = imag[y * width + x];
    }

    const rowResult = fft1d(rowReal, rowImag);

    for (let x = 0; x < width; x++) {
      real[y * width + x] = rowResult.real[x];
      imag[y * width + x] = rowResult.imag[x];
    }
  }

  // 列方向のFFT
  for (let x = 0; x < width; x++) {
    const colReal = new Array<number>(height);
    const colImag = new Array<number>(height);

    for (let y = 0; y < height; y++) {
      colReal[y] = real[y * width + x];
      colImag[y] = imag[y * width + x];
    }

    const colResult = fft1d(colReal, colImag);

    for (let y = 0; y < height; y++) {
      real[y * width + x] = colResult.real[y];
      imag[y * width + x] = colResult.imag[y];
    }
  }

  return { real, imag };
}

/**
 * 1次元FFT（Cooley-Tukey アルゴリズム）を実行する内部関数
 * @param realInput 実数部の入力配列
 * @param imagInput 虚数部の入力配列
 * @returns FFT結果の複素数配列
 */
function fft1d(realInput: number[], imagInput: number[]): ComplexArray {
  const n = realInput.length;

  // 要素数が1の場合はそのまま返す
  if (n === 1) {
    return { real: [...realInput], imag: [...imagInput] };
  }

  // 要素数が2のべき乗でない場合はエラー
  if ((n & (n - 1)) !== 0) {
    throw new Error("FFTの入力サイズは2のべき乗である必要があります");
  }

  // 偶数と奇数のインデックスに分割
  const evenReal = new Array<number>(n / 2);
  const evenImag = new Array<number>(n / 2);
  const oddReal = new Array<number>(n / 2);
  const oddImag = new Array<number>(n / 2);

  for (let i = 0; i < n / 2; i++) {
    evenReal[i] = realInput[2 * i];
    evenImag[i] = imagInput[2 * i];
    oddReal[i] = realInput[2 * i + 1];
    oddImag[i] = imagInput[2 * i + 1];
  }

  // 再帰的にFFTを適用
  const evenResult = fft1d(evenReal, evenImag);
  const oddResult = fft1d(oddReal, oddImag);

  // 結果を合成
  const resultReal = new Array<number>(n);
  const resultImag = new Array<number>(n);

  for (let k = 0; k < n / 2; k++) {
    // 回転因子の計算
    const theta = (-2 * Math.PI * k) / n;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    // 回転因子をodd部分に適用
    const tReal = cosTheta * oddResult.real[k] - sinTheta * oddResult.imag[k];
    const tImag = cosTheta * oddResult.imag[k] + sinTheta * oddResult.real[k];

    // 結果を合成
    resultReal[k] = evenResult.real[k] + tReal;
    resultImag[k] = evenResult.imag[k] + tImag;
    resultReal[k + n / 2] = evenResult.real[k] - tReal;
    resultImag[k + n / 2] = evenResult.imag[k] - tImag;
  }

  return { real: resultReal, imag: resultImag };
}

/**
 * 2次元逆FFTを実行する内部関数
 * @param fftData FFT結果の複素数配列
 * @param width 画像の幅
 * @param height 画像の高さ
 * @returns 復元された画像チャンネル（0-255の値の配列）
 */
function performInverse2DFFT(
  fftData: ComplexArray,
  width: number,
  height: number
): number[] {
  // 実数部と虚数部のコピーを作成
  const real = [...fftData.real];
  const imag = [...fftData.imag];

  // 列方向の逆FFT
  for (let x = 0; x < width; x++) {
    const colReal = new Array<number>(height);
    const colImag = new Array<number>(height);

    for (let y = 0; y < height; y++) {
      colReal[y] = real[y * width + x];
      colImag[y] = imag[y * width + x];
    }

    // 虚数部の符号を反転して逆FFTとして使用
    for (let i = 0; i < height; i++) {
      colImag[i] = -colImag[i];
    }

    const colResult = fft1d(colReal, colImag);

    // 逆FFTの結果も虚数部の符号を反転
    for (let y = 0; y < height; y++) {
      real[y * width + x] = colResult.real[y];
      imag[y * width + x] = -colResult.imag[y];
    }
  }

  // 行方向の逆FFT
  for (let y = 0; y < height; y++) {
    const rowReal = new Array<number>(width);
    const rowImag = new Array<number>(width);

    for (let x = 0; x < width; x++) {
      rowReal[x] = real[y * width + x];
      rowImag[x] = imag[y * width + x];
    }

    // 虚数部の符号を反転して逆FFTとして使用
    for (let i = 0; i < width; i++) {
      rowImag[i] = -rowImag[i];
    }

    const rowResult = fft1d(rowReal, rowImag);

    // 逆FFTの結果も虚数部の符号を反転
    for (let x = 0; x < width; x++) {
      real[y * width + x] = rowResult.real[x];
      imag[y * width + x] = -rowResult.imag[x];
    }
  }

  // 結果を正規化して返す（実数部のみ使用）
  const result = new Array<number>(width * height);
  const n = width * height;

  for (let i = 0; i < n; i++) {
    // センターシフトを元に戻す
    const x = i % width;
    const y = Math.floor(i / width);
    const factor = Math.pow(-1, x + y);

    // N（総ピクセル数）で割って正規化し、実数部のみを返す
    result[i] = (real[i] * factor) / n;
  }

  return result;
}
