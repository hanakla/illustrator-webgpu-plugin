// import { createCanvas } from "npm:@napi-rs/canvas@0.1.68";

import {
  StyleFilterFlag,
  DoLiveEffectPayload,
  definePlugin,
} from "../types.ts";
import { ui } from "../ui.ts";

export const blurEffect = definePlugin({
  id: "blur-v1",
  title: "Gausian Blur V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: StyleFilterFlag.kPostEffectFilter,
    features: [],
  },
  paramSchema: {
    radius: {
      type: "real",
      default: 1.0,
    },
  },
  initDoLiveEffect: async () => {
    const device = await navigator.gpu
      .requestAdapter()
      .then((adapter) => adapter!.requestDevice());

    const shaderCode = `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) texCoord: vec2f,
      }

      @vertex
      fn vertexMain(@location(0) position: vec4f,
                    @location(1) texCoord: vec2f) -> VertexOutput {
        var output: VertexOutput;
        output.position = position;
        output.texCoord = texCoord;
        return output;
      }

      @group(0) @binding(0) var inputTexture: texture_2d<f32>;
      @group(0) @binding(1) var inputSampler: sampler;
      @group(0) @binding(2) var<uniform> kernel: array<f32, 256>;
      @group(0) @binding(3) var<uniform> kernelSize: u32;
      @group(0) @binding(4) var<uniform> direction: vec2f;

      @fragment
      fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
        var color = vec4f(0.0);
        let radius = i32(kernelSize) / 2;

        for (var i = -radius; i <= radius; i++) {
          let offset = direction * f32(i);
          let sampleCoord = texCoord + offset;
          let kernelValue = kernel[u32(i + radius)];
          color += textureSample(inputTexture, inputSampler, sampleCoord) * kernelValue;
        }

        return color;
      }
    `;

    return {
      device,
      shaderCode,
      bindGroupLayout: device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
          {
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
          },
        ],
      }),
    };
  },

  doLiveEffect: async (
    { device, horizontalPipeline, verticalPipeline, pipelineLayout },
    params,
    input
  ) => {
    const canvas = createCanvas(100, 100);

    console.time("[deno_ai(js)] gaussianBlurWebGPU");
    const result = await gaussianBlurWebGPU(input, params.radius);
    console.timeEnd("[deno_ai(js)] gaussianBlurWebGPU");

    return result;

    async function gaussianBlurWebGPU(
      input: DoLiveEffectPayload,
      radius: number
    ): Promise<ImageData> {
      const { width, height, data } = input;
      const { kernel, size } = generateGaussianKernel(radius);

      const kernelBuffer = device.createBuffer({
        size: 256 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(kernelBuffer, 0, new Float32Array(kernel));

      const kernelSizeBuffer = device.createBuffer({
        size: Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(kernelSizeBuffer, 0, new Uint32Array([size]));

      const directionBuffer = device.createBuffer({
        size: 2 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const textureData = new Uint8Array(data.buffer);
      const texture = device.createTexture({
        size: { width, height, depthOrArrayLayers: 1 },
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      device.queue.writeTexture(
        { texture },
        textureData,
        { bytesPerRow: width * 4, rowsPerImage: height },
        { width, height, depthOrArrayLayers: 1 }
      );

      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
      });

      const tempTexture = device.createTexture({
        size: { width, height, depthOrArrayLayers: 1 },
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const outputTexture = device.createTexture({
        size: { width, height, depthOrArrayLayers: 1 },
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Horizontal pass
      device.queue.writeBuffer(
        directionBuffer,
        0,
        new Float32Array([1.0 / width, 0])
      );
      const horizontalBindGroup = device.createBindGroup({
        layout: pipelineLayout,
        entries: [
          { binding: 0, resource: texture.createView() },
          { binding: 1, resource: sampler },
          { binding: 2, resource: { buffer: kernelBuffer } },
          { binding: 3, resource: { buffer: kernelSizeBuffer } },
          { binding: 4, resource: { buffer: directionBuffer } },
        ],
      });

      const commandEncoder = device.createCommandEncoder();
      const horizontalPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: tempTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      horizontalPass.setPipeline(horizontalPipeline);
      horizontalPass.setBindGroup(0, horizontalBindGroup);
      horizontalPass.draw(6, 1, 0, 0);
      horizontalPass.end();

      // Vertical pass
      device.queue.writeBuffer(
        directionBuffer,
        0,
        new Float32Array([0, 1.0 / height])
      );
      const verticalBindGroup = device.createBindGroup({
        layout: pipelineLayout,
        entries: [
          { binding: 0, resource: tempTexture.createView() },
          { binding: 1, resource: sampler },
          { binding: 2, resource: { buffer: kernelBuffer } },
          { binding: 3, resource: { buffer: kernelSizeBuffer } },
          { binding: 4, resource: { buffer: directionBuffer } },
        ],
      });

      const verticalPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: outputTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      verticalPass.setPipeline(verticalPipeline);
      verticalPass.setBindGroup(0, verticalBindGroup);
      verticalPass.draw(6, 1, 0, 0);
      verticalPass.end();

      const outputBuffer = device.createBuffer({
        size: width * height * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      commandEncoder.copyTextureToBuffer(
        { texture: outputTexture },
        { buffer: outputBuffer, bytesPerRow: width * 4, rowsPerImage: height },
        { width, height, depthOrArrayLayers: 1 }
      );

      device.queue.submit([commandEncoder.finish()]);
      await outputBuffer.mapAsync(GPUMapMode.READ);
      const outputArray = new Uint8ClampedArray(outputBuffer.getMappedRange());
      outputBuffer.unmap();

      const imageData = new ImageData(outputArray, width, height);

      kernelBuffer.destroy();
      kernelSizeBuffer.destroy();
      directionBuffer.destroy();
      texture.destroy();
      tempTexture.destroy();
      outputTexture.destroy();
      outputBuffer.destroy();

      return imageData;
    }
  },

  editLiveEffectParameters: (params) => JSON.stringify(params),

  renderUI: (params) => {
    console.log("renderUI");

    return ui.group({ direction: "col" }, [
      ui.text({ text: "Radius" }),
      ui.slider({
        key: "radius",
        label: "Radius",
        dataType: "float",
        min: 0,
        max: 400,
        value: params.radius ?? 1,
      }),
    ]);
  },
});

function generateGaussianKernel(radius: number) {
  const size = radius * 2 + 1;
  const kernel = new Array(size * size);

  const sigma = radius / 2;
  const twoSigmaSquare = 2 * sigma * sigma;
  const piTwoSigmaSquare = Math.PI * twoSigmaSquare;

  let sum = 0;

  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const exp = Math.exp(-(x * x + y * y) / twoSigmaSquare);
      const value = exp / piTwoSigmaSquare;

      const index = (y + radius) * size + (x + radius);
      kernel[index] = value;
      sum += value;
    }
  }

  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  return { kernel, size };
}
