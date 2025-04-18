import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../plugin.ts";
import { definePlugin } from "../plugin.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";
import { createTranslator } from "../ui/locale.ts";

const t = createTranslator({
  en: {
    title: "Glitch Effect V1",
    intensity: "Intensity",
    slices: "Slices",
    colorShift: "Color Shift",
    angle: "Angle",
    bias: "Direction Bias",
    seed: "Seed",
    reset: "Reset",
  },
  ja: {
    title: "グリッチエフェクト V1",
    intensity: "強度",
    slices: "スライス数",
    colorShift: "色シフト",
    angle: "角度",
    bias: "散布の寄り",
    seed: "シード値",
    reset: "リセット",
  },
});

export const glitch = definePlugin({
  id: "glitch-effect-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
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
        default: 1,
      },
      angle: {
        type: "real",
        default: 0.0,
      },
      bias: {
        type: "real",
        default: 0.0,
      },
      seed: {
        type: "int",
        default: Math.floor(Math.random() * 10000),
      },
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onEditParameters: (params) => {
      params.intensity = Math.max(0, Math.min(1, params.intensity));
      params.colorShift = Math.max(0, Math.min(1, params.colorShift));
      params.angle = Math.max(-1, Math.min(1, params.angle));
      params.bias = Math.max(-1, Math.min(1, params.bias));
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return params;
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t),
        slices: Math.round(lerp(paramsA.slices, paramsB.slices, t)),
        angle: lerp(paramsA.angle, paramsB.angle, t),
        bias: lerp(paramsA.bias, paramsB.bias, t),
        seed: paramsA.seed, // シード値は補間しない
      };
    },

    renderUI: (params, { setParam }) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("intensity") }),
          ui.slider({ key: "intensity", dataType: "float", min: 0, max: 1, value: params.intensity }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("slices") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "slices", dataType: "int", min: 1, max: 400, value: params.slices }),
            ui.numberInput({ dataType: "int", key: "slices", value: params.slices, min: 1, max: 400, step: 1 }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "colorShift", dataType: "float", min: 0, max: 100, value: params.colorShift }),
            ui.numberInput({ dataType: "float", key: "colorShift", value: params.colorShift, min: 0, max: 1, step: 0.01 }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("angle") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "angle", dataType: "float", min: -1, max: 1, value: params.angle }),
            ui.numberInput({ dataType: "float", key: "angle", value: params.angle, min: -1, max: 1, step: 0.01 }),
          ]),
          ui.button({ text: t("reset"), onClick: () => { setParam({ angle: 0 }) } }),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("bias") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "bias", dataType: "float", min: -1, max: 1, value: params.bias }),
            ui.numberInput({ dataType: "float", key: "bias", value: params.bias, min: -1, max: 1, step: 0.01 }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "seed", dataType: "int", min: 0, max: 10000, value: params.seed }),
            ui.numberInput({ dataType: "int", key: "seed", value: params.seed, min: 0, max: 10000, step: 1 }),
          ]),
        ]),
      ]);
    },

    initLiveEffect: async () => {
      return await createGPUDevice({}, (device) => {
        const code = `
          struct Params {
            intensity: f32,
            colorShift: f32,
            slices: f32,
            angle: f32,
            bias: f32,
            seed: f32,
            dpi: i32,
            baseDpi: i32,
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
              // 角度に基づいて斜めのスライスを計算
              let angle = params.angle * 3.14159;

              // xとyの座標を角度に基づいて回転させた座標でスライスを決定
              let sliceCoord = texCoord.x * sin(angle) + texCoord.y * cos(angle);
              let sliceIndex = floor(sliceCoord * params.slices);

              let seed = params.seed;
              let random = fract(sin(sliceIndex * 43758.5453 + seed) * 43758.5453);

              if (random < params.intensity) {
                let shift = (random - 0.5 + params.bias * 0.5) * params.intensity;

                // シフト方向も角度に垂直な方向に
                let shiftAngle = angle;
                let xShift = shift * cos(shiftAngle);
                let yShift = shift * sin(shiftAngle);

                shiftedCoord.x = clamp(texCoord.x + xShift, 0.0, 1.0);
                shiftedCoord.y = clamp(texCoord.y + yShift, 0.0, 1.0);
              }
            }

            let rOffset = params.colorShift;

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
        `;

        const shader = device.createShaderModule({
          code,
        });

        const defs = makeShaderDataDefinitions(code);

        const pipeline = device.createComputePipeline({
          compute: {
            module: shader,
            entryPoint: "computeMain",
          },
          layout: "auto",
        });

        return { pipeline, defs };
      });
    },

    goLiveEffect: async ({ device, pipeline, defs }, params, imgData, env) => {
      imgData = await paddingImageData(
        imgData,
        params.colorShift + params.bias
      );
      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);
      const inputWidth = imgData.width;
      const inputHeight = imgData.height;

      const uniformValues = makeStructuredView(defs.uniforms.params);

      const texture = device.createTexture({
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      const resultTexture = device.createTexture({
        size: [inputWidth, inputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
      });

      const sampler = device.createSampler({
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      const uniformBuffer = device.createBuffer({
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        intensity: params.intensity,
        colorShift: params.colorShift / 100,
        slices: Math.max(1, params.slices),
        angle: params.angle,
        bias: params.bias,
        seed: params.seed,
        dpi: env.dpi,
        baseDpi: env.baseDpi,
      });

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView() },
          { binding: 1, resource: resultTexture.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: uniformBuffer } },
        ],
      });

      const stagingBuffer = device.createBuffer({
        size: inputWidth * inputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      const commandEncoder = device.createCommandEncoder();

      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);

      const workgroupsX = Math.ceil(inputWidth / 16);
      const workgroupsY = Math.ceil(inputHeight / 16);

      computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
      computePass.end();

      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: inputWidth * 4 },
        [inputWidth, inputHeight]
      );

      const commandBuffer = commandEncoder.finish();
      device.queue.submit([commandBuffer]);

      await stagingBuffer.mapAsync(GPUMapMode.READ);

      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));

      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );

      const finalImage = await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );

      return finalImage;
    },
  },
});
