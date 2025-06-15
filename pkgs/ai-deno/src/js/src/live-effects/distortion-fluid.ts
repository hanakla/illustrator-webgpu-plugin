import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag } from "../plugin.ts";
import { definePlugin, ColorRGBA } from "../plugin.ts";
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

const t = createTranslator({
  en: {
    title: "Fluid Distortion V1",
    intensity: "Intensity",
    speed: "Speed",
    scale: "Scale",
    turbulence: "Turbulence",
    colorShift: "Color Shift",
    timeSeed: "Flow Seed",
    padding: "Padding",
  },
  ja: {
    title: "流体ディストーション V1",
    intensity: "強度",
    speed: "速度",
    scale: "スケール",
    turbulence: "乱流",
    colorShift: "色シフト",
    timeSeed: "フローシード",
    padding: "パディング",
  },
});

export const fluidDistortion = definePlugin({
  id: "fluid-distortion-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    subCategory: "Distortion",
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      intensity: {
        type: "real",
        default: 20.0,
      },
      speed: {
        type: "real",
        default: 0.5,
      },
      scale: {
        type: "real",
        default: 3.0,
      },
      turbulence: {
        type: "real",
        default: 0.3,
      },
      colorShift: {
        type: "real",
        default: 0.1,
      },
      padding: {
        type: "int",
        default: 0,
      },
      timeSeed: {
        type: "real",
        default: 0.0,
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        intensity: Math.max(0, params.intensity),
        speed: Math.max(0, params.speed),
        scale: Math.max(0.1, params.scale),
        turbulence: Math.max(0, params.turbulence),
        colorShift: Math.max(0, params.colorShift),
        timeSeed: params.timeSeed % 1000,
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        intensity: params.intensity * scaleFactor,
        scale: params.scale * scaleFactor,
        colorShift: params.colorShift,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        intensity: lerp(paramsA.intensity, paramsB.intensity, t),
        speed: lerp(paramsA.speed, paramsB.speed, t),
        scale: lerp(paramsA.scale, paramsB.scale, t),
        turbulence: lerp(paramsA.turbulence, paramsB.turbulence, t),
        colorShift: lerp(paramsA.colorShift, paramsB.colorShift, t),
        timeSeed: lerp(paramsA.timeSeed, paramsB.timeSeed, t),
      };
    },

    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("intensity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "intensity",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.intensity,
            }),
            ui.numberInput({
              key: "intensity",
              dataType: "float",
              value: params.intensity,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("speed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "speed",
              dataType: "float",
              min: 0,
              max: 5,
              value: params.speed,
            }),
            ui.numberInput({
              key: "speed",
              dataType: "float",
              value: params.speed,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("scale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "scale",
              dataType: "float",
              min: 0.1,
              max: 20,
              value: params.scale,
            }),
            ui.numberInput({
              key: "scale",
              dataType: "float",
              value: params.scale,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("turbulence") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "turbulence",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.turbulence,
            }),
            ui.numberInput({
              key: "turbulence",
              dataType: "float",
              value: params.turbulence,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("colorShift") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "colorShift",
              dataType: "float",
              min: 0,
              max: 2,
              value: params.colorShift,
            }),
            ui.numberInput({
              key: "colorShift",
              dataType: "float",
              value: params.colorShift,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("timeSeed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "timeSeed",
              dataType: "float",
              min: 0,
              max: 1000,
              value: params.timeSeed,
            }),
            ui.numberInput({
              key: "timeSeed",
              dataType: "float",
              value: params.timeSeed,
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("padding") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "padding",
              dataType: "int",
              min: 0,
              max: 600,
              value: params.padding,
            }),
            ui.numberInput({
              key: "padding",
              dataType: "int",
              value: params.padding,
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Fluid Distortion)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              intensity: f32,
              speed: f32,
              scale: f32,
              turbulence: f32,
              colorShift: f32,
              timeSeed: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Simplex noise functions based on https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
            fn permute4(x: vec4f) -> vec4f {
              return ((x * 34.0) + 1.0) * x % 289.0;
            }

            fn taylorInvSqrt4(r: vec4f) -> vec4f {
              return 1.79284291400159 - 0.85373472095314 * r;
            }

            fn noise3D(v: vec3f) -> f32 {
              let C = vec2f(1.0 / 6.0, 1.0 / 3.0);
              let D = vec4f(0.0, 0.5, 1.0, 2.0);

              // First corner
              var i = floor(v + dot(v, C.yyy));
              let x0 = v - i + dot(i, C.xxx);

              // Other corners
              let g = step(x0.yzx, x0.xyz);
              let l = 1.0 - g;
              let i1 = min(g.xyz, l.zxy);
              let i2 = max(g.xyz, l.zxy);

              // x0 = x0 - 0.0 + 0.0 * C.xxx;
              let x1 = x0 - i1 + 1.0 * C.xxx;
              let x2 = x0 - i2 + 2.0 * C.xxx;
              let x3 = x0 - 1.0 + 3.0 * C.xxx;

              // Permutations
              i = i % 289.0;
              let p = permute4(permute4(permute4(
                      i.z + vec4f(0.0, i1.z, i2.z, 1.0)) +
                      i.y + vec4f(0.0, i1.y, i2.y, 1.0)) +
                      i.x + vec4f(0.0, i1.x, i2.x, 1.0));

              // Gradients
              let n_ = 1.0 / 7.0; // N=7
              let ns = n_ * D.wyz - D.xzx;

              let j = p - 49.0 * floor(p * ns.z * ns.z);

              let x_ = floor(j * ns.z);
              let y_ = floor(j - 7.0 * x_);

              let x = x_ * ns.x + ns.yyyy;
              let y = y_ * ns.x + ns.yyyy;
              let h = 1.0 - abs(x) - abs(y);

              let b0 = vec4f(x.xy, y.xy);
              let b1 = vec4f(x.zw, y.zw);

              let s0 = floor(b0) * 2.0 + 1.0;
              let s1 = floor(b1) * 2.0 + 1.0;
              let sh = -step(h, vec4f(0.0));

              let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
              let a1 = b1.xzyw + s1.xzyw * sh.zzww;

              var p0 = vec3f(a0.xy, h.x);
              var p1 = vec3f(a0.zw, h.y);
              var p2 = vec3f(a1.xy, h.z);
              var p3 = vec3f(a1.zw, h.w);

              // Normalise gradients
              let norm = taylorInvSqrt4(vec4f(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
              p0 = p0 * norm.x;
              p1 = p1 * norm.y;
              p2 = p2 * norm.z;
              p3 = p3 * norm.w;

              // Mix final noise value
              var m = max(0.6 - vec4f(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4f(0.0));
              m = m * m;
              return 42.0 * dot(m * m, vec4f(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
            }

            // Function to create fluid-like distortion
            fn fluidDistortion(uv: vec2f, time: f32, scale: f32, turbulence: f32) -> vec2f {
              let t = time * 0.1;

              // Create different frequency noise patterns
              // Base layer - smooth flow
              let baseNoiseX = noise3D(vec3f(uv.x * scale, uv.y * scale, t));
              let baseNoiseY = noise3D(vec3f(uv.x * scale * 1.2, uv.y * scale * 1.2, t * 1.3));

              // Turbulent layer - higher frequency and more chaotic
              let turbNoiseX = noise3D(vec3f(uv.y * scale * 2.5, uv.x * scale * 2.5, t * 1.7));
              let turbNoiseY = noise3D(vec3f(uv.y * scale * 3.0, uv.x * scale * 2.0, t * 1.9));

              // Additional chaotic pattern for extreme turbulence
              let chaosNoiseX = noise3D(vec3f(uv.y * scale * 4.0 + baseNoiseX, uv.x * scale * 3.5, t * 2.3));
              let chaosNoiseY = noise3D(vec3f(uv.x * scale * 4.5 + baseNoiseY, uv.y * scale * 4.0, t * 2.1));

              // Apply non-linear turbulence mixing for more dramatic effect
              let turb = turbulence * turbulence; // Non-linear scaling for stronger effect

              // First interpolate between base and turbulent noise
              let mixedNoiseX = mix(baseNoiseX, turbNoiseX, min(turb, 1.0));
              let mixedNoiseY = mix(baseNoiseY, turbNoiseY, min(turb, 1.0));

              // For high turbulence (>1.0), blend in chaotic patterns using select function
              let extremeFactor = max(0.0, turbulence - 1.0);
              let hasExtremeTurbulence = turbulence > 1.0;

              // Use the select function to conditionally mix in chaotic noise
              let finalNoiseX = select(
                mixedNoiseX,
                mix(mixedNoiseX, chaosNoiseX, extremeFactor),
                hasExtremeTurbulence
              );

              let finalNoiseY = select(
                mixedNoiseY,
                mix(mixedNoiseY, chaosNoiseY, extremeFactor),
                hasExtremeTurbulence
              );

              return vec2f(finalNoiseX, finalNoiseY);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
                let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
                let dims = vec2f(params.outputSize);
                let texCoord = vec2f(id.xy) / dims;
                let toInputTexCoord = dims / dimsWithGPUPadding;
                let toScaledNomalizedAmountByPixels = 1.0 / (dims * params.dpiScale);

                // Ignore 256 padded pixels
                if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

                // Apply fluid distortion with DPI-aware scaling
                let distortionVec = fluidDistortion(
                    texCoord,
                    params.timeSeed * params.speed,
                    params.scale,
                    params.turbulence
                );

                // Adjust distortion amount based on turbulence
                let turbulenceBoost = 1.0 + (params.turbulence * 0.5);
                let distortionAmount = (params.intensity / 1000.0) * turbulenceBoost;
                let distortedCoord = texCoord + distortionVec * distortionAmount;

                // Apply chromatic aberration
                let chromaticShift = params.colorShift * 0.01 * (1.0 + params.turbulence * 0.3);
                let redOffset = distortedCoord + distortionVec * chromaticShift;
                let blueOffset = distortedCoord - distortionVec * chromaticShift;

                // Sample the texture with the distorted coordinates
                let colorR = textureSampleLevel(inputTexture, textureSampler, redOffset * toInputTexCoord, 0.0).r;
                let colorG = textureSampleLevel(inputTexture, textureSampler, distortedCoord * toInputTexCoord, 0.0).g;
                let colorB = textureSampleLevel(inputTexture, textureSampler, blueOffset * toInputTexCoord, 0.0).b;
                let colorA = textureSampleLevel(inputTexture, textureSampler, distortedCoord * toInputTexCoord, 0.0).a;

                let finalColor = vec4f(colorR, colorG, colorB, colorA);
                textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Fluid Distortion Shader",
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
            label: "Fluid Distortion Pipeline",
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
      { device, pipeline, pipelineDef },
      params,
      imgData,
      { dpi, baseDpi }
    ) => {
      console.log("Fluid Distortion V1", params);

      const dpiScale = dpi / baseDpi;

      const intensityFactor = params.intensity / 10;
      const scaleFactor = 5 / Math.max(0.5, params.scale);
      const turbulenceFactor = params.turbulence * 1.5;
      const colorShiftFactor = params.colorShift * 2;

      const paddingSize = Math.ceil(
        (params.padding +
          (intensityFactor * scaleFactor * (1 + turbulenceFactor) +
            (colorShiftFactor * params.intensity) / 20)) *
          dpiScale
      );

      // Ensure minimum padding for any distortion effect
      // 最小パディングもDPIに応じて調整
      const minimumPadding = Math.ceil(5 * dpiScale);
      const finalPaddingSize = Math.max(minimumPadding, paddingSize);

      console.log(
        "Calculated padding size:",
        finalPaddingSize,
        "DPI:",
        dpi,
        "baseDPI:",
        baseDpi
      );

      imgData = await paddingImageData(imgData, finalPaddingSize);

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
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "repeat",
        addressModeV: "repeat",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale,
        intensity: params.intensity,
        speed: params.speed,
        scale: params.scale,
        turbulence: params.turbulence,
        colorShift: params.colorShift,
        timeSeed: params.timeSeed,
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
      console.time("writeTexture");
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: inputWidth * 4, rowsPerImage: inputHeight },
        [inputWidth, inputHeight]
      );

      console.timeEnd("writeTexture");

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Fluid Distortion Compute Pass",
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

      console.time("execute");
      device.queue.submit([commandEncoder.finish()]);
      // await device.queue.onSubmittedWorkDone();
      console.timeEnd("execute");

      console.time("mapAsync");
      // Read back and display the result
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      console.timeEnd("mapAsync");

      console.time("getMappedRange");
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();
      console.timeEnd("getMappedRange");

      console.time("ImageData");
      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        inputWidth,
        inputHeight
      );
      console.timeEnd("ImageData");

      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
