import { StyleFilterFlag, definePlugin } from "../plugin.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  createCanvas,
  Path2D,
  type CanvasRenderingContext2D,
  addWebGPUAlignmentPadding,
  ImageDataLike,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";
import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import * as svgVariableWidthLine from "npm:@hanakla/svg-variable-width-line";
import { createGPUDevice } from "./_shared.ts";

// Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Paper Texture Generator v2",
    paperType: "Paper Type",
    beatingDegree: "Beating Degree",
    fiberAmount: "Fiber Amount",
    fiberDarkness: "Fiber Darkness",
    seed: "Seed",
    invert: "Invert Colors",
    reset: "Reset",
    lightingEffect: "Lighting Effect",
    lightDirection: "Light Direction",
    lightIntensity: "Light Intensity",
    depthEffect: "Depth Effect",
    surfaceRoughness: "Surface Roughness",
  },
  ja: {
    title: "紙テクスチャ生成 v2",
    paperType: "紙の種類",
    beatingDegree: "叩解度",
    fiberAmount: "繊維の量",
    fiberDarkness: "繊維の濃さ",
    seed: "シード値",
    invert: "色を反転",
    reset: "リセット",
    lightingEffect: "光源効果",
    lightDirection: "光の方向",
    lightIntensity: "光の強さ",
    depthEffect: "凹凸効果",
    surfaceRoughness: "表面の粗さ",
  },
});

const defaultValues = {
  paperType: "woodfree",
  beatingDegree: 0.7,
  fiberAmount: 1.0,
  fiberDarkness: 0.2,
  seed: Math.floor(Math.random() * 100000),
  invert: false,
  lightingEnabled: true,
  lightIntensity: 0.5,
  lightAngle: 45.0,
  depthEffect: 0.5,
  surfaceRoughness: 0.3,
};

