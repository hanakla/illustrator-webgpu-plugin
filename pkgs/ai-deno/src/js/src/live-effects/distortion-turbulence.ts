import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag, definePlugin, ColorRGBA } from "../plugin.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
} from "./_utils.ts";
import { createGPUDevice } from "./_shared.ts";

const t = createTranslator({
  en: {
    title: "Turbulence Displacement V1",
    scale: "Scale",
    octaves: "Octaves",
    displacementX: "Displacement X",
    displacementY: "Displacement Y",
    mode: "Mode",
    opacity: "Opacity",
    edgeMode: "Edge Mode",
    seed: "Seed",
    modeCartesian: "Cartesian",
    modeRadial: "Radial",
    modeTwist: "Twist",
    edgeClamp: "Clamp",
    edgeWrap: "Wrap",
    edgeMirror: "Mirror",
  },
  ja: {
    title: "タービュランスディスプレースメント V1",
    scale: "スケール",
    octaves: "オクターブ",
    displacementX: "X方向変位",
    displacementY: "Y方向変位",
    mode: "モード",
    opacity: "不透明度",
    edgeMode: "エッジモード",
    seed: "シード",
    modeCartesian: "直交座標",
    modeRadial: "放射状",
    modeTwist: "ねじり",
    edgeClamp: "クランプ",
    edgeWrap: "ラップ",
    edgeMirror: "ミラー",
  },
});

