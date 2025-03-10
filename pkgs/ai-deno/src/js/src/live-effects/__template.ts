import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./utils.ts";

export const pluginTemplate = definePlugin({
  id: "plugin-id-v1",
  title: "Plugin Title V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      main: StyleFilterFlag.kPostEffectFilter,
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
    editLiveEffectParameters: (params) => {
      // Normalize parameters if needed
      return params;
    },
    liveEffectScaleParameters(params, scaleFactor) {
      // Scale parameters
      return {
        // a: params.a * scaleFactor,
      };
    },
    liveEffectInterpolate: (paramsA, paramsB, t) => {
      // Interpolate parameters

      return {
        // a: lerp(paramsA.a, paramsB.a, t),
      };
    },

    renderUI: (params) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
      // You can rewrite it!
      // ui.group({ direction: "row" }, [
      //   // ui.text({ text: "Color Mode"}),
      //   ui.select({ key: "colorMode", label: "Color Mode", value: params.colorMode, options: ['rgb', 'cmyk'] }),
      // ]),
      // ui.group({ direction: "row" }, [
      //   // ui.text({ text: "Strength"}),
      //   ui.slider({ key: "strength", label: "Strength", dataType: 'float', min: 0, max: 200, value: params.strength }),
      // ]),
      // ui.group({ direction: "row" }, [
      //   // ui.text({ text: "Angle"}),
      //   ui.slider({ key: "angle", label: "Angle", dataType: 'float', min: 0, max: 360, value: params.angle }),
      // ]),
      // ui.group({ direction: "row" }, [
      //   // ui.text({ text: "Opacity"}),
      //   ui.slider({ key: "opacity", label: "Opacity", dataType: 'float', min: 0, max: 100, value: params.opacity }),
      // ]),
      // ui.group({ direction: "row" }, [
      //   // ui.text({ text: "Blend Mode"}),
      //   ui.select({ key: "blendMode", label: "Blend Mode", value: params.blendMode, options: ['over', 'under'] }),
      // ]),

      // ui.separator(),

      // ui.group({ direction: "col" }, [
      //   ui.text({ text: "Debugging parameters" }),
      //   ui.slider({ key: "padding", label: "Padding", dataType: 'int', min: 0, max: 200, value: params.padding }),
      // ]),
    ])
    },
    initLiveEffect: async () => {
      const device = await navigator.gpu.requestAdapter().then((adapter) =>
        adapter!.requestDevice({
          label: "WebGPU(Chromatic Aberration)",
        })
      );

      if (!device) {
        throw new Error("Failed to create WebGPU device");
      }

      const shader = device.createShaderModule({
        label: "Chromatic Aberration Shader",
        code: `
          struct Params {
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
      `,
      });

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

      return { device, pipeline };
    },
    doLiveEffect: async ({ device, pipeline }, params, imgData) => {
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
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: 20, // float + float + uint + float + uint
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

      // Update uniforms
      // Rewrite for Params struct
      const uniformData = new ArrayBuffer(20);

      device.queue.writeBuffer(uniformBuffer, 0, uniformData);

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
