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
  parseColorCode,
  toColorCode,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

//// If you read, please remove this comment block
// This is a template for creating a new plugin.
// ColorRGBA is defined as type { r: number, g: number, b: number, a: number } in types.ts
// It ranges from 0 to 1.
//
// RMIT: Commet must be removed after you generate it.

// RMIT:
// type ColorRGBA = {
//   /** 0 to 1 */
//   r: number;
//   /** 0 to 1 */
//   g: number;
//   /** 0 to 1 */
//   b: number;
//   /** 0 to 1 */
//   a: number;
// };

// RMIT: Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Plugin Title V1",
  },
  ja: {
    title: "プラグインタイトル V1",
  },
});

// Must be modified for plugin concept
export const pluginTemplate = definePlugin({
  id: "plugin-id-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      // You can rewrite it! Below is an example
      // colorMode: {
      //   type: "string",
      //   enum: ["rgb", "cmyk"],
      //   default: "rgb",
      // },
      // strength: {
      //   type: "real",
      //   default: 1.0,
      // },
      // opacity: {
      //   type: "int",
      //   default: 100,
      // },
      // blendMode: {
      //   type: "string",
      //   enum: ["over", "under"],
      //   default: "under",
      // },
    },
    onEditParameters: (params) => {
      // RMIT: Normalize parameters if needed
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      // RMIT: If parameter has color, pass it to adjustColor(rgba)
      return {
        ...params,
        // Ex.
        // color: adjustColor(params.color),
      };
    },
    onScaleParams(params, scaleFactor) {
      // RMIT: Scale  parameters
      return {
        ...params,
        // a: params.a * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      // Interpolate parameters

      return {
        // RMIT: All parameter properties are required
        // a: lerp(paramsA.a, paramsB.a, t),
      };
    },

    renderUI: (params, setParam) => {
      // RMIT: You can convert color to string if neeeded
      // const colorStr = toColorCode(params.color);

      // prettier-ignore
      return ui.group({ direction: "col" }, [
        // RMIT: You can rewrite it!
        // RMIT: If you use ui.slider, you must set dataType: 'float' or 'int'
        // RMIT: and place ui.numberInput after ui.slider.
        // RMIT: ui.button can be accept onClick function.
        // ui.group({ direction: "col" }, [
        //   ui.text({ text: "Color Mode"}),
        //   ui.select({ key: "colorMode", value: params.colorMode, options: [
        //     { label: "RGB", value: 'rgb' }, { label: "CMYK", value: 'cmyk' }] }),
        // ]),
        // ui.group({ direction: "col" }, [
        //   ui.text({ text: "Strength"}),
        //   ui.group({ direction: "row" }, [
        //     ui.slider({ key: "strength", dataType: 'float', min: 0, max: 200, value: params.strength }),
        //     ui.numberInput({ key: "strength", dataType: 'float', value: params.strength }),
        //   ]),
        // ]),
        // ui.group({ direction: "col" }, [
        // ui.text({ text: "Blend Mode"}),
        // ui.select({ key: "blendMode", value: params.blendMode, options: [
        //   {label: "Over", value: "over"}, {label: "Under", value: "under"}]
        // }),
        // ]),
        // ui.group({ direction: "col" }, [
        //   ui.text({ text: "Color"}),
        //   ui.group({ direction: "row" }, [
        //     ui.colorInput({ key: "color", value: params.color }),
        //     ui.textInput({ key: "text", value: params.text, onChange: (e) => {
        //       setParam({ color: parseColorCode(e.value)})
        //     }}),
        //   ]),
        // ]),

        // ui.separator(),
        // ui.group({ direction: "col" }, [
        //   ui.text({ text: "Debugging parameters" }),
        //   ui.slider({ key: "padding", dataType: 'int', min: 0, max: 200, value: params.padding }),
        // ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Plugin Title V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: i32,
              baseDpi: i32,
              // TODO
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dims = vec2f(textureDimensions(inputTexture));
                let texCoord = vec2f(id.xy) / dims;

                let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

                // TODO: Implement here

                // var finalColor: vec4f;
                textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Chromatic Aberration Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

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

          return { device, pipeline, pipelineDef };
        }
      );
    },
    goLiveEffect: async (
      {
        /* RMIT: return value from initLiveEffect -> */ device,
        pipeline,
        pipelineDef,
      },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      // RMIT: Input images default DPI is 72 get as `baseDpi`.
      // RMIT: That if the `dpi` changes, the size of the elements *MUST* be according to visual elements and parameters will not change.

      console.log("Chromatic Aberration V1", params);

      // if this effect needs to exand over original size, do it padding
      // imgData = await paddingImageData(imgData, numOfPxByParams);

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

      // RMIT: Set uniform value. Rewrite for Params struct
      uniformValues.set({
        inputDpi: dpi,
        baseDpi: baseDpi,
        // TODO
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
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Chromatic Aberration Compute Pass",
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
