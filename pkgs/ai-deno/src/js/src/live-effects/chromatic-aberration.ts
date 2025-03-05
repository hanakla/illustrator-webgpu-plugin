import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui.ts";
import {
  adjustImageToNearestAligned256Resolution,
  resizeImageData,
} from "./utils.ts";

export const chromaticAberration = definePlugin({
  id: "chromatic-aberration-v1",
  title: "Chromatic Aberration V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: StyleFilterFlag.kPostEffectFilter,
    features: [],
  },
  paramSchema: {
    colorMode: {
      type: "string",
      default: "rgb",
    },
    strength: {
      type: "real",
      default: 1.0,
    },
    angle: {
      type: "real",
      default: 0.0,
    },
    opacity: {
      type: "real",
      default: 1.0,
    },
  },
  editLiveEffectParameters: (params) => JSON.stringify(params),
  renderUI: (params) => {
    // prettier-ignore
    return ui.group({ direction: "col" }, [
      ui.group({ direction: "row" }, [
        ui.text({ text: "Color Mode"}),
        ui.textInput({ key: "colorMode", label: "Color Mode", value: params.colorMode }),
      ]),
      ui.group({ direction: "row" }, [
        ui.text({ text: "Strength"}),
        ui.slider({ key: "strength", label: "Strength", dataType: 'float', min: 0, max: 400, value: params.strength }),
      ]),
      ui.group({ direction: "row" }, [
        ui.text({ text: "Angle"}),
        ui.slider({ key: "angle", label: "Angle", dataType: 'float', min: 0, max: 360, value: params.angle }),
      ]),
      ui.group({ direction: "row" }, [
        ui.text({ text: "Opacity"}),
        ui.slider({ key: "opacity", label: "Opacity", dataType: 'float', min: 0, max: 1, value: params.opacity }),
      ]),
    ])
  },
  initDoLiveEffect: async () => {
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
              strength: f32,
              angle: f32,
              colorMode: u32,
              opacity: f32,
              blendMode: u32,  // 0: over, 1: under
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          fn getOffset(angle: f32) -> vec2f {
              let radians = angle * 3.14159 / 180.0;
              return vec2f(cos(radians), sin(radians));
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              let offset = getOffset(params.angle) * params.strength /100;
              var effectColor: vec4f;
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);
              let a = originalColor.a;

              if (params.colorMode == 0u) { // RGB mode
                  let redOffset = texCoord + offset;
                  let blueOffset = texCoord - offset;

                  let r = textureSampleLevel(inputTexture, textureSampler, redOffset, 0.0).r;
                  let g = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0).g;
                  let b = textureSampleLevel(inputTexture, textureSampler, blueOffset, 0.0).b;

                  effectColor = vec4f(r * a, g * a, b * a, a);
              } else { // CMYK mode
                  let cyanOffset = texCoord + offset;
                  let magentaOffset = texCoord + vec2f(-offset.y, offset.x) * 0.866;
                  let yellowOffset = texCoord + vec2f(-offset.x, -offset.y);
                  let blackOffset = texCoord - vec2f(-offset.y, offset.x) * 0.866; // Kは-120度回転

                  let cyan = textureSampleLevel(inputTexture, textureSampler, cyanOffset, 0.0);
                  let magenta = textureSampleLevel(inputTexture, textureSampler, magentaOffset, 0.0);
                  let yellow = textureSampleLevel(inputTexture, textureSampler, yellowOffset, 0.0);
                  let black = textureSampleLevel(inputTexture, textureSampler, blackOffset, 0.0);

                  // CMYKの色の混合
                  var result = vec3f(1.0);

                  if (cyan.r < 1.0) {
                      result.r *= cyan.r;
                      result.g = min(result.g + (1.0 - cyan.r) * 0.3, 1.0);
                      result.b = min(result.b + (1.0 - cyan.r) * 0.3, 1.0);
                  }

                  if (magenta.g < 1.0) {
                      result.g *= magenta.g;
                      result.r = min(result.r + (1.0 - magenta.g) * 0.3, 1.0);
                      result.b = min(result.b + (1.0 - magenta.b) * 0.3, 1.0);
                  }

                  if (yellow.b < 1.0) {
                      result.b *= yellow.b;
                      result.r = min(result.r + (1.0 - yellow.b) * 0.3, 1.0);
                      result.g = min(result.g + (1.0 - yellow.b) * 0.3, 1.0);
                  }

                  if (black.r < 0.1) {
                      let k = 1.0 - (black.r + black.g + black.b) / 3.0;
                      result *= (1.0 - k);
                  }

                  effectColor = vec4f(result * a, a);
              }

              var finalColor: vec4f;
              if (params.blendMode == 0u) {
                  finalColor = mix(originalColor, effectColor, params.opacity);
              } else {
                  finalColor = mix(effectColor, originalColor, 1.0 - params.opacity);
              }

              textureStore(resultTexture, id.xy, finalColor);
          }
      `,
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
    console.log("Chromatic Aberration V1", params, imgData);
    // const size = Math.max(imgData.width, imgData.height);

    const orignalSize = { width: imgData.width, height: imgData.height };
    imgData = await adjustImageToNearestAligned256Resolution(imgData);

    // Create textures
    const texture = device.createTexture({
      label: "Input Texture",
      size: [imgData.width, imgData.height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.STORAGE_BINDING,
    });

    const resultTexture = device.createTexture({
      label: "Result Texture",
      size: [imgData.width, imgData.height],
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
      size: imgData.width * imgData.height * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Update uniforms
    const uniformData = new ArrayBuffer(20); // 4 floats + 1 uint
    new Float32Array(uniformData, 0, 1)[0] = params.strength;
    new Float32Array(uniformData, 4, 1)[0] = params.angle;
    new Uint32Array(uniformData, 8, 1)[0] = params.colorMode === "RGB" ? 0 : 1;
    new Float32Array(uniformData, 12, 1)[0] = params.opacity / 100;
    new Uint32Array(uniformData, 16, 1)[0] = 0;
    // new Uint32Array(uniformData, 16, 1)[0] =
    //   params.blendMode === "over" ? 0 : 1;
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Update source texture
    device.queue.writeTexture(
      { texture },
      imgData.data,
      { bytesPerRow: imgData.width * 4, rowsPerImage: imgData.height },
      [imgData.width, imgData.height]
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
      Math.ceil(imgData.width / 16),
      Math.ceil(imgData.height / 16)
    );
    computePass.end();

    commandEncoder.copyTextureToBuffer(
      { texture: resultTexture },
      { buffer: stagingBuffer, bytesPerRow: imgData.width * 4 },
      [imgData.width, imgData.height]
    );

    device.queue.submit([commandEncoder.finish()]);

    // Read back and display the result
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const copyArrayBuffer = stagingBuffer.getMappedRange();
    const resultData = new Uint8Array(copyArrayBuffer.slice(0));
    stagingBuffer.unmap();

    const resultImageData = new ImageData(
      new Uint8ClampedArray(resultData),
      imgData.width,
      imgData.height
    );

    return await resizeImageData(
      resultImageData,
      orignalSize.width,
      orignalSize.height
    );
  },
});
