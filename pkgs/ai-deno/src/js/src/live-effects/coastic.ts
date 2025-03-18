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

// Caustics Filter Plugin
// Simulates underwater light refraction patterns similar to After Effects' Caustics simulation effect

// Translation texts for the plugin interfaces
const t = createTranslator({
  en: {
    title: "Caustics",
    intensity: "Intensity",
    scale: "Scale",
    complexity: "Complexity",
    speed: "Speed",
    colorMode: "Color Mode",
    lightColor: "Light Color",
    bgColor: "Background Color",
  },
  ja: {
    title: "コースティック",
    intensity: "強度",
    scale: "スケール",
    complexity: "複雑さ",
    speed: "速度",
    colorMode: "カラーモード",
    lightColor: "光の色",
    bgColor: "背景色",
  },
});

export const coastic = definePlugin({
  id: "caustics-effect-v1",
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
        default: 1.0,
      },
      scale: {
        type: "real",
        default: 50.0,
      },
      complexity: {
        type: "real",
        default: 3.0,
      },
      speed: {
        type: "real",
        default: 0.5,
      },
      colorMode: {
        type: "string",
        enum: ["blend", "add", "original"],
        default: "blend",
      },
      lightColor: {
        type: "color",
        default: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
      },
      bgColor: {
        type: "color",
        default: { r: 0.0, g: 0.1, b: 0.2, a: 1.0 },
      },
    },
    onEditParameters: (params) => {
      // RMIT: Normalize parameters if needed
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return {
        ...params,
        lightColor: adjustColor(params.lightColor),
        bgColor: adjustColor(params.bgColor),
      };
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        scale: params.scale * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t),
        scale: lerp(paramsA.scale, paramsB.scale, t),
        complexity: lerp(paramsA.complexity, paramsB.complexity, t),
        speed: lerp(paramsA.speed, paramsB.speed, t),
        colorMode: t < 0.5 ? paramsA.colorMode : paramsB.colorMode,
        lightColor: {
          r: lerp(paramsA.lightColor.r, paramsB.lightColor.r, t),
          g: lerp(paramsA.lightColor.g, paramsB.lightColor.g, t),
          b: lerp(paramsA.lightColor.b, paramsB.lightColor.b, t),
          a: lerp(paramsA.lightColor.a, paramsB.lightColor.a, t),
        },
        bgColor: {
          r: lerp(paramsA.bgColor.r, paramsB.bgColor.r, t),
          g: lerp(paramsA.bgColor.g, paramsB.bgColor.g, t),
          b: lerp(paramsA.bgColor.b, paramsB.bgColor.b, t),
          a: lerp(paramsA.bgColor.a, paramsB.bgColor.a, t),
        },
      };
    },

    renderUI: (params, setParam) => {
      // prettier-ignore
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "intensity", dataType: 'float', min: 0, max: 2, value: params.intensity }),
            ui.numberInput({ key: "intensity", dataType: 'float', value: params.intensity }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("scale") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "scale", dataType: 'float', min: 10, max: 200, value: params.scale }),
            ui.numberInput({ key: "scale", dataType: 'float', value: params.scale }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("complexity") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "complexity", dataType: 'float', min: 1, max: 10, value: params.complexity }),
            ui.numberInput({ key: "complexity", dataType: 'float', value: params.complexity }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("speed") }),
          ui.group({ direction: "row" }, [
            ui.slider({ key: "speed", dataType: 'float', min: 0, max: 2, value: params.speed }),
            ui.numberInput({ key: "speed", dataType: 'float', value: params.speed }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorMode") }),
          ui.select({ key: "colorMode", value: params.colorMode, options: [
            { label: "Blend", value: "blend" },
            { label: "Add", value: "add" },
            { label: "Original", value: "original" }
          ]}),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("lightColor") }),
          ui.colorInput({ key: "lightColor", value: params.lightColor }),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("bgColor") }),
          ui.colorInput({ key: "bgColor", value: params.bgColor }),
        ]),
      ])
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Caustics Effect)" },
        },
        (device) => {
          const code = `
            struct Params {
              inputDpi: i32,
              baseDpi: i32,
              intensity: f32,
              scale: f32,
              complexity: f32,
              speed: f32,
              colorMode: u32,
              time: f32,
              lightColor: vec4f,
              bgColor: vec4f,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Hash function for pseudo-random numbers
            fn hash(p: vec2f) -> f32 {
              let p2 = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
              return fract(sin(dot(p2, vec2f(12.9898, 78.233))) * 43758.5453);
            }

            // Value noise function
            fn noise(p: vec2f) -> f32 {
              let i = floor(p);
              let f = fract(p);

              // Four corners interpolation
              let a = hash(i);
              let b = hash(i + vec2f(1.0, 0.0));
              let c = hash(i + vec2f(0.0, 1.0));
              let d = hash(i + vec2f(1.0, 1.0));

              // Smooth interpolation
              let u = f * f * (3.0 - 2.0 * f);

              return mix(
                  mix(a, b, u.x),
                  mix(c, d, u.x),
                  u.y
              );
            }

            // FBM (Fractal Brownian Motion) for more complex noise
            fn fbm(p: vec2f, octaves: f32) -> f32 {
              var value = 0.0;
              var amplitude = 0.5;
              var freq = 1.0;

              // Use loop with constant max iterations to avoid dynamic loops
              let maxOctaves = 10.0;

              for (var i = 0.0; i < maxOctaves; i += 1.0) {
                if (i >= octaves) {
                  break;
                }

                value += amplitude * noise(p * freq);
                freq *= 2.0;
                amplitude *= 0.5;
              }

              return value;
            }

            // Main caustics function
            fn caustics(p: vec2f, time: f32, scale: f32, complexity: f32) -> f32 {
              let uv = p * scale * 0.01;

              // Generate two noise patterns that move in different directions
              let noise1 = fbm(uv + vec2f(time * 0.2, time * 0.3), complexity);
              let noise2 = fbm(uv + vec2f(-time * 0.1, time * 0.2), complexity);

              // Generate interference pattern
              let pattern = sin((noise1 - noise2) * 6.28) * 0.5 + 0.5;

              // Add extra detail
              let detail = fbm(uv * 3.0 + vec2f(time * 0.1), complexity) * 0.3;

              return pow(pattern + detail, 1.8);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // Get original color
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              // Generate caustics pattern
              let p = vec2f(texCoord.x, texCoord.y) - 0.5;
              let intensity = caustics(p, params.time * params.speed, params.scale, params.complexity) * params.intensity;

              // Create caustics color using light color
              let causticsColor = params.lightColor * intensity;

              // Apply color mode
              var finalColor: vec4f = vec4f(0.0);

              // Mode: 0 = blend, 1 = add, 2 = original
              if (params.colorMode == 0u) {
                let blend = mix(params.bgColor, params.lightColor, intensity);
                finalColor = mix(originalColor, blend, params.bgColor.a * params.intensity);
              } else if (params.colorMode == 1u) {
                finalColor = originalColor + causticsColor * params.intensity;
              } else {
                finalColor = originalColor;
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
        `;

          const shader = device.createShaderModule({
            label: "Caustics Shader",
            code,
          });

          const defs = makeShaderDataDefinitions(code);

          device.addEventListener("lost", (e) => {
            console.error(e);
          });

          device.addEventListener("uncapturederror", (e) => {
            console.error(e.error);
          });

          const pipeline = device.createComputePipeline({
            label: "Caustics Pipeline",
            layout: "auto",
            compute: {
              module: shader,
              entryPoint: "computeMain",
            },
          });

          return { device, pipeline, defs };
        }
      );
    },
    goLiveEffect: async (
      { device, pipeline, defs },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      // Input images default DPI is 72 get as `baseDpi`.
      // That if the `dpi` changes, the size of the elements according to visual elements and parameters will not change.

      console.log("Caustics Effect V1", params);

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
      const uniformValues = makeStructuredView(defs.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        inputDpi: dpi,
        baseDpi: baseDpi,
        intensity: params.intensity,
        scale: params.scale,
        complexity: params.complexity,
        speed: params.speed,
        colorMode:
          params.colorMode === "blend"
            ? 0
            : params.colorMode === "add"
            ? 1
            : params.colorMode === "original"
            ? 2
            : 0,
        time: performance.now() / 1000.0,
        lightColor: [
          params.lightColor.r,
          params.lightColor.g,
          params.lightColor.b,
          params.lightColor.a,
        ],
        bgColor: [
          params.bgColor.r,
          params.bgColor.g,
          params.bgColor.b,
          params.bgColor.a,
        ],
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

      // Update uniforms based on the Params struct
      // const uniformData = new ArrayBuffer(64); // Updated to match the Params struct size
      // const dataView = new DataView(uniformData);

      // // Populate uniform buffer with parameters
      // dataView.setInt32(0, dpi, true); // inputDpi
      // dataView.setInt32(4, baseDpi, true); // baseDpi
      // dataView.setFloat32(8, params.intensity, true); // intensity
      // dataView.setFloat32(12, params.scale, true); // scale
      // dataView.setFloat32(16, params.complexity, true); // complexity
      // dataView.setFloat32(20, params.speed, true); // speed

      // // colorMode as uint32
      // let colorModeValue = 0;
      // if (params.colorMode === "blend") colorModeValue = 0;
      // else if (params.colorMode === "add") colorModeValue = 1;
      // else if (params.colorMode === "original") colorModeValue = 2;
      // dataView.setUint32(24, colorModeValue, true);

      // // Current time for animation (in seconds)
      // const time = performance.now() / 1000.0;
      // dataView.setFloat32(28, time, true);

      // // lightColor (vec4f)
      // dataView.setFloat32(32, params.lightColor.r, true);
      // dataView.setFloat32(36, params.lightColor.g, true);
      // dataView.setFloat32(40, params.lightColor.b, true);
      // dataView.setFloat32(44, params.lightColor.a, true);

      // // bgColor (vec4f)
      // dataView.setFloat32(48, params.bgColor.r, true);
      // dataView.setFloat32(52, params.bgColor.g, true);
      // dataView.setFloat32(56, params.bgColor.b, true);
      // dataView.setFloat32(60, params.bgColor.a, true);

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
        label: "Caustics Effect Compute Pass",
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
