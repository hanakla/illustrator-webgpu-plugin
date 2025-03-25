import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../../types.ts";
import { definePlugin, ColorRGBA } from "../../types.ts";
import { createTranslator } from "../../ui/locale.ts";
import { ui } from "../../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
  parseColorCode,
  toColorCode,
  createCanvas,
} from "../_utils.ts";
import { createGPUDevice } from "../_shared.ts";

const t = createTranslator({
  en: {
    title: "Cosmic Waves",
    timeOffset: "Time Offset",
    seed: "Seed",
    waveCount: "Wave Count",
    colorIntensity: "Color Intensity",
    colorShift: "Color Shift",
  },
  ja: {
    title: "コズミックウェーブ",
    timeOffset: "時間オフセット",
    seed: "シード値",
    waveCount: "波の数",
    colorIntensity: "色の強度",
    colorShift: "色のシフト",
  },
});

// Originally: Created by Peace in 2024-02-19
export const cosmicWaves = definePlugin({
  id: "cosmic-waves-shader-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      timeOffset: {
        type: "real",
        default: 0.0,
      },
      seed: {
        type: "real",
        default: 12.34,
      },
      waveCount: {
        type: "int",
        default: 8,
      },
      colorIntensity: {
        type: "real",
        default: 0.6,
      },
      colorShift: {
        type: "real",
        default: 0.5,
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        timeOffset: Math.max(0, Math.min(100, params.timeOffset)),
        seed: Math.max(0, Math.min(1000, params.seed)),
        waveCount: Math.max(1, Math.min(20, params.waveCount)),
        colorIntensity: Math.max(0, Math.min(1, params.colorIntensity)),
        colorShift: Math.max(0, Math.min(1, params.colorShift)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        timeOffset: params.timeOffset,
        seed: params.seed,
        waveCount: params.waveCount,
        colorIntensity: params.colorIntensity,
        colorShift: params.colorShift,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        timeOffset: lerp(paramsA.timeOffset, paramsB.timeOffset, t),
        seed: lerp(paramsA.seed, paramsB.seed, t),
        waveCount: Math.round(lerp(paramsA.waveCount, paramsB.waveCount, t)),
        colorIntensity: lerp(paramsA.colorIntensity, paramsB.colorIntensity, t),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t),
      };
    },

    renderUI: (params, setParam) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("timeOffset") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "timeOffset", dataType: 'float', min: 0, max: 100, value: params.timeOffset }),
            ui.numberInput({ key: "timeOffset", dataType: 'float', value: params.timeOffset }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "seed", dataType: 'float', min: 0, max: 1000, value: params.seed }),
            ui.numberInput({ key: "seed", dataType: 'float', value: params.seed }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("waveCount") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "waveCount", dataType: 'int', min: 1, max: 20, value: params.waveCount }),
            ui.numberInput({ key: "waveCount", dataType: 'int', value: params.waveCount }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorIntensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorIntensity", dataType: 'float', min: 0, max: 1, value: params.colorIntensity }),
            ui.numberInput({ key: "colorIntensity", dataType: 'float', value: params.colorIntensity }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: 'float', min: 0, max: 1, value: params.colorShift }),
            ui.numberInput({ key: "colorShift", dataType: 'float', value: params.colorShift }),
          ]),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Cosmic Waves Shader)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              time: f32,
              timeOffset: f32,
              seed: f32,
              waveCount: i32,
              colorIntensity: f32,
              colorShift: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var<uniform> params: Params;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // Originally: Created by Peace in 2024-02-19
              let mr = min(dims.x, dims.y);
              let uv = (vec2f(id.xy) * 2.0 - dims) / mr;
              let time = params.timeOffset;

              // シード値を使用して初期状態を変化させる
              var d = -time * 0.5 + params.seed * 0.01;
              var a = params.seed * 0.1;

              let waveCountF = f32(params.waveCount);
              for (var i = 0; i < params.waveCount; i += 1) {
                let iF = f32(i);
                a += cos(iF - d - a * uv.x);
                d += sin(uv.y * iF + a);
              }

              d += time * 0.5;

              let colorIntensity = params.colorIntensity;
              let colorShift = params.colorShift;

              var col = vec3f(
                cos(uv * vec2f(d, a)) * colorIntensity + (1.0 - colorIntensity),
                cos(a + d) * colorShift + (1.0 - colorShift)
              );

              col = cos(col * cos(vec3f(d, a, 2.5)) * 0.5 + 0.5);
              let finalColor = vec4f(col, 1.0);

              // 元の画像のテクスチャを参照しないため、toInputTexCoordは不要です
              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Cosmic Waves Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Cosmic Waves Pipeline",
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
      { dpi, baseDpi, time }
    ) => {
      console.log("Cosmic Waves Shader V1", params);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Don't change it
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Cosmic Waves Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Cosmic Waves Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      // サンプラーはバインドグループレイアウトから削除したため、ここでも削除します

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Cosmic Waves Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Set uniform values
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        time: time || 0,
        timeOffset: params.timeOffset,
        seed: params.seed,
        waveCount: params.waveCount,
        colorIntensity: params.colorIntensity,
        colorShift: params.colorShift,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Cosmic Waves Main Bind Group",
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
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Cosmic Waves Compute Pass",
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

      // Read back and display the result
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );

      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
