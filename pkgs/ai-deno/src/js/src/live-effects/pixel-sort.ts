import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { useTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./utils.ts";

const t = useTranslator({
  en: {
    title: "Pixel Sort V1",
    algorithm: "Algorithm",
    methodBitonic: "Bitonic Sort",
    sortAmount: "Sort Amount",
    direction: "Direction",
    horizontal: "Horizontal",
    vertical: "Vertical",
    startPoint: "Start Point",
    thresholdMin: "Threshold Min",
    thresholdMax: "Threshold Max",
    sliceLeft: "Slice Left",
    sliceRight: "Slice Right",
    sliceTop: "Slice Top",
    sliceBottom: "Slice Bottom",
  },
  ja: {
    title: "ピクセルソート V1",
    algorithm: "アルゴリズム",
    methodBitonic: "バイトニックソート",
    sortAmount: "ソート量",
    direction: "方向",
    horizontal: "横",
    vertical: "縦",
    startPoint: "始点",
    thresholdMin: "輝度のしきい値(最小)",
    thresholdMax: "輝度のしきい値(最大)",
    sliceLeft: "左スライス",
    sliceRight: "右スライス",
    sliceTop: "上スライス",
    sliceBottom: "下スライス",
  },
});

export const pixelSort = definePlugin({
  id: "pixel-sort-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      sortAmount: {
        type: "real",
        default: 50.0,
      },
      direction: {
        type: "string",
        enum: ["horizontal", "vertical"],
        default: "horizontal",
      },
      startPoint: {
        type: "real",
        default: 0.0,
      },
      thresholdMin: {
        type: "real",
        default: 0.0,
      },
      thresholdMax: {
        type: "real",
        default: 100.0,
      },
      algorithm: {
        type: "string",
        enum: ["bitonic"],
        default: "bitonic",
      },
      sliceLeft: {
        type: "real",
        default: 0.0,
      },
      sliceRight: {
        type: "real",
        default: 100.0,
      },
      sliceTop: {
        type: "real",
        default: 0.0,
      },
      sliceBottom: {
        type: "real",
        default: 100.0,
      },
    },
    editLiveEffectParameters: (params) => {
      return {
        sortAmount: Math.max(0, Math.min(100, params.sortAmount)),
        direction: params.direction,
        startPoint: Math.max(0, Math.min(100, params.startPoint)),
        thresholdMin: Math.max(0, Math.min(100, params.thresholdMin)),
        thresholdMax: Math.max(0, Math.min(100, params.thresholdMax)),
        algorithm: params.algorithm,
        sliceLeft: Math.max(0, Math.min(100, params.sliceLeft)),
        sliceRight: Math.max(0, Math.min(100, params.sliceRight)),
        sliceTop: Math.max(0, Math.min(100, params.sliceTop)),
        sliceBottom: Math.max(0, Math.min(100, params.sliceBottom)),
      };
    },
    liveEffectScaleParameters(params, scaleFactor) {
      return params;
    },
    liveEffectInterpolate: (paramsA, paramsB, t) => {
      return {
        sortAmount: lerp(paramsA.sortAmount, paramsB.sortAmount, t),
        direction: t < 0.5 ? paramsA.direction : paramsB.direction,
        startPoint: lerp(paramsA.startPoint, paramsB.startPoint, t),
        thresholdMin: lerp(paramsA.thresholdMin, paramsB.thresholdMin, t),
        thresholdMax: lerp(paramsA.thresholdMax, paramsB.thresholdMax, t),
        algorithm: "bitonic",
        sliceLeft: lerp(paramsA.sliceLeft, paramsB.sliceLeft, t),
        sliceRight: lerp(paramsA.sliceRight, paramsB.sliceRight, t),
        sliceTop: lerp(paramsA.sliceTop, paramsB.sliceTop, t),
        sliceBottom: lerp(paramsA.sliceBottom, paramsB.sliceBottom, t),
      };
    },

    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("algorithm") }),
          ui.select({
            key: "algorithm",
            label: t("algorithm"),
            value: params.algorithm,
            options: [{ value: "bitonic", label: t("methodBitonic") }],
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("sortAmount") }),
          ui.slider({
            key: "sortAmount",
            label: t("sortAmount"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sortAmount,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("direction") }),
          ui.select({
            key: "direction",
            label: t("direction"),
            value: params.direction,
            options: [
              { value: "horizontal", label: t("horizontal") },
              { value: "vertical", label: t("vertical") },
            ],
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("startPoint") }),
          ui.slider({
            key: "startPoint",
            label: t("startPoint"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.startPoint,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("thresholdMin") }),
          ui.slider({
            key: "thresholdMin",
            label: t("thresholdMin"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.thresholdMin,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("thresholdMax") }),
          ui.slider({
            key: "thresholdMax",
            label: t("thresholdMax"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.thresholdMax,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("sliceLeft") }),
          ui.slider({
            key: "sliceLeft",
            label: t("sliceLeft"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sliceLeft,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("sliceRight") }),
          ui.slider({
            key: "sliceRight",
            label: t("sliceRight"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sliceRight,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("sliceTop") }),
          ui.slider({
            key: "sliceTop",
            label: t("sliceTop"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sliceTop,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("sliceBottom") }),
          ui.slider({
            key: "sliceBottom",
            label: t("sliceBottom"),
            dataType: "float",
            min: 0,
            max: 100,
            value: params.sliceBottom,
          }),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then((adapter) =>
        adapter!.requestDevice({
          label: "WebGPU(Pixel Sort)",
        })
      );

      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }

      const shader = device.createShaderModule({
        label: "Pixel Sort Shader",
        code: `
          struct Params {
            sortAmount: f32,
            direction: u32,
            startPoint: f32,
            thresholdMin: f32,
            thresholdMax: f32,
            algorithm: u32,
            sliceLeft: f32,
            sliceRight: f32,
            sliceTop: f32,
            sliceBottom: f32,
            padding: u32,
          }

          @group(0) @binding(0) var inputTexture: texture_storage_2d<rgba8unorm, read>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(3) var<uniform> params: Params;

          // 共有メモリ - ワークグループ内でピクセルデータを共有
          var<workgroup> groupCache: array<vec4f, 2048>;

          // 輝度計算（アルファを考慮しない）
          fn getLuminance(color: vec4f) -> f32 {
            return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
          }

          // 輝度の閾値判定
          fn isInThresholdRange(color: vec4f, minThreshold: f32, maxThreshold: f32) -> bool {
            let lum = getLuminance(color);
            return lum >= minThreshold && lum <= maxThreshold;
          }

          // 2つのピクセルを比較して入れ替え
          fn compareAndSwap(a: u32, b: u32, ascending: bool) {
            let col_a = groupCache[a];
            let col_b = groupCache[b];

            let lum_a = getLuminance(col_a);
            let lum_b = getLuminance(col_b);

            let shouldSwap = (lum_a > lum_b) == ascending;

            if (shouldSwap) {
              groupCache[a] = col_b;
              groupCache[b] = col_a;
            }
          }

          @compute @workgroup_size(256, 1, 1)
          fn computeMain(@builtin(global_invocation_id) globalId: vec3u,
                          @builtin(local_invocation_id) localId: vec3u,
                          @builtin(workgroup_id) workgroupId: vec3u) {
            let dims = textureDimensions(inputTexture);

            // 方向に応じた処理対象の長さとインデックス計算
            let lineLength = select(dims.y, dims.x, params.direction == 0u);
            let lineId = select(workgroupId.y, workgroupId.x, params.direction == 0u);

            // 処理の範囲設定
            let startPoint = f32(params.startPoint / 100.0 * f32(lineLength));
            let thresholdMin = params.thresholdMin / 100.0;
            let thresholdMax = params.thresholdMax / 100.0;
            let sliceLeft = params.sliceLeft / 100.0;
            let sliceRight = params.sliceRight / 100.0;
            let sliceTop = params.sliceTop / 100.0;
            let sliceBottom = params.sliceBottom / 100.0;

            // ソートする範囲を制限する
            let sortSize = i32(params.sortAmount / 100.0 * f32(lineLength - startPoint));
            if (sortSize <= 1) {
              return; // ソートサイズが小さすぎる場合は処理しない
            }

            // 最大ソート要素数 (2のべき乗に切り上げ)
            var maxSortSize = 1;
            while (maxSortSize < sortSize) {
              maxSortSize *= 2;
            }

            // 各スレッドがロードするピクセルインデックス
            for (var i = i32(localId.x); i < maxSortSize; i += 256) {
              // スライス範囲や開始ポイントの判定を考慮
              let pixelIdx = startPoint + i;
              if (pixelIdx >= lineLength) {
                // 範囲外は処理しない、デフォルト値で埋める
                groupCache[i] = vec4f(0.0, 0.0, 0.0, 0.0);
                continue;
              }

              // テクスチャ座標の計算
              var pos: vec2i;
              if (params.direction == 0u) { // 水平方向
                pos = vec2i(pixelIdx, lineId);
              } else { // 垂直方向
                pos = vec2i(lineId, pixelIdx);
              }

              // スライス範囲チェック
              let texCoord = vec2f(pos) / vec2f(dims);
              if (texCoord.x < sliceLeft || texCoord.x > sliceRight ||
                  texCoord.y < sliceTop || texCoord.y > sliceBottom) {
                // 範囲外は処理しない、デフォルト値で埋める
                groupCache[i] = vec4f(0.0, 0.0, 0.0, 0.0);
                continue;
              }

              // ピクセルを読み取り
              let color = textureLoad(inputTexture, pos);

              // 閾値判定
              if (isInThresholdRange(color, thresholdMin, thresholdMax)) {
                groupCache[i] = color;
              } else {
                // 輝度が範囲外のピクセルは処理しないためにマーク
                groupCache[i] = vec4f(color.rgb, 0.0); // アルファを0にする
              }
            }

            // バリアで同期 - 全スレッドがデータをロードし終わるまで待機
            workgroupBarrier();

            // バイトニックソートの実装
            let maxLevel = 31 - firstLeadingBit(u32(maxSortSize));

            // 各フェーズでのソート
            for (var phase = 0; phase < maxLevel; phase++) {
              // 比較サイズの計算
              for (var compSize = 1 << phase; compSize > 0; compSize >>= 1) {
                // バリアで同期
                workgroupBarrier();

                // 各スレッドが処理するピクセルペアのインデックス計算
                for (var idx = i32(localId.x); idx < maxSortSize / 2; idx += 256) {
                  // 対応するペアを取得
                  let a = idx * 2;
                  let halfBlock = compSize;
                  let blockStart = (a / (halfBlock * 2)) * (halfBlock * 2);
                  let blockOffset = a % (halfBlock * 2);

                  let b = blockStart + select(blockOffset < halfBlock
                              , blockOffset + halfBlock
                              , blockOffset - halfBlock);

                  // 昇順/降順を決定
                  let blockId = a / (compSize * 2);
                  let ascending = (blockId % 2) == 0;

                  // ペアの比較とスワップ
                  compareAndSwap(u32(a), u32(b), ascending);
                }
              }
            }

            // バリアで同期 - ソート完了まで待機
            workgroupBarrier();

            // 結果を書き戻す
            for (var i = i32(localId.x); i < maxSortSize; i += 256) {
              let pixelIdx = startPoint + i;
              if (pixelIdx >= lineLength) {
                continue; // 範囲外は処理しない
              }

              // テクスチャ座標の計算
              var pos: vec2i;
              if (params.direction == 0u) { // 水平方向
                pos = vec2i(pixelIdx, lineId);
              } else { // 垂直方向
                pos = vec2i(lineId, pixelIdx);
              }

              // 元のピクセルを読み取り
              let originalColor = textureLoad(inputTexture, pos);

              // スライス範囲チェック
              let texCoord = vec2f(pos) / vec2f(dims);
              if (texCoord.x < sliceLeft || texCoord.x > sliceRight ||
                  texCoord.y < sliceTop || texCoord.y > sliceBottom) {
                textureStore(resultTexture, pos, originalColor);
                continue;
              }

              // ソート後のピクセル
              let sortedColor = groupCache[i];

              // アルファ値が0のピクセルは処理対象外だったピクセル
              if (sortedColor.a > 0.0) {
                textureStore(resultTexture, pos, sortedColor);
              } else {
                // 処理対象外のピクセルは元の値を保持
                textureStore(resultTexture, pos, originalColor);
              }
            }
          }
        `,
      });

      device.addEventListener("lost", (e) => {
        console.error(e);
      });

      device.addEventListener("uncapturederror", (e) => {
        console.error(e.error);
      });

      const pipeline = device.createComputePipeline({
        label: "Pixel Sort Pipeline",
        layout: "auto",
        compute: {
          module: shader,
          entryPoint: "computeMain",
        },
      });

      return { device, pipeline };
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      const texture = device.createTexture({
        label: "Input Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Result Texture",
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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

      const uniformData = new ArrayBuffer(48);
      const view = new DataView(uniformData);
      view.setFloat32(0, params.sortAmount, true);
      view.setUint32(4, params.direction === "horizontal" ? 0 : 1, true);
      view.setFloat32(8, params.startPoint, true);
      view.setFloat32(12, params.thresholdMin, true);
      view.setFloat32(16, params.thresholdMax, true);
      view.setUint32(20, params.algorithm === "bitonic" ? 1 : 0, true);
      view.setFloat32(24, params.sliceLeft, true);
      view.setFloat32(28, params.sliceRight, true);
      view.setFloat32(32, params.sliceTop, true);
      view.setFloat32(36, params.sliceBottom, true);
      view.setUint32(40, 0, true); // padding

      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

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
        label: "Pixel Sort Compute Pass",
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);

      // 新しいワークグループサイズに合わせて、ディスパッチサイズを調整
      // 1行/列ごとに1つのワークグループを割り当て
      let dispatchX, dispatchY;
      if (params.direction === "horizontal") {
        dispatchY = inputHeight; // 各行に1ワークグループ
        dispatchX = 1;
      } else {
        dispatchX = inputWidth; // 各列に1ワークグループ
        dispatchY = 1;
      }

      computePass.dispatchWorkgroups(dispatchX, dispatchY);
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
