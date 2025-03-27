import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag, definePlugin, ColorRGBA } from "../types.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

// 翻訳テキスト
const t = createTranslator({
  en: {
    title: "Brush Stroke V1",
    angle: "Angle",
    brushSize: "Brush Size",
    strokeLength: "Stroke Length",
    randomStrength: "Random Strength",
    randomSeed: "Random Seed",
    strokeDensity: "Stroke Density",
    blendWithOriginal: "Blend with Original",
  },
  ja: {
    title: "ブラシストローク V1",
    angle: "角度",
    brushSize: "ブラシサイズ",
    strokeLength: "ストローク長",
    randomStrength: "ランダムに描画",
    randomSeed: "ランダムシード",
    strokeDensity: "描画の濃度",
    blendWithOriginal: "元画像とブレンド",
  },
});

export const brushStroke = definePlugin({
  id: "brush-stroke-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      angle: {
        type: "real",
        default: 45.0,
      },
      brushSize: {
        // px
        type: "real",
        default: 10.0,
      },
      strokeLength: {
        // px
        type: "real",
        default: 25.0,
      },
      strokeDensity: {
        type: "real",
        default: 1.0,
      },
      randomStrength: {
        type: "real",
        default: 0.5,
      },
      randomSeed: {
        type: "int",
        default: 12345,
      },
      blendWithOriginal: {
        type: "real",
        default: 0.0,
      },
    },

    onEditParameters: (params) => {
      return params;
    },

    onAdjustColors: (params, adjustColor) => {
      return params;
    },

    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        brushSize: params.brushSize * scaleFactor,
        strokeLength: params.strokeLength * scaleFactor,
        strokeDensity: params.strokeDensity * scaleFactor,
      };
    },

    onInterpolate: (paramsA, paramsB, t) => {
      return {
        angle: lerp(paramsA.angle, paramsB.angle, t),
        brushSize: lerp(paramsA.brushSize, paramsB.brushSize, t),
        strokeLength: lerp(paramsA.strokeLength, paramsB.strokeLength, t),
        randomStrength: lerp(paramsA.randomStrength, paramsB.randomStrength, t),
        randomSeed: Math.round(lerp(paramsA.randomSeed, paramsB.randomSeed, t)),
        strokeDensity: lerp(paramsA.strokeDensity, paramsB.strokeDensity, t),
        blendWithOriginal: lerp(
          paramsA.blendWithOriginal,
          paramsB.blendWithOriginal,
          t
        ),
      };
    },

    renderUI: (params, setParam) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "angle",
              dataType: "float",
              min: 0,
              max: 360,
              value: params.angle,
            }),
            ui.numberInput({
              key: "angle",
              dataType: "float",
              value: params.angle,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("brushSize") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "brushSize",
              dataType: "float",
              min: 0.5,
              max: 20,
              value: params.brushSize,
            }),
            ui.numberInput({
              key: "brushSize",
              dataType: "float",
              value: params.brushSize,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("strokeLength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strokeLength",
              dataType: "float",
              min: 1,
              max: 200,
              value: params.strokeLength,
            }),
            ui.numberInput({
              key: "strokeLength",
              dataType: "float",
              value: params.strokeLength,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("strokeDensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strokeDensity",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.strokeDensity,
            }),
            ui.numberInput({
              key: "strokeDensity",
              dataType: "float",
              min: 0,
              max: 2,
              step: 0.1,
              value: params.strokeDensity,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("randomStrength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "randomStrength",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.randomStrength,
            }),
            ui.numberInput({
              key: "randomStrength",
              dataType: "float",
              min: 0,
              max: 1,
              step: 0.01,
              value: params.randomStrength,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("randomSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "randomSeed",
              dataType: "int",
              min: 1,
              max: 99999,
              value: params.randomSeed,
            }),
            ui.numberInput({
              key: "randomSeed",
              dataType: "int",
              value: params.randomSeed,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("blendWithOriginal") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "blendWithOriginal",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.blendWithOriginal,
            }),
            ui.numberInput({
              key: "blendWithOriginal",
              dataType: "float",
              min: 0,
              max: 100,
              step: 1,
              value: params.blendWithOriginal,
            }),
          ]),
        ]),
      ]);
    },

    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Brush Stroke Effect)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              angle: f32,
              brushSize: f32,
              strokeLength: f32,
              randomStrength: f32,
              randomSeed: i32,
              strokeDensity: f32,
              blendWithOriginal: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn hash(n: f32) -> f32 {
              return fract(sin(n) * 43758.5453);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(params.outputSize);
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // 元の画像の色を取得 (非プリマルチプライドアルファとして扱う)
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // 最終的な色（初期値は元画像）
              var finalColor = originalColor;

              // ランダムシードの設定
              let seed = f32(params.randomSeed);

              // 角度をラジアンに変換
              let baseAngleRad = params.angle * 3.14159265359 / 180.0;

              // 物理的な寸法に基づく計算（DPI-aware)
              let onTex1PxFactor = 1.0 / params.dpiScale; // 物理スケール係数

              // グリッド構造
              let physicalBrushSize = params.brushSize; // すでに物理単位
              let physicalCellSize = sqrt(physicalBrushSize) * 5.0; // ベースサイズ

              // 横方向と縦方向で異なる密度を適用
              let baseDensity = 1.0 / (physicalCellSize * params.dpiScale);
              // 横方向の密度はベース密度
              let densityX = baseDensity;
              // 縦方向の密度はstrokeDensityによって特に影響を受ける
              let densityY = baseDensity * params.strokeDensity * 1.5;

              // 異なる密度でグリッド座標を計算
              let gridCoordX = floor(texCoord.x * dims.x * densityX);
              let gridCoordY = floor(texCoord.y * dims.y * densityY);
              let gridCoord = vec2f(gridCoordX, gridCoordY);

              // このピクセルが含まれるセルとその周辺セルをループ
              // 下から上へスキャン (dy=-1から1) することで、上部のストロークが下部のストロークを上書きする
              for (var dy = -1; dy <= 1; dy++) {
                for (var dx = -1; dx <= 1; dx++) {
                  let cellPos = gridCoord + vec2f(f32(dx), f32(dy));

                  // ストローク1つあたりの基本的なランダム値
                  let cellHash = fract(sin(dot(cellPos, vec2f(12.9898, 78.233)) + seed * 0.01) * 43758.5453);

                  // このセルを描画するかどうかのランダム判定（密度調整）
                  // ブラシサイズが大きいほど、より多くのセルを描画 - 物理単位で一定
                  // strokeDensityも横方向の密度に影響
                  let cellDrawProb = min(0.95, 0.7 + physicalBrushSize * 0.015) * params.strokeDensity;
                  if (cellHash < cellDrawProb) {

                    // セルごとに個別の角度変動
                    let angleJitter = (cellHash * 2.0 - 1.0) * 0.6;
                    let strokeAngle = baseAngleRad + (angleJitter * params.randomStrength);
                    let strokeDir = vec2f(cos(strokeAngle), sin(strokeAngle));

                    let densityVec = vec2f(densityX, densityY);
                    let cellCenter = (cellPos + vec2f(0.5)) / (dims * densityVec);

                    // ストロークの長さ - 物理単位で一定
                    let physicalStrokeLength = params.strokeLength;
                    let pixelStrokeLength = physicalStrokeLength * params.dpiScale;
                    let strokeLen = (pixelStrokeLength * 0.3) / dims.x;

                    // ストロークは複数のセグメントではなく、独立した短い線分として
                    let halfLen = strokeLen * 0.5;
                    let strokeStart = cellCenter - strokeDir * halfLen;
                    let strokeEnd = cellCenter + strokeDir * halfLen;

                    // 現在のピクセルからストロークまでの距離計算
                    // 線分への最短距離を計算
                    let toPixel = texCoord - strokeStart;
                    let projLen = dot(toPixel, strokeDir);
                    let paramT = clamp(projLen / (strokeLen), 0.0, 1.0);

                    // ストローク上の最近点
                    let closestPt = strokeStart + strokeDir * paramT * strokeLen;

                    // ピクセルからストロークへの距離（線分からの距離）- 物理単位で計算
                    let distToLine = distance(texCoord, closestPt) * dims.x * onTex1PxFactor;

                    // 線端の丸め処理に使用する端点からの距離
                    let distToEnds = min(
                      distance(texCoord, strokeStart),
                      distance(texCoord, strokeEnd)
                    ) * dims.x * onTex1PxFactor;

                    // 端を丸くする距離場
                    let brushWidth = physicalBrushSize * 0.4; // 物理単位でのブラシ幅

                    // 線分上の場合は線からの距離、端点近くでは端点からの距離を使用
                    let endCapT = 0.1; // 端点の影響範囲（0～1）
                    let endCapBlend = step(endCapT, paramT) * step(endCapT, 1.0 - paramT);

                    // 線分または端点からの距離（丸い端部を作成）
                    let finalDist = mix(distToEnds, distToLine, endCapBlend);

                    // ブラシの形状（重み付け）
                    let weight = 1.0 - step(brushWidth, finalDist);

                    // ストロークの色をサンプリング（中心点から）- ストレートアルファとして扱う
                    let samplePos = cellCenter;
                    let sampledColor = textureSampleLevel(inputTexture, textureSampler, samplePos * toInputTexCoord, 0.0);

                    // 明示的にストレートアルファとして処理
                    var strokeColor = sampledColor;

                    // 色の微調整（非常に控えめに）
                    let colorShift = (fract(cellHash * 456.789) - 0.5) * 0.05;
                    strokeColor = vec4f(
                      clamp(strokeColor.r + colorShift, 0.0, 1.0),
                      clamp(strokeColor.g + colorShift, 0.0, 1.0),
                      clamp(strokeColor.b + colorShift, 0.0, 1.0),
                      strokeColor.a
                    );

                    // 重みに基づいて最終色にブレンド
                    if (weight > 0.01 && strokeColor.a > 0.001) {
                      let opacity = weight * strokeColor.a; // 元の透明度を保持
                      // 不透明度を累積的に計算（以前の結果を考慮）
                      let newAlpha = opacity + finalColor.a * (1.0 - opacity);

                      if (newAlpha > 0.001) {
                        // 色を適切にブレンド（アルファを考慮）
                        let blendedRGB = (strokeColor.rgb * opacity + finalColor.rgb * finalColor.a * (1.0 - opacity)) / newAlpha;
                        finalColor = vec4f(blendedRGB, newAlpha);
                      }
                    }
                  }
                }
              }

              // 最終的なストローク効果を元画像とブレンド（Oklchカラースペースで）
              let blendFactor = params.blendWithOriginal / 100.0;

              // ブレンドが0より大きい場合のみブレンド処理を行う
              if (blendFactor > 0.001) {
                // アルファ値を個別に計算
                let targetAlpha = mix(finalColor.a, originalColor.a, blendFactor);

                if (targetAlpha > 0.001) {
                  // 完全透明でない場合のみOklchブレンドを適用
                  let colorA = vec4f(finalColor.rgb, 1.0);   // 一時的にアルファを1にして色のみをブレンド
                  let colorB = vec4f(originalColor.rgb, 1.0);

                  // Oklchでカラーブレンド
                  let blendedColor = mixOklchVec4(colorA, colorB, blendFactor);
                  finalColor = vec4f(blendedColor.rgb, targetAlpha);
                } else {
                  // 完全透明の場合
                  finalColor = vec4f(0.0, 0.0, 0.0, 0.0);
                }
              }

              // ブレンドしない場合や、最終結果が元の効果と同じ場合は、結果がないときに元画像を使用
              if (finalColor.a < 0.001) {
                // ストローク効果がほとんどなく、元画像とのブレンドも少ない場合
                if (blendFactor > 0.9) {
                  // ほぼ完全に元画像を表示
                  finalColor = originalColor;
                }
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
            label: "Brush Stroke Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Brush Stroke Pipeline",
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
      console.log("Brush Stroke Effect", params);

      const dpiScale = dpi / baseDpi;
      imgData = await paddingImageData(
        imgData,
        Math.ceil((params.strokeLength / 3) * dpiScale)
      );

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // WebGPUのアライメントパディングを追加
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // テクスチャ作成
      const texture = device.createTexture({
        label: "Brush Stroke Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Brush Stroke Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Brush Stroke Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      // Uniformバッファを作成
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Brush Stroke Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // パラメータの設定
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale,
        angle: params.angle,
        brushSize: params.brushSize,
        strokeLength: params.strokeLength,
        randomStrength: params.randomStrength,
        randomSeed: params.randomSeed,
        strokeDensity: params.strokeDensity,
        blendWithOriginal: params.blendWithOriginal,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      // バインドグループの設定
      const bindGroup = device.createBindGroup({
        label: "Brush Stroke Main Bind Group",
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

      // 入力テクスチャを更新
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      // コンピュートシェーダーを実行
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Brush Stroke Compute Pass",
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

      // 結果を読み取り、表示
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );

      // WebGPUのアライメントパディングを削除して返す
      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
