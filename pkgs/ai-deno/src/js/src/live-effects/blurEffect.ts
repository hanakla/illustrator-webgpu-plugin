import { Effect, StyleFilterFlag } from "../types.ts";
import { ui } from "../ui.ts";

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
    console.log("Deno code running", input.buffer.byteLength / 4, input);

    function generateGaussianKernel(radius) {
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

    async function gaussianBlurWebGPU(imageData, radius) {
      console.log(`ぼかしの強さ: ${radius}ピクセル`);

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

      // 出力バッファ作成 - COPY_DST フラグを追加して対応
      const outputBuffer = device.createBuffer({
        size: bufferSize,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST |
          GPUBufferUsage.COPY_SRC,
      });

      // 結果読み取り用のバッファを別途作成
      const resultBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      device.queue.writeBuffer(inputBuffer, 0, data);

      const shaderModule = device.createShaderModule({
        code: `
        struct ImageData {
            data: array<u32>,
        };

        struct KernelData {
            values: array<f32>,
        };

        @group(0) @binding(0) var<storage, read> inputImage: ImageData;
        @group(0) @binding(1) var<storage, read_write> outputImage: ImageData;
        @group(0) @binding(2) var<storage, read> kernelData: KernelData;

        @compute @workgroup_size(8, 8)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            let width = ${width}u;
            let height = ${height}u;
            let radius = ${radius}i;
            let kernelSize = ${size}i;

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

            // 重みの合計が0より大きい場合のみ正規化
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

      // コマンドエンコーダを作成して出力バッファから結果バッファへコピー
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
      await resultBuffer.mapAsync(GPUMapMode.READ);
      const resultArray = new Uint8Array(resultBuffer.getMappedRange());
      const outputImageData = new ImageData(
        new Uint8ClampedArray(resultArray),
        width,
        height
      );
      resultBuffer.unmap();

      return outputImageData;
    }
    return input;
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
