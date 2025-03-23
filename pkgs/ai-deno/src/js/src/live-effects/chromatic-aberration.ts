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
      strength: "Strength",
      angle: "Angle",
      opacity: "Opacity",
      blendMode: "Blend Mode",
      blendOver: "Over",
      blendeUnder: "Under",
      debuggingParameters: "Debugging parameters",
      padding: "Padding",
      pastelMode: "Pastel",
    },
    ja: {
      title: "色収差 V1",
      colorMode: "カラーモード",
      strength: "強度",
      angle: "角度",
      opacity: "不透明度",
      blendMode: "ブレンドモード",
      blendOver: "上に合成",
      blendeUnder: "下に合成",
      debuggingParameters: "デバッグパラメータ",
      padding: "パディング",
      pastelMode: "パステル",
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
        enum: ["rgb", "cmyk", "pastel"],
        default: "rgb",
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
    },
    onEditParameters: (params) => params,
    onAdjustColors: (params, adjustColor) => params,
    onInterpolate: (params, paramsB, progress) => ({
      colorMode: params.colorMode,
      strength: lerp(params.strength, paramsB.strength, progress),
      angle: lerp(params.angle, paramsB.angle, progress),
      opacity: lerp(params.opacity, paramsB.opacity, progress),
      blendMode: params.blendMode,
    }),
    onScaleParams: (params, scale) => ({
      colorMode: params.colorMode,
      strength: params.strength * scale,
      angle: params.angle,
      opacity: params.opacity,
      blendMode: params.blendMode,
    }),
    renderUI: (params) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorMode") }),
          ui.select({ key: "colorMode", value: params.colorMode, options: [
            {value: 'rgb', label: "RGB"},
            {value: 'cmyk', label: "CMYK"},
            {value: 'pastel', label: t("pastelMode")},
          ] }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.slider({ key: "strength", dataType: 'float', min: 0, max: 200, value: params.strength }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("angle") }),
          ui.slider({ key: "angle", dataType: 'float', min: 0, max: 360, value: params.angle }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("opacity")}),
          ui.slider({ key: "opacity", dataType: 'float', min: 0, max: 100, value: params.opacity }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Blend Mode"}),
          ui.select({ key: "blendMode", value: params.blendMode, options: [
            {value: 'over', label: t("blendOver")},
            {value: 'under', label: t('blendeUnder')}
          ]}),
        ]),

        // ui.separator(),

        // ui.group({ direction: "col" }, [
        //   ui.text({ text: "Debugging parameters" }),
        //   ui.slider({ key: "padding", label: "Padding", dataType: 'int', min: 0, max: 200, value: params.padding }),
        // ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice({}, async (device) => {
        const code = `
          struct Params {
            dpi: f32,
            baseDpi: f32,
            strength: f32,
            angle: f32,
            colorMode: u32,  // 0: RGB, 1: CMYK, 2: Pastel
            opacity: f32,
            blendMode: u32,  // 0: over, 1: under
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
              let pastelPink = vec3f(min(r * 1.2, 1.0), r * 0.6, r * 0.8);

              // G -> パステルイエロー (緑+赤)
              let pastelYellow = vec3f(g * 0.8, min(g * 1.2, 1.0), g * 0.2);

              // B -> パステルシアン (青+緑)
              let pastelCyan = vec3f(b * 0.2, b * 0.8, min(b * 1.2, 1.0));

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

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // strengthをピクセル単位として処理し、テクスチャ座標に変換
              let pixelOffset = getOffset(params.angle) * params.strength * (params.dpi / params.baseDpi);
              let texOffset = pixelOffset / dims;

              var effectColor: vec4f;
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              if (params.colorMode == 0u) { // RGB mode
                  let redOffset = texCoord + texOffset;
                  let blueOffset = texCoord - texOffset;

                  let redSample = textureSampleLevel(inputTexture, textureSampler, redOffset, 0.0);
                  let greenSample = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);
                  let blueSample = textureSampleLevel(inputTexture, textureSampler, blueOffset, 0.0);

                  let r = redSample.r;
                  let g = greenSample.g;
                  let b = blueSample.b;

                  let a_red = redSample.a;
                  let a_green = greenSample.a;
                  let a_blue = blueSample.a;

                  let a = screenBlend(screenBlend(a_red, a_green), a_blue);

                  effectColor = vec4f(r, g, b, a);
              }               else if (params.colorMode == 1u) { // CMYK mode
                  // オフセットを計算（元のオフセット計算を使用）
                  let cyanOffset = texCoord + texOffset;
                  let magentaOffset = texCoord + vec2f(-texOffset.y, texOffset.x) * 0.866;
                  let yellowOffset = texCoord - texOffset;

                  // 各色のサンプリング
                  let cyanSample = textureSampleLevel(inputTexture, textureSampler, cyanOffset, 0.0);
                  let magentaSample = textureSampleLevel(inputTexture, textureSampler, magentaOffset, 0.0);
                  let yellowSample = textureSampleLevel(inputTexture, textureSampler, yellowOffset, 0.0);
                  let originalSample = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

                  // より鮮やかな色分解（各チャンネルの強調）
                  // シアン(青緑)：赤を抑制し、青と緑を強調
                  let cyanColor = vec3f(
                      cyanSample.r * 0.3,    // 赤を抑制
                      cyanSample.g * 1.1,    // 緑を強調
                      cyanSample.b * 1.1     // 青を強調
                  );

                  // マゼンタ(赤紫)：緑を抑制し、赤と青を強調
                  let magentaColor = vec3f(
                      magentaSample.r * 1.1,  // 赤を強調
                      magentaSample.g * 0.3,  // 緑を抑制
                      magentaSample.b * 1.1   // 青を強調
                  );

                  // イエロー(黄)：青を抑制し、赤と緑を強調
                  let yellowColor = vec3f(
                      yellowSample.r * 1.1,   // 赤を強調
                      yellowSample.g * 1.1,   // 緑を強調
                      yellowSample.b * 0.3    // 青を抑制
                  );

                  // 各色を合成
                  let combinedColor = vec3f(
                      max(max(cyanColor.r, magentaColor.r), yellowColor.r),
                      max(max(cyanColor.g, magentaColor.g), yellowColor.g),
                      max(max(cyanColor.b, magentaColor.b), yellowColor.b)
                  );

                  // アルファ値の計算（他のモードと同様に各サンプルのアルファをブレンド）
                  let a_cyan = cyanSample.a;
                  let a_magenta = magentaSample.a;
                  let a_yellow = yellowSample.a;
                  let a = screenBlend(screenBlend(a_cyan, a_magenta), a_yellow);

                  // 強度0でも元の色を保持
                  let strengthFactor = params.strength / 5.0;  // 強度の効果を調整
                  let blendRatio = clamp(strengthFactor, 0.0, 1.0);
                  let result = mix(originalSample.rgb, combinedColor, blendRatio);

                  effectColor = vec4f(result, a);

                  effectColor = vec4f(result, a);
              } else { // Pastel mode (2u)
                  // 元のサンプルを取得
                  let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

                  // RGB色収差と同様に、各チャンネルをずらしてサンプリング
                  let redOffset = texCoord + texOffset;
                  let greenOffset = texCoord;
                  let blueOffset = texCoord - texOffset;

                  let redSample = textureSampleLevel(inputTexture, textureSampler, redOffset, 0.0);
                  let greenSample = textureSampleLevel(inputTexture, textureSampler, greenOffset, 0.0);
                  let blueSample = textureSampleLevel(inputTexture, textureSampler, blueOffset, 0.0);

                  // 各サンプルから対応するRGBチャンネルを抽出
                  let r = redSample.r;
                  let g = greenSample.g;
                  let b = blueSample.b;

                  // 各チャンネルを単独のパステルカラーに変換
                  let pastelColor = rgbChannelToPastel(r, g, b);

                  // チャンネルの重なり具合を検出
                  let overlapFactor = detectChannelOverlap(r, g, b);

                  // 重なっている部分(overlapFactor=1.0)では元画像の色を使用
                  // そうでない部分ではパステルカラーを使用
                  // let result = mix(pastelColor, originalColor.rgb, overlapFactor);
                  let result = pastelColor;

                  // アルファ値の計算
                  let a_red = redSample.a;
                  let a_green = greenSample.a;
                  let a_blue = blueSample.a;
                  let a = screenBlend(screenBlend(a_red, a_green), a_blue);

                  effectColor = vec4f(result, a);
              }

              var finalColor: vec4f;
              if (params.blendMode == 0u) {
                  finalColor = mix(originalColor, effectColor, params.opacity / 100.0);
              } else {
                  finalColor = mix(effectColor, originalColor, 1.0 - params.opacity / 100.0);
              }

              textureStore(resultTexture, id.xy, finalColor);
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
        magFilter: "linear",
        minFilter: "linear",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(defs.uniforms.params);

      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // カラーモードのマッピング: rgb=0, cmyk=1, pastel=2
      let colorModeValue = 0;
      if (params.colorMode === "cmyk") {
        colorModeValue = 1;
      } else if (params.colorMode === "pastel") {
        colorModeValue = 2;
      }

      uniformValues.set({
        dpi: env.dpi,
        baseDpi: env.baseDpi,
        strength: params.strength,
        angle: params.angle,
        colorMode: colorModeValue,
        opacity: params.opacity,
        blendMode: params.blendMode === "over" ? 0 : 1,
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

      // const png = await toPng(resultImageData);
      // Deno.writeFile(
      //   "chromatic-aberration-out.png",
      //   new Uint8Array(await png.arrayBuffer())
      // );

      return resultImageData;
    },
  },
});