export const turbulenceDisplacement = definePlugin({
  id: "turbulence-displacement-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      scale: {
        type: "real",
        default: 30.0,
      },
      octaves: {
        type: "int",
        default: 4,
      },
      seed: {
        type: "real",
        default: 0.0,
      },
      displacementX: {
        type: "real",
        default: 50.0,
      },
      displacementY: {
        type: "real",
        default: 50.0,
      },
      displacementMode: {
        type: "string",
        enum: ["cartesian", "radial", "twist"],
        default: "cartesian",
      },
      edgeMode: {
        type: "string",
        enum: ["clamp", "wrap", "mirror"],
        default: "clamp",
      },
      opacity: {
        type: "int",
        default: 100,
      },
    },
    onEditParameters: (params) => {
      return params;
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        displacementX: params.displacementX * scaleFactor,
        displacementY: params.displacementY * scaleFactor,
        scale: params.scale * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        scale: lerp(paramsA.scale, paramsB.scale, t),
        octaves: Math.round(lerp(paramsA.octaves, paramsB.octaves, t)),
        seed: lerp(paramsA.seed, paramsB.seed, t),
        displacementX: lerp(paramsA.displacementX, paramsB.displacementX, t),
        displacementY: lerp(paramsA.displacementY, paramsB.displacementY, t),
        displacementMode:
          t < 0.5 ? paramsA.displacementMode : paramsB.displacementMode,
        edgeMode: t < 0.5 ? paramsA.edgeMode : paramsB.edgeMode,
        opacity: Math.round(lerp(paramsA.opacity, paramsB.opacity, t)),
      };
    },
    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("scale") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "scale",
              dataType: "float",
              min: 1,
              max: 200,
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
          ui.text({ text: t("octaves") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "octaves",
              dataType: "int",
              min: 1,
              max: 8,
              value: params.octaves,
            }),
            ui.numberInput({
              key: "octaves",
              dataType: "int",
              value: params.octaves,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("displacementX") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "displacementX",
              dataType: "float",
              min: -200,
              max: 200,
              value: params.displacementX,
            }),
            ui.numberInput({
              key: "displacementX",
              dataType: "float",
              value: params.displacementX,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("displacementY") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "displacementY",
              dataType: "float",
              min: -200,
              max: 200,
              value: params.displacementY,
            }),
            ui.numberInput({
              key: "displacementY",
              dataType: "float",
              value: params.displacementY,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("mode") }),
          ui.select({
            key: "displacementMode",
            value: params.displacementMode,
            options: [
              { label: t("modeCartesian"), value: "cartesian" },
              { label: t("modeRadial"), value: "radial" },
              { label: t("modeTwist"), value: "twist" },
            ],
          }),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("edgeMode") }),
          ui.select({
            key: "edgeMode",
            value: params.edgeMode,
            options: [
              { label: t("edgeClamp"), value: "clamp" },
              { label: t("edgeWrap"), value: "wrap" },
              { label: t("edgeMirror"), value: "mirror" },
            ],
          }),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("seed") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "seed",
              dataType: "float",
              min: 0,
              max: 100,
              value: params.seed,
            }),
            ui.numberInput({
              key: "seed",
              dataType: "float",
              value: params.seed,
            }),
          ]),
        ]),

        ui.group({ direction: "col" }, [
          ui.text({ text: t("opacity") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "opacity",
              dataType: "int",
              min: 0,
              max: 100,
              value: params.opacity,
            }),
            ui.numberInput({
              key: "opacity",
              dataType: "int",
              value: params.opacity,
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Turbulence Displacement V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              scale: f32,
              octaves: i32,
              seed: f32,
              displacementX: f32,
              displacementY: f32,
              displacementMode: i32, // 0: cartesian, 1: radial, 2: twist
              edgeMode: i32, // 0: clamp, 1: wrap, 2: mirror
              opacity: f32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            // Simplex noise functions
            fn mod289(x: vec3f) -> vec3f {
              return x - floor(x * (1.0 / 289.0)) * 289.0;
            }

            fn mod289_vec4(x: vec4f) -> vec4f {
              return x - floor(x * (1.0 / 289.0)) * 289.0;
            }

            fn permute(x: vec4f) -> vec4f {
              return mod289_vec4((x * 34.0 + 1.0) * x);
            }

            fn taylorInvSqrt(r: vec4f) -> vec4f {
              return 1.79284291400159 - 0.85373472095314 * r;
            }

            fn simplexNoise(v: vec3f) -> f32 {
              let C = vec2f(1.0/6.0, 1.0/3.0);
              let D = vec4f(0.0, 0.5, 1.0, 2.0);

              var i = floor(v + dot(v, vec3f(C.y)));
              let x0 = v - i + dot(i, vec3f(C.x));

              let g = step(x0.yzx, x0.xyz);
              let l = 1.0 - g;
              let i1 = min(g.xyz, l.zxy);
              let i2 = max(g.xyz, l.zxy);

              let x1 = x0 - i1 + C.x;
              let x2 = x0 - i2 + C.y;
              let x3 = x0 - D.yyy;

              i = mod289(i);
              let p = permute(permute(permute(
                  i.z + vec4f(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4f(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4f(0.0, i1.x, i2.x, 1.0));

              let ns = 0.142857142857;
              let j = p - 49.0 * floor(p * ns * ns);

              let x_ = floor(j * ns);
              let y_ = floor(j - 7.0 * x_);

              let x = x_ * ns + vec4f(ns) - 1.0;
              let y = y_ * ns + vec4f(ns) - 1.0;
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

              let norm = taylorInvSqrt(vec4f(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
              p0 *= norm.x;
              p1 *= norm.y;
              p2 *= norm.z;
              p3 *= norm.w;

              var m = max(0.6 - vec4f(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4f(0.0));
              m = m * m;
              return 42.0 * dot(m * m, vec4f(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
            }

            fn turbulence(pos: vec3f, octaves: i32) -> f32 {
              var value = 0.0;
              var amplitude = 1.0;
              var frequency = 1.0;
              var maxValue = 0.0;

              for (var i = 0; i < octaves; i++) {
                value += simplexNoise(pos * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= 0.5;
                frequency *= 2.0;
              }

              return (value / maxValue) * 0.5 + 0.5; // Normalize to 0-1 range
            }

            fn sampleWithEdgeMode(texCoord: vec2f) -> vec4f {
              var coord = texCoord;

              if (params.edgeMode == 0) { // clamp
                coord = clamp(coord, vec2f(0.0), vec2f(1.0));
              } else if (params.edgeMode == 1) { // wrap
                coord = fract(coord);
              } else if (params.edgeMode == 2) { // mirror
                coord = abs(fract(coord * 0.5) * 2.0 - 1.0);
              }

              let dims = vec2f(params.outputSize);
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let toInputTexCoord = dims / dimsWithGPUPadding;

              return textureSampleLevel(inputTexture, textureSampler, coord * toInputTexCoord, 0.0);
            }

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // Generate turbulence noise with separate X and Y components
              let noiseScale = params.scale * 0.01;
              let noisePosX = vec3f(
                texCoord.x * noiseScale,
                texCoord.y * noiseScale,
                params.seed
              );
              let noisePosY = vec3f(
                texCoord.x * noiseScale,
                texCoord.y * noiseScale,
                params.seed + 100.0
              );

              let noiseX = turbulence(noisePosX, params.octaves);
              let noiseY = turbulence(noisePosY, params.octaves);

              var displacement = vec2f(0.0);
              let scaledDisplacementX = params.displacementX * params.dpiScale;
              let scaledDisplacementY = params.displacementY * params.dpiScale;

              if (params.displacementMode == 0) { // cartesian
                displacement = vec2f(
                  (noiseX * 2.0 - 1.0) * scaledDisplacementX / dims.x,
                  (noiseY * 2.0 - 1.0) * scaledDisplacementY / dims.y
                );
              } else if (params.displacementMode == 1) { // radial
                let center = vec2f(0.5);
                let offset = texCoord - center;
                let distance = length(offset);
                if (distance > 0.001) {
                  let direction = offset / distance;
                  let noiseValue = (noiseX * 2.0 - 1.0);
                  // Use distance to modulate the effect (stronger at edges)
                  let strength = noiseValue * distance * length(vec2f(scaledDisplacementX, scaledDisplacementY));
                  displacement = direction * strength / min(dims.x, dims.y);
                }
              } else if (params.displacementMode == 2) { // twist
                let center = vec2f(0.5);
                let offset = texCoord - center;
                let distance = length(offset);
                if (distance > 0.001) {
                  // Angle increases with distance from center
                  let angle = (noiseX * 2.0 - 1.0) * scaledDisplacementX * distance * 0.1;
                  let cosA = cos(angle);
                  let sinA = sin(angle);
                  let rotated = vec2f(
                    offset.x * cosA - offset.y * sinA,
                    offset.x * sinA + offset.y * cosA
                  );
                  displacement = (rotated - offset) * scaledDisplacementY * 0.02;
                }
              }

              let displacedCoord = texCoord + displacement;
              let displacedColor = sampleWithEdgeMode(displacedCoord);
              let originalColor = sampleWithEdgeMode(texCoord);

              let opacity = params.opacity / 100.0;
              let finalColor = mix(originalColor, displacedColor, opacity);

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Turbulence Displacement V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Turbulence Displacement V1 Pipeline",
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
      console.log("Turbulence Displacement V1", params);

      // Calculate padding size based on maximum displacement
      const paddingSize = Math.ceil(
        Math.max(
          Math.abs(params.displacementX),
          Math.abs(params.displacementY)
        ) *
          1.5 *
          (dpi / baseDpi)
      );

      imgData = await paddingImageData(imgData, paddingSize);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Turbulence Displacement Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Turbulence Displacement ResultTexture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Turbulence Displacement Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Turbulence Displacement Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Map displacement mode string to int
      const modeMap = {
        cartesian: 0,
        radial: 1,
        twist: 2,
      };

      const edgeModeMap = {
        clamp: 0,
        wrap: 1,
        mirror: 2,
      };

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        scale: params.scale,
        octaves: params.octaves,
        seed: params.seed,
        displacementX: params.displacementX,
        displacementY: params.displacementY,
        displacementMode: modeMap[params.displacementMode],
        edgeMode: edgeModeMap[params.edgeMode],
        opacity: params.opacity / 100.0,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Turbulence Displacement Main Bind Group",
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
        size: bufferInputWidth * bufferInputHeight * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Update source texture
      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      // Execute compute shader
      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Turbulence Displacement Compute Pass",
      });
      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(bufferInputWidth / 16),
        Math.ceil(bufferInputHeight / 16)
      );
      computePass.end();

      commandEncoder.copyTextureToBuffer(
        { texture: resultTexture },
        { buffer: stagingBuffer, bytesPerRow: bufferInputWidth * 4 },
        [bufferInputWidth, bufferInputHeight]
      );

      device.queue.submit([commandEncoder.finish()]);

      // Read back and display the result
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const resultData = new Uint8Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      const resultImageData = new ImageData(
        new Uint8ClampedArray(resultData),
        bufferInputWidth,
        bufferInputHeight
      );

      return await removeWebGPUAlignmentPadding(
        resultImageData,
        outputWidth,
        outputHeight
      );
    },
  },
});
