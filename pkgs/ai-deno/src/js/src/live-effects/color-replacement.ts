import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag, definePlugin, ColorRGBA } from "../plugin.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
  parseColorCode,
  toColorCode,
} from "./_utils.ts";
import {
  createGPUDevice,
  includeOklchMix,
  includeOklabMix,
} from "./_shared.ts";

// 翻訳テキスト
const t = createTranslator({
  en: {
    title: "Color Replacement V1",
    conditionTitle: "From This Color",
    targetColor: "Source Color",
    hue: "Color Tone",
    hueRange: "Hue Range",
    saturation: "Vividness",
    saturationRange: "Saturation Range",
    brightness: "Lightness",
    brightnessRange: "Brightness Range",
    replacementColor: "To This Color",
    replacement: "Replacement Settings",
    preserveLuminance: "Keep Original Shadows & Highlights",
    mix: "Blend Amount",
    featherEdges: "Soft Edges",
    previewMask: "Show Selected Area",
    advanced: "Fine Tuning",
  },
  ja: {
    title: "色置換 V1",
    conditionTitle: "この色から",
    targetColor: "元の色",
    hue: "色味",
    hueRange: "色相の範囲",
    saturation: "鮮やかさ",
    saturationRange: "彩度の範囲",
    brightness: "明るさ",
    brightnessRange: "明度の範囲",
    replacementColor: "この色へ",
    replacement: "置換設定",
    preserveLuminance: "影と光を保持",
    mix: "ブレンド量",
    featherEdges: "やわらかい境界",
    previewMask: "選択範囲を表示",
    advanced: "詳細調整",
  },
});

// デフォルトの色選択条件
const defaultCondition = {
  targetHue: 0.0,
  hueRange: 30.0,
  saturationMin: 0.2,
  saturationMax: 1.0,
  brightnessMin: 0.2,
  brightnessMax: 1.0,
};

