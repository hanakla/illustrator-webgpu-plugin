import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./utils.ts";

export const glitch = definePlugin({
  id: "glitch-effect-v1",
  title: "Glitch Effect V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 0.5,
      },
      slices: {
        type: "int",
        default: 20,
      },
      colorShift: {
        type: "real",
        default: 0.3,
      },
    },
    editLiveEffectParameters: (params) => {
      params.intensity = Math.max(0, Math.min(1, params.intensity));
      params.colorShift = Math.max(0, Math.min(1, params.colorShift));
      return params;
    },
    liveEffectScaleParameters(params, scaleFactor) {
      return params;
    },
    liveEffectInterpolate: (paramsA, paramsB, t) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t),
      };
    },

    renderUI: (params) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: "Intensity" }),
          ui.slider({
            key: "intensity",
            label: "Intensity",
            dataType: "float",
            min: 0,
            max: 1,
            value: params.intensity,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Slices" }),
          ui.slider({
            key: "slices",
            label: "Slices",
            dataType: "int",
            min: 1,
            max: 100,
            value: params.slices,
          }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: "Color Shift" }),
          ui.slider({
            key: "colorShift",
            label: "Color Shift",
            dataType: "float",
            min: 0,
            max: 1,
            value: params.colorShift,
          }),
        ]),
      ]);
    },

    initLiveEffect: async () => {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("WebGPU adapter not available");
      }

      const device = await adapter.requestDevice();

      const shader = device.createShaderModule({
        code: `
          struct Params {
            intensity: f32,
            colorShift: f32,
            slices: i32,
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
            let dims = textureDimensions(inputTexture);
            if (id.x >= dims.x || id.y >= dims.y) {
              return;
            }

            let texCoord = vec2f(id.xy) / vec2f(dims);
            var outColor: vec4f;

            var shiftedCoord = texCoord;

            if (params.intensity > 0.0) {
              let sliceY = floor(texCoord.y * 20.0);
              let random = fract(sin(sliceY * 43758.5453) * 43758.5453);

              if (random < params.intensity) {
                let shift = (random - 0.5) * params.intensity * 0.2;
                shiftedCoord.x = clamp(texCoord.x + shift, 0.0, 1.0);
              }
            }

            let rOffset = params.colorShift * 0.05;

            let rCoord = clamp(vec2f(shiftedCoord.x + rOffset, shiftedCoord.y), vec2f(0.0), vec2f(1.0));
            let gCoord = shiftedCoord;
            let bCoord = clamp(vec2f(shiftedCoord.x - rOffset, shiftedCoord.y), vec2f(0.0), vec2f(1.0));

            let rC = textureSampleLevel(inputTexture, textureSampler, rCoord, 0.0);
            let gC = textureSampleLevel(inputTexture, textureSampler, gCoord, 0.0);
            let bC = textureSampleLevel(inputTexture, textureSampler, bCoord, 0.0);

            let a = (rC.a + gC.a + bC.a) / 3.0;

            outColor = vec4f(rC.r, gC.g, bC.b, a);

            textureStore(resultTexture, id.xy, outColor);
          }
        `,
      });

      const pipeline = device.createComputePipeline({
        compute: {
          module: shader,
          entryPoint: "computeMain",
        },
        layout: "auto",
      });

      return { device, pipeline };
    },

    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
      // 元のサイズを保存
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      // WebGPU alignment padding
      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width;
      const inputHeight = imgData.height;

      // 入力テクスチャ
      const texture = device.createTexture({
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      // 出力テクスチャ
      const resultTexture = device.createTexture({
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
      });

      // サンプラー
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      // パラメータバッファ
      const uniformBuffer = device.createBuffer({
        size: 16, // 3つのf32値 + パディング = 16バイト
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // パラメータデータ
      const uniformData = new Float32Array([
        params.intensity,
        params.colorShift,
        params.slices,
        0.0, // パディング
      ]);

      // バインドグループ
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView() },
          { binding: 1, resource: resultTexture.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: uniformBuffer } },
        ],
      });

      // ステージングバッファ (結果読み取り用)
      const stagingBuffer = device.createBuffer({
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // パラメータをGPUに転送
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // 画像データをテクスチャに転送
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      // コマンドエンコーダ
      const commandEncoder = device.createCommandEncoder();

      // コンピュートパス
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);

      const workgroupsX = Math.ceil(inputWidth / 16);
      const workgroupsY = Math.ceil(inputHeight / 16);

      computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
      computePass.end();

      // 結果のコピー
      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );

      // コマンドの実行
      const commandBuffer = commandEncoder.finish();
      device.queue.submit([commandBuffer]);

      // 結果の読み出し
      await stagingBuffer.mapAsync(GPUMapMode.READ);

      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));

      stagingBuffer.unmap();

      // 結果の画像データ作成
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );

      // パディングを取り除く
      const finalImage = await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );

      return finalImage;
    },
  },
});
