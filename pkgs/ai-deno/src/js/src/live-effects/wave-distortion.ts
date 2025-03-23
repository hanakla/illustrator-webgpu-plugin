import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../types.ts";
import { definePlugin, ColorRGBA } from "../types.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

// Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Wave Distortion",
    amplitude: "Amplitude",
    frequency: "Frequency",
    angle: "Angle",
    presets: "Presets",
    horizontal: "Horizontal",
    vertical: "Vertical",
    diagonal: "Diagonal",
    crossWave: "Cross Wave",
    time: "Time",
  },
  ja: {
    title: "ウェーブ ディストーション",
    amplitude: "振幅",
    frequency: "周波数",
    angle: "角度",
    presets: "プリセット",
    horizontal: "水平",
    vertical: "垂直",
    diagonal: "斜め",
    crossWave: "交差波",
    time: "時間",
  },
});

export const waveDistortion = definePlugin({
  id: "wave-distortion-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      amplitude: {
        type: "real",
        default: 50.0,
      },
      frequency: {
        type: "real",
        default: 5.0,
      },
      angleValue: {
        type: "real",
        default: 0.0,
      },
      crossWave: {
        type: "boolean",
        default: false,
      },
      time: {
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
        amplitude: params.amplitude * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        amplitude: lerp(paramsA.amplitude, paramsB.amplitude, t),
        frequency: lerp(paramsA.frequency, paramsB.frequency, t),
        angleValue: lerp(paramsA.angleValue, paramsB.angleValue, t),
        crossWave: t < 0.5 ? paramsA.crossWave : paramsB.crossWave,
        time: lerp(paramsA.time, paramsB.time, t),
      };
    },

    renderUI: (params, setParam) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("amplitude") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "amplitude", dataType: 'float', min: 0, max: 300, value: params.amplitude }),
            ui.numberInput({ key: "amplitude", dataType: 'float', value: params.amplitude }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("frequency") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "frequency", dataType: 'float', min: 0.1, max: 100, value: params.frequency }),
            ui.numberInput({ key: "frequency", dataType: 'float', value: params.frequency }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "angleValue", dataType: 'float', min: 0, max: 360, value: params.angleValue }),
            ui.numberInput({ key: "angleValue", dataType: 'float', value: params.angleValue }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("presets") }),
          ui.group({ direction: "row" }, [
            ui.button({ text: t("horizontal"), onClick: () => setParam({ angleValue: 0 }) }),
            ui.button({ text: t("vertical"), onClick: () => setParam({ angleValue: 90 }) }),
            ui.button({ text: t("diagonal"), onClick: () => setParam({ angleValue: 45 }) }),
          ]),
        ]),
        ui.group({ direction: "row" }, [
          ui.checkbox({ key: "crossWave", value: params.crossWave }),
          ui.text({ text: t("crossWave") }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("time") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "time", dataType: 'float', min: 0, max: 100, value: params.time }),
            ui.numberInput({ key: "time", dataType: 'float', value: params.time }),
          ]),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Wave Distortion)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2f,
              dpiScale: f32,
              amplitude: f32,
              frequency: f32,
              angleRad: f32,
              crossWave: f32,
              time: f32,
              paddingSize: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            fn rotate2DAroundOrigin(coord: vec2f, angle: f32) -> vec2f {
              let sinVal = sin(angle);
              let cosVal = cos(angle);

              return vec2f(
                coord.x * cosVal - coord.y * sinVal,
                coord.x * sinVal + coord.y * cosVal
              );
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let adjustedDims = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / adjustedDims;

              // DPIスケーリング: 入力DPIとベースDPI（基準値）の比率
              let dpiScale = params.dpiScale;

              // 振幅パラメータにDPIスケールを適用
              let pixelNorm = vec2f(1.0) / dims;
              let amplitudeNorm = pixelNorm * vec2f(params.amplitude * dpiScale);

              let frequency = params.frequency * 3.14159;

              // Normalize coordinates to center
              let centerCoord = texCoord * 2.0 - 1.0;

              // Calculate main wave based on angle
              let rotatedCoord = rotate2DAroundOrigin(centerCoord, params.angleRad);

              // 波の位相を計算
              let wavePhase = rotatedCoord.x * frequency;
              let crossWavePhase = rotatedCoord.y * frequency;

              // ピクセル単位の振幅を計算し、正規化座標系に変換して適用
              let distortion = sin(wavePhase + params.time * 0.1) * amplitudeNorm.y;
              let distortedY = rotatedCoord.y + distortion;

              // クロス波でも同様に正規化して適用
              let crossDistortion = sin(crossWavePhase + params.time * 0.1) * amplitudeNorm.x * params.crossWave;
              let distortedX = rotatedCoord.x + crossDistortion;

              // Create distorted coordinate
              let distortedCoord = vec2f(distortedX, distortedY);

              // Rotate back to original orientation
              let finalRotatedCoord = rotate2DAroundOrigin(distortedCoord, -params.angleRad);

              // Convert back to texture coordinates
              let finalCoord = (finalRotatedCoord + 1.0) * 0.5;

              // Clamp coordinates to prevent sampling outside texture bounds
              let clampedCoord = clamp(finalCoord, vec2f(0.0), vec2f(1.0));

              // Sample the texture with the distorted coordinates
              let finalColor = textureSampleLevel(inputTexture, textureSampler, clampedCoord * toInputTexCoord, 0.0);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Wave Distortion Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Wave Distortion Pipeline",
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
      console.log("Wave Distortion", params);

      const dpiScale = dpi / baseDpi;

      const sourceWidth = imgData.width;
      const sourceHeight = imgData.height;

      // パディングサイズを計算（共通化）
      const paddingSize = Math.ceil((params.amplitude / 2) * dpiScale);

      imgData = await paddingImageData(imgData, paddingSize);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Don't change it
      imgData = await addWebGPUAlignmentPadding(imgData);

      const inputWidth = imgData.width,
        inputHeight = imgData.height;

      // Create textures
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
        magFilter: "linear",
        minFilter: "linear",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Convert angle from degrees to radians
      const angleRad = (params.angleValue * Math.PI) / 180.0;

      // 基準となるDPIでの画像サイズを計算
      // 基準DPI (72dpi)に対する現在のDPI比率
      const dpiRatio = baseDpi / 72;
      // 72dpiでの理論上のサイズ（元画像が72dpiだった場合の想定サイズ）
      const referenceWidth = sourceWidth / dpiRatio;
      const referenceHeight = sourceHeight / dpiRatio;

      // Set uniform values
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale,
        sourceSize: [referenceWidth, referenceHeight],
        amplitude: params.amplitude,
        frequency: params.frequency,
        angleRad: angleRad,
        crossWave: params.crossWave ? 1.0 : 0.0,
        time: params.time,
        paddingSize: paddingSize + (inputWidth - outputWidth) / 2,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

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

      const stagingBuffer = device.createBuffer({
        label: "Staging Buffer",
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Wave Distortion Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Wave Distortion Compute Pass",
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

      // Read back and display the result
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
