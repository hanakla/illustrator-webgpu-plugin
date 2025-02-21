import { createCanvas } from "jsr:@gfx/canvas@0.5.6";
import { Effect, StyleFilterFlag, DoLiveEffectPayload } from "../types.ts";
import { ui } from "../ui.ts";

const gpuAdapter = await navigator.gpu.requestAdapter();
const device = await gpuAdapter!.requestDevice();

export const blurEffect: Effect<{ radius: number }> = {
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
  doLiveEffect: async (params, input) => {
    console.log("Deno code running", input.data.byteLength / 4);

    console.log({
      width: input.width,
      height: input.height,
      byteLength: input.data.byteLength,
    });

    console.time("gaussianBlurWebGPU");
    const result = await gaussianBlurWebGPU(input, params.radius);
    console.timeEnd("gaussianBlurWebGPU");

    return result;

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

    async function gaussianBlurWebGPU(
      imageData: DoLiveEffectPayload,
      radius: number
    ) {
      console.log(`ぼかしの強さ: ${radius}ピクセル`, Deno.cwd());

      // Deno.writeFile(
      //   "input.bmp.json",
      //   new TextEncoder().encode(
      //     JSON.stringify({
      //       width: imageData.width,
      //       height: imageData.height,
      //       data: imageData.data,
      //     })
      //   )
      // );

      const device = await initWebGPU();
      const { width, height, data } = imageData;

      const { kernel, size } = generateGaussianKernel(radius);
      const kernelBuffer = device.createBuffer({
        size: kernel.length * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(kernelBuffer, 0, new Float32Array(kernel));

      const bufferSize = width * height * 4;
      const inputBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      const outputBuffer = device.createBuffer({
        size: bufferSize,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST |
          GPUBufferUsage.COPY_SRC,
      });

      const resultBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      device.queue.writeBuffer(inputBuffer, 0, data);

      const uniformBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(
        uniformBuffer,
        0,
        new Float32Array([width, height, radius, size])
      );

      const shaderModule = device.createShaderModule({
        code: `
        struct ImageData {
            data: array<u32>,
        };

        struct KernelData {
            values: array<f32>,
        };

        struct Uniforms {
            width: u32,
            height: u32,
            radius: i32,
            kernelSize: i32,
        };

        @group(0) @binding(0) var<storage, read> inputImage: ImageData;
        @group(0) @binding(1) var<storage, read_write> outputImage: ImageData;
        @group(0) @binding(2) var<storage, read> kernelData: KernelData;
        @group(0) @binding(3) var<uniform> uniforms: Uniforms;

        @compute @workgroup_size(8, 8)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            let width = uniforms.width;
            let height = uniforms.height;
            let radius = uniforms.radius;
            let kernelSize = uniforms.kernelSize;

            if (id.x >= width || id.y >= height) {
                return;
            }

            let index = id.y * width + id.x;
            var color = vec4<f32>(0.0, 0.0, 0.0, 0.0);

            var weightSum = 0.0;

            for (var ky: i32 = -radius; ky <= radius; ky = ky + 1) {
                for (var kx: i32 = -radius; kx <= radius; kx = kx + 1) {
                    let xi = i32(id.x) + kx;
                    let yi = i32(id.y) + ky;
                    let kernelIndex = (ky + radius) * kernelSize + (kx + radius);
                    let weight = kernelData.values[kernelIndex];

                    if (xi >= 0 && xi < i32(width) && yi >= 0 && yi < i32(height)) {
                        let neighborIndex = u32(yi) * width + u32(xi);
                        let pixel = inputImage.data[neighborIndex];

                        let r = f32((pixel >> 24) & 0xFF);
                        let g = f32((pixel >> 16) & 0xFF);
                        let b = f32((pixel >> 8) & 0xFF);
                        let a = f32(pixel & 0xFF);

                        color += vec4<f32>(r, g, b, a) * weight;
                        weightSum += weight;
                    }
                }
            }

            if (weightSum > 0.0) {
                color = color / weightSum;
            }

            let finalPixel: u32 = (u32(color.r) << 24) | (u32(color.g) << 16) | (u32(color.b) << 8) | u32(color.a);
            outputImage.data[index] = finalPixel;
        }`,
      });

      const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: shaderModule, entryPoint: "main" },
      });

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } },
          { binding: 2, resource: { buffer: kernelBuffer } },
          {
            binding: 3,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(
        Math.ceil(width / 8),
        Math.ceil(height / 8)
      );
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);

      const copyEncoder = device.createCommandEncoder();
      copyEncoder.copyBufferToBuffer(
        outputBuffer,
        0,
        resultBuffer,
        0,
        bufferSize
      );
      device.queue.submit([copyEncoder.finish()]);

      // 結果バッファからデータを読み取り
      console.log("reading");
      await resultBuffer.mapAsync(GPUMapMode.READ);
      const resultArray = new Uint8Array(resultBuffer.getMappedRange());
      const outputImageData = new ImageData(
        new Uint8ClampedArray(resultArray),
        width,
        height
      );
      resultBuffer.unmap();
      console.log("read");

      return outputImageData;
    }

    async function initWebGPU() {
      if (!navigator.gpu) {
        throw new Error("WebGPU not supported!");
      }

      // const adapter = await navigator.gpu.requestAdapter();
      // if (!adapter) {
      //   throw new Error("Failed to get GPU adapter!");
      // }

      // const device = await adapter.requestDevice();
      // return device;
      return device;
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
};
