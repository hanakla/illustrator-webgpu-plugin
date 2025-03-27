import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag, definePlugin, ColorRGBA } from "../types.ts";
import { createTranslator } from "../ui/locale.ts";
import { ui } from "../ui/nodes.ts";
import {
  lerp,
  paddingImageData,
  addWebGPUAlignmentPadding,
  removeWebGPUAlignmentPadding,
  parseColorCode,
  toColorCode,
  // RMIT: Import createCanvas if needed
  createCanvas,
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
      // array: {
      //   type: "array",
      //   items: {
      //   type: "object",
      //     properties: {
      //       a: { type: "int"  },
      //       b: { type: "int"  },
      //     },
      //   },
      //   default: [],
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
              outputSize: vec2i,
              dpiScale: f32,
              // TODO
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              // RMIT: Use this coordinate for all computations
              let texCoord = vec2f(id.xy) / dims;
              // RMIT: Map texCoord space to input texture space, This is MUST to use when sampling inputTexture (likes textureSampleLevel())
              let toInputTexCoord = dims / dimsWithGPUPadding;

              // Ignore 256 padded pixels
              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              // RMIT: inputTexture is **straight alpha image**, not premultiplied alpha
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord * toInputTexCoord, 0.0);

              // TODO: Implement here

              // var finalColor: vec4f;
              textureStore(resultTexture, id.xy, finalColor);
            }

            // Drop-in replacement for mix() that works with vec3f rgb colors
            fn mixOklch(color1: vec3<f32>, color2: vec3<f32>, t: f32) -> vec3<f32> {
              // RGB -> Linear RGB
              let linearColor1 = vec3<f32>(
                select(color1.r / 12.92, pow((color1.r + 0.055) / 1.055, 2.4), color1.r <= 0.04045),
                select(color1.g / 12.92, pow((color1.g + 0.055) / 1.055, 2.4), color1.g <= 0.04045),
                select(color1.b / 12.92, pow((color1.b + 0.055) / 1.055, 2.4), color1.b <= 0.04045),
              );

              let linearColor2 = vec3<f32>(
                select(color2.r / 12.92, pow((color2.r + 0.055) / 1.055, 2.4), color2.r <= 0.04045),
                select(color2.g / 12.92, pow((color2.g + 0.055) / 1.055, 2.4), color2.g <= 0.04045),
                select(color2.b / 12.92, pow((color2.b + 0.055) / 1.055, 2.4), color2.b <= 0.04045),
              );

              // Linear RGB -> LMS
              let lms1 = mat3x3<f32>(
                0.4122214708, 0.5363325363, 0.0514459929,
                0.2119034982, 0.6806995451, 0.1073969566,
                0.0883024619, 0.2817188376, 0.6299787005
              ) * linearColor1;

              let lms2 = mat3x3<f32>(
                0.4122214708, 0.5363325363, 0.0514459929,
                0.2119034982, 0.6806995451, 0.1073969566,
                0.0883024619, 0.2817188376, 0.6299787005
              ) * linearColor2;

              // LMS -> Oklab
              let lms1_pow = vec3<f32>(pow(lms1.x, 1.0/3.0), pow(lms1.y, 1.0/3.0), pow(lms1.z, 1.0/3.0));
              let lms2_pow = vec3<f32>(pow(lms2.x, 1.0/3.0), pow(lms2.y, 1.0/3.0), pow(lms2.z, 1.0/3.0));

              let oklabMatrix = mat3x3<f32>(
                0.2104542553, 0.7936177850, -0.0040720468,
                1.9779984951, -2.4285922050, 0.4505937099,
                0.0259040371, 0.7827717662, -0.8086757660
              );

              let oklab1 = oklabMatrix * lms1_pow;
              let oklab2 = oklabMatrix * lms2_pow;

              // Oklab -> OKLCH
              let L1 = oklab1.x;
              let L2 = oklab2.x;
              let C1 = sqrt(oklab1.y * oklab1.y + oklab1.z * oklab1.z);
              let C2 = sqrt(oklab2.y * oklab2.y + oklab2.z * oklab2.z);
              let H1 = atan2(oklab1.z, oklab1.y);
              let H2 = atan2(oklab2.z, oklab2.y);

              // 色相の補間（最短経路）
              let hDiff = H2 - H1;
              let hDiffAdjusted = select(
                hDiff,
                hDiff - 2.0 * 3.14159265359,
                hDiff > 3.14159265359
              );
              let hDiffFinal = select(
                hDiffAdjusted,
                hDiffAdjusted + 2.0 * 3.14159265359,
                hDiffAdjusted < -3.14159265359
              );

              let L = mix(L1, L2, t);
              let C = mix(C1, C2, t);
              let H = H1 + t * hDiffFinal;

              // OKLCH -> Oklab
              let a = C * cos(H);
              let b = C * sin(H);

              // Oklab -> LMS
              let oklabInverseMatrix = mat3x3<f32>(
                1.0, 0.3963377774, 0.2158037573,
                1.0, -0.1055613458, -0.0638541728,
                1.0, -0.0894841775, -1.2914855480
              );

              let lms_pow = oklabInverseMatrix * vec3<f32>(L, a, b);
              let lms = vec3<f32>(
                pow(lms_pow.x, 3.0),
                pow(lms_pow.y, 3.0),
                pow(lms_pow.z, 3.0)
              );

              // LMS -> Linear RGB
              let lmsToRgbMatrix = mat3x3<f32>(
                4.0767416621, -3.3077115913, 0.2309699292,
                -1.2684380046, 2.6097574011, -0.3413193965,
                -0.0041960863, -0.7034186147, 1.7076147010
              );

              let linearRgb = lmsToRgbMatrix * lms;

              // Linear RGB -> RGB
              let rgbResult = vec3<f32>(
                select(12.92 * linearRgb.r, 1.055 * pow(linearRgb.r, 1.0/2.4) - 0.055, linearRgb.r <= 0.0031308),
                select(12.92 * linearRgb.g, 1.055 * pow(linearRgb.g, 1.0/2.4) - 0.055, linearRgb.g <= 0.0031308),
                select(12.92 * linearRgb.b, 1.055 * pow(linearRgb.b, 1.0/2.4) - 0.055, linearRgb.b <= 0.0031308),
              );

              return clamp(rgbResult, vec3<f32>(0.0), vec3<f32>(1.0));
            }

            fn mixOklchVec4(color1: vec4<f32>, color2: vec4<f32>, t: f32) -> vec4<f32> {
              return vec4<f32>(
                mixOklch(color1.rgb, color2.rgb, t),
                mix(color1.a, color2.a, t)
              );
            }
          `;

          const shader = device.createShaderModule({
            label: "Plugin Template V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Plugin Template V1 Pipeline",
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
      const paddingSize = params.numOfPxByParams;
      // imgData = await paddingImageData(imgData, paddingSize);

      const outputWidth = imgData.width,
        outputHeight = imgData.height;

      // Don't change it
      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width,
        bufferInputHeight = imgData.height;

      // Create textures
      const texture = device.createTexture({
        label: "Plugin Template Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Plugin Template  ResultTexture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Plugin Template Texture Sampler #1",
        magFilter: "linear",
        minFilter: "linear",
      });

      // Create uniform buffer
      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Plugin Template Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // RMIT: Set uniform value. Rewrite for Params struct
      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        // TODO
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Plugin Template Main Bind Group",
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
        label: "Chromatic Aberration Compute Pass",
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