// Plugin definition
export const paperTextureV2 = definePlugin({
  id: "paper-texture-generator-v2",
  title: t("title"),
  version: { major: 2, minor: 0 },
  liveEffect: {
    subCategory: "Texture",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      paperType: {
        type: "string",
        enum: [
          "woodfree",
          "art",
          "coated",
          "machine",
          "lightCoated",
          "kouzo",
          "mitsumata",
          "ganpi",
          "tengujou",
          "tousagami",
        ],
        default: defaultValues.paperType,
      },
      beatingDegree: {
        type: "real",
        default: defaultValues.beatingDegree,
      },
      fiberAmount: {
        type: "real",
        default: defaultValues.fiberAmount,
      },
      fiberDarkness: {
        type: "real",
        default: defaultValues.fiberDarkness,
      },
      seed: {
        type: "int",
        default: Math.floor(Math.random() * 100000),
      },
      invert: {
        type: "bool",
        default: defaultValues.invert,
      },
      lightingEnabled: {
        type: "bool",
        default: defaultValues.lightingEnabled,
      },
      lightIntensity: {
        type: "real",
        default: defaultValues.lightIntensity,
      },
      lightAngle: {
        type: "real",
        default: defaultValues.lightAngle,
      },
      depthEffect: {
        type: "real",
        default: defaultValues.depthEffect,
      },
      surfaceRoughness: {
        type: "real",
        default: defaultValues.surfaceRoughness,
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
        fiberAmount: params.fiberAmount * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        paperType: t < 0.5 ? paramsA.paperType : paramsB.paperType,
        beatingDegree: lerp(paramsA.beatingDegree, paramsB.beatingDegree, t),
        fiberAmount: lerp(paramsA.fiberAmount, paramsB.fiberAmount, t),
        fiberDarkness: lerp(paramsA.fiberDarkness, paramsB.fiberDarkness, t),
        seed: Math.round(lerp(paramsA.seed, paramsB.seed, t)),
        invert: t < 0.5 ? paramsA.invert : paramsB.invert,
        lightingEnabled:
          t < 0.5 ? paramsA.lightingEnabled : paramsB.lightingEnabled,
        lightIntensity: lerp(paramsA.lightIntensity, paramsB.lightIntensity, t),
        lightAngle: lerp(paramsA.lightAngle, paramsB.lightAngle, t),
        depthEffect: lerp(paramsA.depthEffect, paramsB.depthEffect, t),
        surfaceRoughness: lerp(
          paramsA.surfaceRoughness,
          paramsB.surfaceRoughness,
          t
        ),
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("paperType") }),
          ui.select({
            key: "paperType",
            value: params.paperType,
            options: Object.entries(paperTypes).map(([key, value]) => ({
              label: value.type,
              value: key,
            })),
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("beatingDegree") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "beatingDegree",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.beatingDegree,
            }),
            ui.numberInput({
              key: "beatingDegree",
              dataType: "float",
              value: params.beatingDegree,
            }),
            ui.button({
              text: t("reset"),
              onClick: () =>
                setParam({
                  beatingDegree: defaultValues.beatingDegree,
                }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("fiberAmount") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "fiberAmount",
              dataType: "float",
              min: 0.1,
              max: 10,
              value: params.fiberAmount,
            }),
            ui.numberInput({
              key: "fiberAmount",
              dataType: "float",
              value: params.fiberAmount,
            }),
            ui.button({
              text: t("reset"),
              onClick: () =>
                setParam({ fiberAmount: defaultValues.fiberAmount }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("fiberDarkness") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "fiberDarkness",
              dataType: "float",
              min: 0,
              max: 1,
              value: params.fiberDarkness,
            }),
            ui.numberInput({
              key: "fiberDarkness",
              dataType: "float",
              value: params.fiberDarkness,
            }),
            ui.button({
              text: t("reset"),
              onClick: () =>
                setParam({ fiberDarkness: defaultValues.fiberDarkness }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("seed") }),
          ui.group({ direction: "row" }, [
            ui.numberInput({
              key: "seed",
              dataType: "int",
              value: params.seed,
            }),
            ui.button({
              text: t("reset"),
              onClick: () =>
                setParam({ seed: Math.floor(Math.random() * 100000) }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.checkbox({
            key: "invert",
            value: params.invert,
            label: t("invert"),
          }),
        ]),
        ui.separator(),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("lightingEffect") }),
          ui.select({
            key: "lightingEnabled",
            value: params.lightingEnabled ? "true" : "false",
            options: [
              { label: "ON", value: "true" },
              { label: "OFF", value: "false" },
            ],
            onChange: (e) => setParam({ lightingEnabled: e.value === "true" }),
          }),
        ]),
        !params.lightingEnabled
          ? null
          : ui.group({ direction: "col" }, [
              ui.group({ direction: "col" }, [
                ui.text({ text: t("lightIntensity") }),
                ui.group({ direction: "row" }, [
                  ui.slider({
                    key: "lightIntensity",
                    dataType: "float",
                    min: 0,
                    max: 1,
                    value: params.lightIntensity,
                  }),
                  ui.numberInput({
                    key: "lightIntensity",
                    dataType: "float",
                    value: params.lightIntensity,
                  }),
                  ui.button({
                    text: t("reset"),
                    onClick: () =>
                      setParam({
                        lightIntensity: defaultValues.lightIntensity,
                      }),
                  }),
                ]),
              ]),
              ui.group({ direction: "col" }, [
                ui.text({ text: t("lightDirection") }),
                ui.group({ direction: "row" }, [
                  ui.slider({
                    key: "lightAngle",
                    dataType: "float",
                    min: 0,
                    max: 360,
                    value: params.lightAngle,
                  }),
                  ui.numberInput({
                    key: "lightAngle",
                    dataType: "float",
                    value: params.lightAngle,
                  }),
                  ui.button({
                    text: t("reset"),
                    onClick: () =>
                      setParam({ lightAngle: defaultValues.lightAngle }),
                  }),
                ]),
              ]),
              ui.group({ direction: "col" }, [
                ui.text({ text: t("depthEffect") }),
                ui.group({ direction: "row" }, [
                  ui.slider({
                    key: "depthEffect",
                    dataType: "float",
                    min: 0,
                    max: 1,
                    value: params.depthEffect,
                  }),
                  ui.numberInput({
                    key: "depthEffect",
                    dataType: "float",
                    value: params.depthEffect,
                  }),
                  ui.button({
                    text: t("reset"),
                    onClick: () =>
                      setParam({ depthEffect: defaultValues.depthEffect }),
                  }),
                ]),
              ]),
              ui.group({ direction: "col" }, [
                ui.text({ text: t("surfaceRoughness") }),
                ui.group({ direction: "row" }, [
                  ui.slider({
                    key: "surfaceRoughness",
                    dataType: "float",
                    min: 0.05,
                    max: 1,
                    value: params.surfaceRoughness,
                  }),
                  ui.numberInput({
                    key: "surfaceRoughness",
                    dataType: "float",
                    value: params.surfaceRoughness,
                  }),
                  ui.button({
                    text: t("reset"),
                    onClick: () =>
                      setParam({
                        surfaceRoughness: defaultValues.surfaceRoughness,
                      }),
                  }),
                ]),
              ]),
            ]),
      ]);
    },
    initLiveEffect: async () => {
      // WebGPUデバイスの初期化
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Paper Texture Pro)" },
        },
        (device) => {
          // WebGPUシェーダーコード（紙の質感向上のための物理ベースレンダリング）
          const code = `
            struct Params {
              outputSize: vec2f,
              dpiScale: f32,
              lightingEnabled: u32,
              lightIntensity: f32,
              lightAngle: f32,
              depthEffect: f32,
              surfaceRoughness: f32,
            }

            @group(0) @binding(0) var baseTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // ノイズ関数
            fn hash(n: f32) -> f32 {
              return fract(sin(n) * 43758.5453);
            }

            fn vnoise(p: vec2f) -> f32 {
              let i = floor(p);
              let f = fract(p);

              let a = hash(i.x + i.y * 57.0);
              let b = hash(i.x + 1.0 + i.y * 57.0);
              let c = hash(i.x + i.y * 57.0 + 1.0);
              let d = hash(i.x + 1.0 + i.y * 57.0 + 1.0);

              let u = f * f * (3.0 - 2.0 * f);

              return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            // 法線マップ生成
            fn calculateNormal(texCoord: vec2f, texelSize: vec2f, inputMapping: vec2f) -> vec3f {
              let center = textureSampleLevel(baseTexture, textureSampler, texCoord * inputMapping, 0.0).r;
              let left = textureSampleLevel(baseTexture, textureSampler, (texCoord - vec2f(texelSize.x, 0.0)) * inputMapping, 0.0).r;
              let right = textureSampleLevel(baseTexture, textureSampler, (texCoord + vec2f(texelSize.x, 0.0)) * inputMapping, 0.0).r;
              let top = textureSampleLevel(baseTexture, textureSampler, (texCoord - vec2f(0.0, texelSize.y)) * inputMapping, 0.0).r;
              let bottom = textureSampleLevel(baseTexture, textureSampler, (texCoord + vec2f(0.0, texelSize.y)) * inputMapping, 0.0).r;

              let strength = params.depthEffect * 2.0;
              let dx = (right - left) * strength;
              let dy = (bottom - top) * strength;

              return normalize(vec3f(-dx, -dy, 1.0));
            }

            // 物理ベースライティング
            fn calculateLighting(normal: vec3f, roughness: f32) -> f32 {
              let lightDir = normalize(vec3f(cos(radians(params.lightAngle)), sin(radians(params.lightAngle)), 0.8));
              let viewDir = vec3f(0.0, 0.0, 1.0);
              let halfDir = normalize(lightDir + viewDir);

              // 拡散反射（ランバート）
              let diffuse = max(dot(normal, lightDir), 0.0);

              // 鏡面反射（GGX/Trowbridge-Reitz）
              let NdotH = max(dot(normal, halfDir), 0.0);
              let alpha = roughness * roughness;
              let D = alpha * alpha / (3.14159 * pow(NdotH * NdotH * (alpha * alpha - 1.0) + 1.0, 2.0));

              // フレネル項（簡易版）
              let F0 = 0.04;
              let F = F0 + (1.0 - F0) * pow(1.0 - max(dot(viewDir, halfDir), 0.0), 5.0);

              // 幾何項（簡易版）
              let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
              let G = (max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0)) /
                     (max(dot(normal, viewDir), 0.0) * (1.0 - k) + k) *
                     (max(dot(normal, lightDir), 0.0) * (1.0 - k) + k);

              let specular = (D * F * G) / (4.0 * max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0) + 0.001);

              // アンビエント項
              let ambient = 0.2;

              // 最終的な光の強さ
              return ambient + (diffuse + specular) * params.lightIntensity;
            }

            // 繊維の深度効果を追加
            fn addFiberDepth(baseColor: vec4f, texCoord: vec2f) -> vec4f {
              let noise1 = vnoise(texCoord * 1500.0) * 0.05;
              let noise2 = vnoise(texCoord * 500.0) * 0.1;

              // 繊維の色に深度によるバリエーションを加える
              let depthVariation = mix(1.0, noise1 + noise2, params.depthEffect * 0.5);

              // 紙の半透明さによる不均一な質感
              let subsurface = vnoise(texCoord * 200.0) * params.depthEffect * 0.1;

              return vec4f(
                baseColor.rgb * (0.97 + depthVariation) + vec3f(subsurface),
                baseColor.a
              );
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(baseTexture));
              let dims = vec2f(params.outputSize);
              // テクスチャ座標計算 - すべての計算でこの座標を使用する
              let texCoord = vec2f(id.xy) / dims;
              // 入力テクスチャ空間へのマッピング - サンプリング時に必須
              let toInputTexCoord = dims / dimsWithGPUPadding;
              // DPIスケールに合わせた正規化座標への変換
              let toScaledNomalizedAmountByPixels = 1.0 / (dims * params.dpiScale);

              // バウンディングチェック
              if (texCoord.x > 1.0 || texCoord.y > 1.0) {
                return;
              }

              // 元のテクスチャカラーを取得
              let baseColor = textureSampleLevel(baseTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // WebGPUによる処理を行わない場合はそのまま出力
              if (params.lightingEnabled == 0u) {
                textureStore(resultTexture, id.xy, baseColor);
                return;
              }

              // テクスチャからノーマル（法線）マップを生成
              let texelSize = toScaledNomalizedAmountByPixels;
              let normal = calculateNormal(texCoord, texelSize, toInputTexCoord);

              // ライティング計算（物理ベース）
              let lighting = calculateLighting(normal, params.surfaceRoughness);

              // 繊維の深度効果
              let colorWithDepth = addFiberDepth(baseColor, texCoord);

              // 最終カラー
              let finalColor = vec4f(colorWithDepth.rgb * lighting, colorWithDepth.a);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Paper Texture Pro Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
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
      console.log("Paper Texture Generator Pro", params);

      // Calculate DPI scale factor
      const dpiScale = dpi / baseDpi;

      // Create a normalized size canvas for consistent layout
      const normalizedWidth = Math.round(imgData.width / dpiScale);
      const normalizedHeight = Math.round(imgData.height / dpiScale);

      const random = new SeededRandom(params.seed);
      const paperParams = paperTypes[params.paperType];

      // Create fiber planning at the normalized resolution
      // This ensures the same layout regardless of DPI
      const fiberPlans = planFibers(
        normalizedWidth,
        normalizedHeight,
        paperParams,
        params.beatingDegree,
        params.fiberAmount,
        params.fiberDarkness,
        random
      );

      // Create base texture using Canvas
      const baseCanvas = await createCanvas(imgData.width, imgData.height);
      const baseCtx = baseCanvas.getContext("2d");

      // Start fresh for rendering
      const renderRandom = new SeededRandom(params.seed);

      // Render base texture and coating
      baseCtx.fillStyle = "white";
      baseCtx.fillRect(0, 0, imgData.width, imgData.height);

      addBaseTexture(
        baseCtx,
        imgData.width,
        imgData.height,
        paperParams,
        renderRandom,
        dpiScale
      );

      // Render fibers using the same plans but scaled up
      renderFibersFromPlan(
        baseCtx,
        fiberPlans,
        dpiScale,
        paperParams,
        renderRandom
      );

      // Add coating and gloss
      addCoating(baseCtx, imgData.width, imgData.height, paperParams);

      let output: ImageDataLike = baseCtx.getImageData(
        0,
        0,
        imgData.width,
        imgData.height
      );

      if (params.lightingEnabled) {
        // ライティング処理
        output = await processWithWebGPU(
          device,
          pipeline,
          pipelineDef,
          output,
          params,
          dpiScale
        );
      }

      if (params.invert) {
        for (let i = 0; i < output.data.length; i += 4) {
          output.data[i] = 255 - output.data[i];
          output.data[i + 1] = 255 - output.data[i + 1];
          output.data[i + 2] = 255 - output.data[i + 2];
        }
      }

      return output;
    },
  },
});

async function processWithWebGPU(
  device: GPUDevice,
  pipeline: GPUComputePipeline,
  pipelineDef: any,
  baseTexture: ImageDataLike,
  params: any,
  dpiScale: number
): Promise<ImageDataLike> {
  const outputSize = { width: baseTexture.width, height: baseTexture.height };

  baseTexture = await addWebGPUAlignmentPadding(baseTexture);

  // 入力テクスチャの作成
  const inputTexture = device.createTexture({
    size: [baseTexture.width, baseTexture.height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  // 出力テクスチャの作成
  const resultTexture = device.createTexture({
    size: [baseTexture.width, baseTexture.height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });

  // サンプラーの作成
  const sampler = device.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  // ユニフォームバッファの作成
  const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
  const uniformBuffer = device.createBuffer({
    size: uniformValues.arrayBuffer.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // ユニフォームバッファの更新
  uniformValues.set({
    outputSize: [baseTexture.width, baseTexture.height],
    dpiScale: dpiScale,
    lightingEnabled: params.lightingEnabled ? 1 : 0,
    lightIntensity: params.lightIntensity,
    lightAngle: params.lightAngle,
    depthEffect: params.depthEffect,
    surfaceRoughness: params.surfaceRoughness,
  });

  device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

  // 入力テクスチャにデータを書き込む
  device.queue.writeTexture(
    { texture: inputTexture },
    baseTexture.data,
    { bytesPerRow: baseTexture.width * 4 },
    [baseTexture.width, baseTexture.height]
  );

  // バインドグループの作成
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: inputTexture.createView(),
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

  // GPUコマンドの実行
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(
    Math.ceil(baseTexture.width / 16),
    Math.ceil(baseTexture.height / 16)
  );
  passEncoder.end();

  // 結果の読み出し用バッファ
  const resultBuffer = device.createBuffer({
    size: baseTexture.width * baseTexture.height * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // 結果テクスチャからバッファへのコピー
  commandEncoder.copyTextureToBuffer(
    { texture: resultTexture },
    { buffer: resultBuffer, bytesPerRow: baseTexture.width * 4 },
    [baseTexture.width, baseTexture.height]
  );

  // コマンドの提出
  device.queue.submit([commandEncoder.finish()]);

  // 結果の読み出し
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const resultData = new Uint8ClampedArray(
    resultBuffer.getMappedRange().slice(0)
  );
  resultBuffer.unmap();

  // 出力ImageDataの作成
  return removeWebGPUAlignmentPadding(
    new ImageData(resultData, baseTexture.width, baseTexture.height),
    outputSize.width,
    outputSize.height
  );
}

// 紙の種類に関する型定義
interface FiberType {
  ratio: number;
  baseGrayOffset: number;
}

interface PaperType {
  type: string;
  baseColor: string;
  roughness: number;
  fiberDensity: number;
  coating: number;
  gloss: number;
  beatingDegree: number;
  japanesePaper?: boolean;
  fibers: FiberType[];
  // svg-variable-width-line用の設定
  baseWeight: number;
  weightVariation: number;
  smoothingPasses: number;
}

// Paper types definition
const paperTypes: Record<string, PaperType> = {
  woodfree: {
    type: "上質紙",
    baseColor: "#f5f5f0",
    roughness: 0.3,
    fiberDensity: 0.7,
    coating: 0,
    gloss: 0.2,
    beatingDegree: 0.7,
    baseWeight: 1.2,
    weightVariation: 0.3,
    smoothingPasses: 2,
    fibers: [
      { ratio: 0.7, baseGrayOffset: 0 },
      { ratio: 0.2, baseGrayOffset: -20 },
      { ratio: 0.1, baseGrayOffset: 10 },
    ],
  },
  art: {
    type: "アート紙",
    baseColor: "#f4f4ec",
    roughness: 0.1,
    fiberDensity: 0.5,
    coating: 0.6,
    gloss: 0.75,
    beatingDegree: 0.9,
    baseWeight: 0.8,
    weightVariation: 0.2,
    smoothingPasses: 3,
    fibers: [
      { ratio: 0.8, baseGrayOffset: 0 },
      { ratio: 0.2, baseGrayOffset: -15 },
    ],
  },
  coated: {
    type: "コート紙",
    baseColor: "#f8f8f5",
    roughness: 0.2,
    fiberDensity: 0.6,
    coating: 0.6,
    gloss: 0.7,
    beatingDegree: 0.8,
    baseWeight: 1.0,
    weightVariation: 0.25,
    smoothingPasses: 3,
    fibers: [
      { ratio: 0.9, baseGrayOffset: 0 },
      { ratio: 0.1, baseGrayOffset: -10 },
    ],
  },
  machine: {
    type: "マシン紙",
    baseColor: "#f2f2e8",
    roughness: 0.6,
    fiberDensity: 0.8,
    coating: 0,
    gloss: 0.1,
    beatingDegree: 0.5,
    baseWeight: 1.8,
    weightVariation: 0.6,
    smoothingPasses: 1,
    fibers: [
      { ratio: 0.5, baseGrayOffset: 0 },
      { ratio: 0.3, baseGrayOffset: -30 },
      { ratio: 0.2, baseGrayOffset: 20 },
    ],
  },
  lightCoated: {
    type: "微塗工紙",
    baseColor: "#f4f4ec",
    roughness: 0.4,
    fiberDensity: 0.7,
    coating: 0.3,
    gloss: 0.4,
    beatingDegree: 0.6,
    baseWeight: 1.1,
    weightVariation: 0.35,
    smoothingPasses: 2,
    fibers: [
      { ratio: 0.7, baseGrayOffset: 0 },
      { ratio: 0.3, baseGrayOffset: -15 },
    ],
  },
  kouzo: {
    type: "楮(こうぞ)和紙 [和紙]",
    baseColor: "#f7f4e9",
    roughness: 0.8,
    fiberDensity: 0.5,
    coating: 0,
    gloss: 0.05,
    beatingDegree: 0.3,
    japanesePaper: true,
    baseWeight: 2.5,
    weightVariation: 1.2,
    smoothingPasses: 1,
    fibers: [
      { ratio: 0.5, baseGrayOffset: 0 },
      { ratio: 0.3, baseGrayOffset: -25 },
      { ratio: 0.2, baseGrayOffset: 15 },
    ],
  },
  mitsumata: {
    type: "三椏(みつまた)和紙 [和紙]",
    baseColor: "#f9f6ee",
    roughness: 0.6,
    fiberDensity: 0.6,
    coating: 0,
    gloss: 0.1,
    beatingDegree: 0.4,
    japanesePaper: true,
    baseWeight: 2.0,
    weightVariation: 0.9,
    smoothingPasses: 1,
    fibers: [
      { ratio: 0.6, baseGrayOffset: 0 },
      { ratio: 0.4, baseGrayOffset: -20 },
    ],
  },
  ganpi: {
    type: "雁皮(がんぴ)和紙 [和紙]",
    baseColor: "#f8f7f2",
    roughness: 0.4,
    fiberDensity: 0.7,
    coating: 0,
    gloss: 0.15,
    beatingDegree: 0.5,
    japanesePaper: true,
    baseWeight: 1.8,
    weightVariation: 0.8,
    smoothingPasses: 2,
    fibers: [
      { ratio: 0.7, baseGrayOffset: 0 },
      { ratio: 0.3, baseGrayOffset: 20 },
    ],
  },
  tengujou: {
    type: "典具帖(てんぐじょう)紙 [和紙]",
    baseColor: "#fffcf5",
    roughness: 0.2,
    fiberDensity: 0.8,
    coating: 0,
    gloss: 0.2,
    beatingDegree: 0.6,
    japanesePaper: true,
    baseWeight: 1.5,
    weightVariation: 0.7,
    smoothingPasses: 2,
    fibers: [
      { ratio: 0.8, baseGrayOffset: 0 },
      { ratio: 0.2, baseGrayOffset: 15 },
    ],
  },
  tousagami: {
    type: "土佐(とうさ)和紙 [和紙]",
    baseColor: "#f6f3e8",
    roughness: 0.7,
    fiberDensity: 0.55,
    coating: 0,
    gloss: 0.08,
    beatingDegree: 0.35,
    japanesePaper: true,
    baseWeight: 3.0,
    weightVariation: 1.5,
    smoothingPasses: 1,
    fibers: [
      { ratio: 0.4, baseGrayOffset: 0 },
      { ratio: 0.4, baseGrayOffset: -25 },
      { ratio: 0.2, baseGrayOffset: 20 },
    ],
  },
};

// Create variable width line using svg-variable-width-line
function createVariableWidthLine(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  baseWidth: number,
  paperParams: PaperType,
  random: SeededRandom,
  dpiScale: number
): Path2D {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Generate points along the line with weight variation
  const numPoints = Math.max(3, Math.floor(length / (8 * dpiScale)));
  const points: svgVariableWidthLine.Point[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const x = startX + dx * t;
    const y = startY + dy * t;

    // Calculate weight with random variation
    const baseWeight = paperParams.baseWeight * baseWidth * dpiScale;
    const variation = paperParams.weightVariation * baseWeight;
    const randomFactor = (random.next() - 0.5) * 2;
    let w = baseWeight + variation * randomFactor;

    // Add tapering effect at the ends
    const taperFactor = Math.sin(t * Math.PI);
    w *= 0.3 + 0.7 * taperFactor;

    // Ensure minimum width
    w = Math.max(0.1 * dpiScale, w);

    points.push({ x, y, w });
  }

  // Apply smoothing based on paper type
  const smoothedPoints = svgVariableWidthLine.smooth(
    points,
    paperParams.smoothingPasses
  );

  // Generate SVG path data
  const { d } = svgVariableWidthLine.compute(...smoothedPoints);

  // Convert to Path2D for Canvas rendering
  return new Path2D(d);
}

// Create path for Japanese paper branch with natural variation
function createJapaneseBranchPath(
  path: [number, number][],
  baseWidth: number,
  paperParams: PaperType,
  random: SeededRandom,
  dpiScale: number
): Path2D {
  if (path.length < 2) {
    return new Path2D();
  }

  const points: svgVariableWidthLine.Point[] = [];

  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i];

    // Calculate weight with gradual tapering and variation
    const baseWeight = paperParams.baseWeight * baseWidth * dpiScale;
    const variation = paperParams.weightVariation * baseWeight;
    const randomFactor = (random.next() - 0.5) * 2;
    let w = baseWeight + variation * randomFactor;

    // Natural tapering from root to tip
    const t = i / (path.length - 1);
    const taperFactor = Math.pow(1 - t, 0.7);
    w *= 0.2 + 0.8 * taperFactor;

    // Ensure minimum width
    w = Math.max(0.1 * dpiScale, w);

    points.push({ x, y, w });
  }

  // Apply smoothing for natural curves
  const smoothedPoints = svgVariableWidthLine.smooth(
    points,
    paperParams.smoothingPasses
  );

  // Generate SVG path data
  const { d } = svgVariableWidthLine.compute(...smoothedPoints);

  return new Path2D(d);
}
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
}

// Add base texture noise
function addBaseTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: PaperType,
  random: SeededRandom,
  dpiScale: number = 1
): void {
  // For base texture, we need to create a noise that's consistent regardless of DPI
  // We'll create a scaled noise pattern based on DPI

  // Create noise at a base resolution then scale it if needed
  const scaledSize = Math.max(1, Math.round(dpiScale));
  const noiseBlockSize = Math.max(1, Math.floor(scaledSize));

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Generate noise with blocks sized according to DPI scale
  for (let y = 0; y < height; y += noiseBlockSize) {
    for (let x = 0; x < width; x += noiseBlockSize) {
      // Generate one noise value for this block
      const noise = Math.floor(255 - random.next() * params.roughness * 40);

      // Fill the block with this noise value
      for (let dy = 0; dy < noiseBlockSize && y + dy < height; dy++) {
        for (let dx = 0; dx < noiseBlockSize && x + dx < width; dx++) {
          const pixelIndex = ((y + dy) * width + (x + dx)) * 4;
          pixels[pixelIndex] = noise;
          pixels[pixelIndex + 1] = noise;
          pixels[pixelIndex + 2] = noise;
          pixels[pixelIndex + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// マイクロファイバーの定義
interface MicroFiberDetail {
  length: number;
  angle: number;
  gray: number;
}

// 通常の繊維の計画
interface RegularFiberPlan {
  type: "regular";
  x: number;
  y: number;
  length: number;
  width: number;
  angle: number;
  gray: number;
  hasMicroFibers: boolean;
  microFibers: number;
  microDetails: MicroFiberDetail[];
}

// 和紙の枝分かれの定義
interface BranchDefinition {
  start: [number, number];
  end: [number, number];
  width: number;
  gray: number;
  subBranch?: BranchDefinition | null;
}

// 和紙繊維の計画
interface JapanesePaperFiberPlan {
  mainPath: [number, number][];
  branches: BranchDefinition[];
  baseWidth: number;
  currentGray: number;
  finalGray: number;
}

// 和紙繊維のプラン情報
interface JapaneseFiberPlan {
  type: "japanese";
  plan: JapanesePaperFiberPlan;
  baseGray: number;
}

// 繊維プランの共通型
type FiberPlan = RegularFiberPlan | JapaneseFiberPlan;

// Plan fibers without drawing them
function planFibers(
  width: number,
  height: number,
  params: PaperType,
  beatingDegree: number,
  fiberAmount: number,
  fiberDarkness: number,
  random: SeededRandom
): FiberPlan[] {
  const fiberPlans = [];
  const baseCount = 300 * fiberAmount;
  const fiberCount = Math.floor(
    baseCount * (params.fiberDensity * (0.5 + beatingDegree * 0.5))
  );

  // Plan fibers for each color type
  const fibers = params.fibers || [{ ratio: 1, baseGrayOffset: 0 }];
  for (const fiber of fibers) {
    const fiberTypeCount = Math.floor(fiberCount * fiber.ratio);
    const baseGray =
      Math.floor(250 - fiberDarkness * 100) + fiber.baseGrayOffset;

    for (let i = 0; i < fiberTypeCount; i++) {
      const x = random.next() * width;
      const y = random.next() * height;
      const fiberLength = 20 + random.next() * (80 * (1 - beatingDegree));
      const fiberWidth = 0.2 + (1 - beatingDegree) * 1.5;
      const angle = random.next() * Math.PI * (1 + (1 - beatingDegree));

      if (params.japanesePaper) {
        // Plan Japanese paper fiber
        const japaneseFiberPlan = planJapanesePaperFiber(
          x,
          y,
          fiberLength,
          fiberWidth,
          angle,
          random,
          baseGray
        );
        fiberPlans.push({
          type: "japanese" as const,
          plan: japaneseFiberPlan,
          baseGray,
        });
      } else {
        // Plan regular fiber
        fiberPlans.push({
          type: "regular" as const,
          x,
          y,
          length: fiberLength,
          width: fiberWidth,
          angle,
          gray: Math.floor(baseGray - random.next() * 10),
          hasMicroFibers: beatingDegree > 0.5,
          microFibers: beatingDegree > 0.5 ? Math.floor(beatingDegree * 8) : 0,
          microDetails:
            beatingDegree > 0.5
              ? Array.from({ length: Math.floor(beatingDegree * 8) }, () => ({
                  length: fiberLength * 0.2,
                  angle:
                    angle +
                    (random.next() - 0.5) * Math.PI * (1 - beatingDegree),
                  gray: Math.floor(baseGray + 10 - random.next() * 10),
                }))
              : [],
        });
      }
    }
  }

  return fiberPlans;
}

// Plan Japanese paper fiber without drawing
function planJapanesePaperFiber(
  x: number,
  y: number,
  baseLength: number,
  baseWidth: number,
  angle: number,
  random: SeededRandom,
  baseGray: number
): JapanesePaperFiberPlan {
  const plan: JapanesePaperFiberPlan = {
    mainPath: [] as [number, number][],
    branches: [] as BranchDefinition[],
    baseWidth,
    currentGray: baseGray - Math.floor(random.next() * 10),
    finalGray: 0,
  };

  let currentAngle = angle;
  let currentX = x;
  let currentY = y;
  let currentWidth = baseWidth;
  let currentGray = baseGray - Math.floor(random.next() * 10);

  plan.mainPath.push([currentX, currentY]);

  const segments = Math.floor(5 + random.next() * 5);
  const totalLength = baseLength * (1.5 + random.next());
  const segmentLength = totalLength / segments;

  for (let i = 0; i < segments; i++) {
    const thisSegmentLength = segmentLength * (0.8 + random.next() * 0.4);
    const angleVariation = (random.next() - 0.5) * Math.PI * 0.3;
    currentAngle += angleVariation;

    currentGray += (random.next() - 0.5) * 20;
    currentGray = Math.max(baseGray - 30, Math.min(baseGray + 10, currentGray));

    currentX += Math.cos(currentAngle) * thisSegmentLength;
    currentY += Math.sin(currentAngle) * thisSegmentLength;
    plan.mainPath.push([currentX, currentY]);

    if (random.next() < 0.2 && plan.mainPath.length > 1) {
      const branchAngle = currentAngle + (random.next() - 0.5) * Math.PI * 0.7;
      const branchLength = thisSegmentLength * (0.4 + random.next() * 0.8);
      const branchWidth = currentWidth * (0.5 + random.next() * 0.3);

      const branchX = currentX + Math.cos(branchAngle) * branchLength;
      const branchY = currentY + Math.sin(branchAngle) * branchLength;
      const branchGray = currentGray + (random.next() - 0.5) * 20;

      const branch: BranchDefinition = {
        start: [currentX, currentY],
        end: [branchX, branchY],
        width: branchWidth,
        gray: branchGray,
        subBranch: null,
      };

      if (random.next() < 0.3) {
        const subBranchAngle =
          branchAngle + (random.next() - 0.5) * Math.PI * 0.5;
        const subBranchLength = branchLength * 0.6;
        const subBranchX = branchX + Math.cos(subBranchAngle) * subBranchLength;
        const subBranchY = branchY + Math.sin(subBranchAngle) * subBranchLength;

        branch.subBranch = {
          start: [branchX, branchY],
          end: [subBranchX, subBranchY],
          width: branchWidth * 0.7,
          gray: branchGray + 10,
        };
      }

      plan.branches.push(branch);
    }

    currentWidth *= 0.9 + random.next() * 0.2;
  }

  plan.finalGray = currentGray;
  return plan;
}

// Render fibers from plan with appropriate scaling
function renderFibersFromPlan(
  ctx: CanvasRenderingContext2D,
  fiberPlans: FiberPlan[],
  dpiScale: number,
  paperParams: PaperType,
  random: SeededRandom
): void {
  for (const fiber of fiberPlans) {
    if (fiber.type === "japanese") {
      renderJapaneseFiberFromPlan(
        ctx,
        fiber.plan,
        dpiScale,
        paperParams,
        random
      );
    } else {
      // Regular fiber using variable width line
      const startX = fiber.x * dpiScale;
      const startY = fiber.y * dpiScale;
      const endX = (fiber.x + Math.cos(fiber.angle) * fiber.length) * dpiScale;
      const endY = (fiber.y + Math.sin(fiber.angle) * fiber.length) * dpiScale;

      const fiberPath = createVariableWidthLine(
        startX,
        startY,
        endX,
        endY,
        fiber.width,
        paperParams,
        random,
        1
      );

      ctx.fillStyle = `rgb(${fiber.gray}, ${fiber.gray}, ${fiber.gray})`;
      ctx.fill(fiberPath);

      // Micro fibers with natural variation
      if (fiber.hasMicroFibers) {
        for (const micro of fiber.microDetails) {
          const microEndX =
            (fiber.x + Math.cos(micro.angle) * micro.length) * dpiScale;
          const microEndY =
            (fiber.y + Math.sin(micro.angle) * micro.length) * dpiScale;

          const microPath = createVariableWidthLine(
            startX,
            startY,
            microEndX,
            microEndY,
            fiber.width * 0.3,
            paperParams,
            random,
            1
          );

          ctx.fillStyle = `rgb(${micro.gray}, ${micro.gray}, ${micro.gray})`;
          ctx.fill(microPath);
        }
      }
    }
  }
}

// Render Japanese fiber from plan
function renderJapaneseFiberFromPlan(
  ctx: CanvasRenderingContext2D,
  plan: JapanesePaperFiberPlan,
  dpiScale: number,
  paperParams: PaperType,
  random: SeededRandom
): void {
  // Render branches with natural variation
  for (const branch of plan.branches) {
    // Main branch
    const mainBranchPath = createVariableWidthLine(
      branch.start[0] * dpiScale,
      branch.start[1] * dpiScale,
      branch.end[0] * dpiScale,
      branch.end[1] * dpiScale,
      branch.width,
      paperParams,
      random,
      1
    );

    ctx.fillStyle = `rgb(${branch.gray}, ${branch.gray}, ${branch.gray})`;
    ctx.fill(mainBranchPath);

    // Sub branch if exists
    if (branch.subBranch) {
      const subBranchPath = createVariableWidthLine(
        branch.subBranch.start[0] * dpiScale,
        branch.subBranch.start[1] * dpiScale,
        branch.subBranch.end[0] * dpiScale,
        branch.subBranch.end[1] * dpiScale,
        branch.subBranch.width,
        paperParams,
        random,
        1
      );

      ctx.fillStyle = `rgb(${branch.subBranch.gray}, ${branch.subBranch.gray}, ${branch.subBranch.gray})`;
      ctx.fill(subBranchPath);
    }
  }

  // Render main path with natural flowing curves
  if (plan.mainPath.length >= 2) {
    const scaledPath: [number, number][] = plan.mainPath.map(([x, y]) => [
      x * dpiScale,
      y * dpiScale,
    ]);

    const mainPath = createJapaneseBranchPath(
      scaledPath,
      plan.baseWidth,
      paperParams,
      random,
      1
    );

    ctx.fillStyle = `rgb(${plan.finalGray}, ${plan.finalGray}, ${plan.finalGray})`;
    ctx.fill(mainPath);
  }
}

// Add coating layer
function addCoating(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: PaperType
): void {
  if (params.coating > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${params.coating * 0.2})`;
    ctx.fillRect(0, 0, width, height);
  }
}