export const colorReplacement = definePlugin({
  id: "color-replacement-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      // 置換元の色（UIで選択するためのもの）
      sourceColor: {
        type: "color",
        default: { r: 0.0, g: 0.0, b: 1.0, a: 1.0 }, // デフォルトは青
      },

      // 置換色
      replacementColor: {
        type: "color",
        default: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }, // デフォルトは赤
      },

      // 明度を保持
      preserveLuminance: {
        type: "bool",
        default: true,
      },

      // ミックス (置換の適用度合い)
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

      // 色選択パラメータ
      targetHue: {
        type: "real",
        default: 240.0, // デフォルトは青の色相
      },
      hueRange: {
        type: "real",
        default: 30.0,
      },
      saturationMin: {
        type: "real",
        default: 0.2,
      },
      saturationMax: {
        type: "real",
        default: 1.0,
      },
      brightnessMin: {
        type: "real",
        default: 0.2,
      },
      brightnessMax: {
        type: "real",
        default: 1.0,
      },
    },
    onAdjustColors: (params, adjustColor) => {
      // 置換色をテーマカラーに合わせて調整
      return {
        ...params,
        sourceColor: adjustColor(params.sourceColor),
        replacementColor: adjustColor(params.replacementColor),
      };
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
      // スケールファクターがある場合の処理
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // 補間処理
      const result = {
        // 色とブール値のパラメータ
        sourceColor: {
          r: lerp(paramsA.sourceColor.r, paramsB.sourceColor.r, t),
          g: lerp(paramsA.sourceColor.g, paramsB.sourceColor.g, t),
          b: lerp(paramsA.sourceColor.b, paramsB.sourceColor.b, t),
          a: lerp(paramsA.sourceColor.a, paramsB.sourceColor.a, t),
        },
        replacementColor: {
          r: lerp(paramsA.replacementColor.r, paramsB.replacementColor.r, t),
          g: lerp(paramsA.replacementColor.g, paramsB.replacementColor.g, t),
          b: lerp(paramsA.replacementColor.b, paramsB.replacementColor.b, t),
          a: lerp(paramsA.replacementColor.a, paramsB.replacementColor.a, t),
        },
        preserveLuminance:
          t < 0.5 ? paramsA.preserveLuminance : paramsB.preserveLuminance,
        previewMask: t < 0.5 ? paramsA.previewMask : paramsB.previewMask,

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
      };

      return result;
    },

    renderUI: (params, { setParam }) => {
      // 色をHEXカラーコードに変換
      const sourceColorStr = toColorCode(params.sourceColor);
      const replacementColorStr = toColorCode(params.replacementColor);

      // 元の色から自動的にHSVパラメータを更新する関数
      const updateFromSourceColor = (color) => {
        // RGB→HSV変換
        const rgb = [color.r, color.g, color.b];

        // JavaScript側でRGB→HSV変換を行う関数
        const rgb2hsv = (rgb) => {
          const r = rgb[0];
          const g = rgb[1];
          const b = rgb[2];

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const d = max - min;

          let h = 0;
          const s = max === 0 ? 0 : d / max;
          const v = max;

          if (max !== min) {
            switch (max) {
              case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
              case g:
                h = (b - r) / d + 2;
                break;
              case b:
                h = (r - g) / d + 4;
                break;
            }
            h = h / 6;
          }

          return [h * 360, s, v]; // 色相は0-360度に変換
        };

        const [hue, saturation, brightness] = rgb2hsv(rgb);

        // HSVパラメータを更新
        setParam({
          targetHue: hue,
          saturationMin: Math.max(0, saturation - 0.2),
          saturationMax: Math.min(1, saturation + 0.2),
          brightnessMin: Math.max(0, brightness - 0.2),
          brightnessMax: Math.min(1, brightness + 0.2),
        });
      };

      // 色選択UIコンポーネント
      const colorConditionComponent = ui.group({ direction: "col" }, [
        // 元の色（ビジュアル選択）
        ui.group({ direction: "col" }, [
          ui.text({ text: t("targetColor") }),
          ui.group({ direction: "row" }, [
            ui.colorInput({
              key: "sourceColor",
              value: params.sourceColor,
              onChange: (e) => {
                updateFromSourceColor(e.value);
              },
            }),
            ui.textInput({
              key: "sourceColorText",
              value: sourceColorStr,
              onChange: (e) => {
                const color = parseColorCode(e.value);
                setParam({ sourceColor: color });
                updateFromSourceColor(color);
              },
            }),
          ]),
        ]),

        // 選択範囲をプレビュー
        ui.checkbox({
          key: "previewMask",
          value: params.previewMask,
          label: t("previewMask"),
        }),

        // エッジをぼかす
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

      // 置換設定コンポーネント
      const replacementComponent = ui.group({ direction: "col" }, [
        // 置換色
        ui.group({ direction: "col" }, [
          ui.text({ text: t("replacementColor") }),
          ui.group({ direction: "row" }, [
            ui.colorInput({
              key: "replacementColor",
              value: params.replacementColor,
            }),
            ui.textInput({
              key: "replacementColorText",
              value: replacementColorStr,
              onChange: (e) => {
                setParam({ replacementColor: parseColorCode(e.value) });
              },
            }),
          ]),
        ]),

        // 明度を保持
        ui.checkbox({
          key: "preserveLuminance",
          value: params.preserveLuminance,
          label: t("preserveLuminance"),
        }),

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
          ]),
        ]),
      ]);

      // メインUIを組み立て
      return ui.group({ direction: "col" }, [
        // 対象色セクション（元の色）
        ui.text({ text: t("conditionTitle") }),
        colorConditionComponent,

        ui.separator(),

        // 置換設定セクション（置き換え後の色）
        ui.text({ text: t("replacement") }),
        replacementComponent,
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Color Replacement)" },
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
            }

            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              replacementColor: vec4f,
              preserveLuminance: i32,
              featherEdges: f32,
              previewMask: i32,
              mix: f32,
              @align(16) condition: ColorCondition,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn calculateMatchFactor(oklch: vec3f, condition: ColorCondition, featherAmount: f32) -> f32 {
              let targetHueRad = condition.targetHue * 3.14159265359 / 180.0;
              let hueRangeRad = condition.hueRange * 3.14159265359 / 180.0;

              let isFullHueRange = condition.hueRange >= 180.0;

              var hueMatch = 0.0;
              if (isFullHueRange) {
                hueMatch = 1.0;
              } else {
                var hueDist = abs(oklch.z - targetHueRad);
                hueDist = min(hueDist, 2.0 * 3.14159265359 - hueDist);

                hueDist = hueDist / 3.14159265359;
                let hueRangeNorm = hueRangeRad / 3.14159265359;

                if (hueDist <= hueRangeNorm) {
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

              let normalizedChroma = oklch.y / 0.4;

              let isFullSatRange = condition.saturationMin <= 0.01 && condition.saturationMax >= 0.99;
              var satMatch = 0.0;

              if (isFullSatRange) {
                satMatch = 1.0;
              } else if (normalizedChroma >= condition.saturationMin && normalizedChroma <= condition.saturationMax) {
                let satLowerDist = normalizedChroma - condition.saturationMin;
                let satUpperDist = condition.saturationMax - normalizedChroma;
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

              let isFullBrightRange = condition.brightnessMin <= 0.01 && condition.brightnessMax >= 0.99;
              var brightMatch = 0.0;

              if (isFullBrightRange) {
                brightMatch = 1.0;
              } else if (oklch.x >= condition.brightnessMin && oklch.x <= condition.brightnessMax) {
                let brightLowerDist = oklch.x - condition.brightnessMin;
                let brightUpperDist = condition.brightnessMax - oklch.x;
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

              return hueMatch * satMatch * brightMatch;
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              if (originalColor.a < 0.01) {
                textureStore(resultTexture, id.xy, originalColor);
                return;
              }

              let originalOklch = rgbToOklch(originalColor.rgb);

              let matchFactor = calculateMatchFactor(originalOklch, params.condition, params.featherEdges);
              var maskColor = vec3f(matchFactor);

              var finalColor = originalColor.rgb;

              if (matchFactor > 0.0) {
                let replacementOklch = rgbToOklch(params.replacementColor.rgb);

                var newOklch = originalOklch;

                newOklch.z = replacementOklch.z;

                if (params.preserveLuminance != 0) {
                } else {
                  newOklch.x = mix(originalOklch.x, replacementOklch.x, matchFactor);
                }

                newOklch.y = mix(originalOklch.y, replacementOklch.y, matchFactor);

                let replacedColor = oklchToRgb(newOklch);

                finalColor = mixOklab(originalColor.rgb, replacedColor, params.mix * matchFactor);
              }

              if (params.previewMask != 0) {
                textureStore(resultTexture, id.xy, vec4f(maskColor, originalColor.a));
              } else {
                textureStore(resultTexture, id.xy, vec4f(finalColor, originalColor.a));
              }
            }

            ${includeOklchMix()}
            ${includeOklabMix()}
          `;

          const shader = device.createShaderModule({
            label: "Color Replacement Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Color Replacement Pipeline",
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
      console.log("Color Replacement V1", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // WebGPUの256バイトアライメントに合わせる
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // テクスチャの作成
      const texture = device.createTexture({
        label: "Color Replacement Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Color Replacement Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Color Replacement Texture Sampler",
        magFilter: "nearest",
        minFilter: "nearest",
      });

      // ユニフォームバッファの作成
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Color Replacement Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // ユニフォーム値を設定
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        replacementColor: params.replacementColor,
        preserveLuminance: params.preserveLuminance ? 1 : 0,
        featherEdges: params.featherEdges,
        previewMask: params.previewMask ? 1 : 0,
        mix: params.mix,
        condition: {
          targetHue: params.targetHue,
          hueRange: params.hueRange,
          saturationMin: params.saturationMin,
          saturationMax: params.saturationMax,
          brightnessMin: params.brightnessMin,
          brightnessMax: params.brightnessMax,
        },
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Color Replacement Main Bind Group",
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
        label: "Color Replacement Compute Pass",
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
