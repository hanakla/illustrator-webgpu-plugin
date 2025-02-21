// src/js/src/ui.ts
var ui = {
  group: ({ direction = "horizontal" }, children) => ({
    type: "group",
    direction,
    children
  }),
  slider: (props) => ({
    ...props,
    type: "slider"
  }),
  checkbox: (props) => ({
    ...props,
    type: "checkbox"
  }),
  textInput: (props) => ({
    ...props,
    type: "textInput"
  }),
  text: (props) => ({
    ...props,
    type: "text"
  }),
  button: (props) => ({
    ...props,
    type: "button"
  })
};

// src/js/src/live-effects/blurEffect.ts
var gpuAdapter = await navigator.gpu.requestAdapter();
var device = await gpuAdapter.requestDevice();
var blurEffect = {
  id: "blur-v1",
  title: "Gausian Blur V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: 2 /* kPostEffectFilter */,
    features: []
  },
  paramSchema: {
    radius: {
      type: "real",
      default: 1
    }
  },
  doLiveEffect: async (params, input) => {
    console.log("Deno code running", input.data.byteLength / 4);
    console.log({
      width: input.width,
      height: input.height,
      byteLength: input.data.byteLength
    });
    console.time("gaussianBlurWebGPU");
    const result = await gaussianBlurWebGPU(input, params.radius);
    console.timeEnd("gaussianBlurWebGPU");
    return result;
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
      console.log(`\u307C\u304B\u3057\u306E\u5F37\u3055: ${radius}\u30D4\u30AF\u30BB\u30EB`, Deno.cwd());
      const device2 = await initWebGPU();
      const { width, height, data } = imageData;
      const { kernel, size } = generateGaussianKernel(radius);
      const kernelBuffer = device2.createBuffer({
        size: kernel.length * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device2.queue.writeBuffer(kernelBuffer, 0, new Float32Array(kernel));
      const bufferSize = width * height * 4;
      const inputBuffer = device2.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const outputBuffer = device2.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      const resultBuffer = device2.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      device2.queue.writeBuffer(inputBuffer, 0, data);
      const uniformBuffer = device2.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device2.queue.writeBuffer(
        uniformBuffer,
        0,
        new Float32Array([width, height, radius, size])
      );
      const shaderModule = device2.createShaderModule({
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
        }`
      });
      const pipeline = device2.createComputePipeline({
        layout: "auto",
        compute: { module: shaderModule, entryPoint: "main" }
      });
      const bindGroup = device2.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } },
          { binding: 2, resource: { buffer: kernelBuffer } },
          {
            binding: 3,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      const commandEncoder = device2.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(
        Math.ceil(width / 8),
        Math.ceil(height / 8)
      );
      passEncoder.end();
      device2.queue.submit([commandEncoder.finish()]);
      const copyEncoder = device2.createCommandEncoder();
      copyEncoder.copyBufferToBuffer(
        outputBuffer,
        0,
        resultBuffer,
        0,
        bufferSize
      );
      device2.queue.submit([copyEncoder.finish()]);
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
        value: params.radius ?? 1
      })
    ]);
  }
};

// src/js/src/live-effects/effects.ts
var randomNoiseEffect = {
  id: "randomNoise-v1",
  title: "Random Noise V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: 2 /* kPostEffectFilter */,
    features: []
  },
  paramSchema: {},
  doLiveEffect: async (params, input) => {
    const buffer = input.data;
    console.log("Deno code running", buffer.byteLength / 4, buffer);
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = Math.random() * 255;
      buffer[i + 1] = Math.random() * 255;
      buffer[i + 2] = Math.random() * 255;
      buffer[i + 3] = i > 2e3 ? 0 : 255;
    }
    return input;
  },
  editLiveEffectParameters: () => "{}",
  renderUI: (params) => ui.group({}, [])
};

// src/js/src/main.ts
var allEffects = [randomNoiseEffect, blurEffect];
var getLiveEffects = () => {
  return allEffects.map((effect) => ({
    id: effect.id,
    title: effect.title,
    version: effect.version
  }));
};
var getEffectViewNode = (id, state) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);
  try {
    return effect.renderUI({
      ...defaultValues,
      ...state
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
};
var doLiveEffect = async (id, state, width, height, data) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);
  try {
    const result = await effect.doLiveEffect(
      {
        ...defaultValues,
        ...state
      },
      {
        width,
        height,
        data
      }
    );
    if (typeof result.width !== "number" || typeof result.height !== "number" || !(result.data instanceof Uint8ClampedArray)) {
      throw new Error("Invalid result from doLiveEffect");
    }
    return result;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
var getDefaultValus = (effectId) => {
  const effect = findEffect(effectId);
  if (!effect) return null;
  return Object.fromEntries(
    Object.entries(effect.paramSchema).map(([key, value]) => [
      key,
      structuredClone(value.default)
    ])
  );
};
var findEffect = (id) => {
  const effect = allEffects.find((e) => e.id === id);
  if (!effect) console.error(`Effect not found: ${id}`);
  return effect;
};
export {
  doLiveEffect,
  getEffectViewNode,
  getLiveEffects
};
