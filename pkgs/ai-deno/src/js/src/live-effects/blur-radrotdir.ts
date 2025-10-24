/**
 * Radial Rotation Directional Blur V1
 *
 * Ported from AviUtl script "RadRotDirBlur_S" by sigma-axis
 * Original: https://github.com/sigma-axis/aviutl_script_RadRotDirBlur_S
 * License: MIT - https://github.com/sigma-axis/aviutl_script_RadRotDirBlur_S/blob/main/LICENSE
 */

import {
  makeShaderDataDefinitions,
  makeStructuredView,
} from "npm:webgpu-utils";
import { StyleFilterFlag, definePlugin } from "../plugin.ts";
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
    title: "Radial Rotation Directional Blur V1",
    radialRate: "Radial Rate",
    rotateAngle: "Rotate Angle",
    strength: "Strength",
    relativePos: "Relative Position",
    keepSize: "Keep Size",
    directionX: "Direction X",
    directionY: "Direction Y",
    centerX: "Center X",
    centerY: "Center Y",
    quality: "Quality",
  },
  ja: {
    title: "放射・回転・方向ブラー V1",
    radialRate: "拡大率",
    rotateAngle: "回転角",
    strength: "強さ",
    relativePos: "相対位置",
    keepSize: "サイズ固定",
    directionX: "移動方向 X",
    directionY: "移動方向 Y",
    centerX: "中心 X",
    centerY: "中心 Y",
    quality: "精度",
  },
});

function unionRect(
  l: number,
  t: number,
  r: number,
  b: number,
  L: number,
  T: number,
  R: number,
  B: number
): [number, number, number, number] {
  return [Math.min(l, L), Math.min(t, T), Math.max(r, R), Math.max(b, B)];
}

function arcBoundCore2(
  R: number,
  A: number,
  a: number,
  a2?: number,
  ...rest: number[]
): [number, number, number, number] {
  if (A < 0) {
    const [l, t, r, b] = arcBoundCore2(R, A + Math.PI, a, a2, ...rest);
    return [-r, -b, -l, -t];
  } else if (A > Math.PI / 2) {
    const [l, t, r, b] = arcBoundCore2(R, A - Math.PI / 2, a, a2, ...rest);
    return [-b, l, -t, r];
  } else if (a2 !== undefined) {
    const [l, t, r, b] = arcBoundCore2(R, A, a);
    return unionRect(l, t, r, b, ...arcBoundCore2(R, A, a2, ...rest));
  } else if (a < 0) {
    const [l, t, r, b] = arcBoundCore2(R, Math.PI / 2 - A, -a);
    return [t, l, b, r];
  }

  a = a + A;
  let l = -R,
    t = -R,
    r = R,
    b = R;
  if (a < 0.5 * Math.PI) b = R * Math.sin(a);
  if (a < 1.0 * Math.PI) l = R * Math.cos(a);
  if (a < 1.5 * Math.PI) t = R * Math.sin(a);
  if (a < 2.0 * Math.PI) r = R * Math.cos(a);
  return [l, t, r, b];
}

function arcBoundCore(
  x: number,
  y: number,
  ...angles: number[]
): [number, number, number, number] {
  return arcBoundCore2(Math.sqrt(x * x + y * y), Math.atan2(y, x), ...angles);
}

function arcBound(
  left: number,
  top: number,
  right: number,
  bottom: number,
  ...angles: number[]
): [number, number, number, number] {
  let [l, t, r, b] = arcBoundCore(left, top, ...angles);
  [l, t, r, b] = unionRect(l, t, r, b, ...arcBoundCore(right, top, ...angles));
  [l, t, r, b] = unionRect(
    l,
    t,
    r,
    b,
    ...arcBoundCore(right, bottom, ...angles)
  );
  return unionRect(l, t, r, b, ...arcBoundCore(left, bottom, ...angles));
}

function calcExtraSize(
  width: number,
  height: number,
  scale1: number,
  rotate1: number,
  moveX1: number,
  moveY1: number,
  scale2: number,
  rotate2: number,
  moveX2: number,
  moveY2: number,
  centerX: number,
  centerY: number
): { left: number; top: number; right: number; bottom: number } {
  let l = -width / 2 - centerX;
  let t = -height / 2 - centerY;
  let r = width / 2 - centerX;
  let b = height / 2 - centerY;

  [l, t, r, b] = unionRect(
    l,
    t,
    r,
    b,
    ...arcBound(l, t, r, b, rotate1, rotate2)
  );

  const s = Math.max(scale1, scale2);
  [l, t, r, b] = unionRect(l, t, r, b, s * l, s * t, s * r, s * b);

  l = l + Math.min(moveX1, moveX2);
  t = t + Math.min(moveY1, moveY2);
  r = r + Math.max(moveX1, moveX2);
  b = b + Math.max(moveY1, moveY2);

  return {
    left: Math.ceil(Math.max(0, -l - centerX - width / 2)),
    top: Math.ceil(Math.max(0, -t - centerY - height / 2)),
    right: Math.ceil(Math.max(0, r + centerX - width / 2)),
    bottom: Math.ceil(Math.max(0, b + centerY - height / 2)),
  };
}

export const radRotDirBlur = definePlugin({
  id: "radial-rotation-directional-blur-v1",
  title: t("title"),
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {
      radialRate: {
        type: "real",
        default: 120.0,
      },
      rotateAngle: {
        type: "real",
        default: 0.0,
      },
      strength: {
        type: "real",
        default: 100.0,
      },
      relativePos: {
        type: "real",
        default: 0.0,
      },
      keepSize: {
        type: "boolean",
        default: false,
      },
      directionX: {
        type: "real",
        default: 0.0,
      },
      directionY: {
        type: "real",
        default: 0.0,
      },
      centerX: {
        type: "real",
        default: 0.0,
      },
      centerY: {
        type: "real",
        default: 0.0,
      },
      quality: {
        type: "int",
        default: 512,
      },
    },
    onEditParameters: (params) => {
      return {
        ...params,
        radialRate: Math.max(1, Math.min(1000, params.radialRate)),
        rotateAngle: Math.max(-720, Math.min(720, params.rotateAngle)),
        strength: Math.max(-200, Math.min(200, params.strength)),
        relativePos: Math.max(-100, Math.min(100, params.relativePos)),
        quality: Math.max(2, Math.min(4096, params.quality)),
      };
    },
    onAdjustColors: (params, adjustColor) => {
      return params;
    },
    onScaleParams(params, scaleFactor) {
      return {
        ...params,
        directionX: params.directionX * scaleFactor,
        directionY: params.directionY * scaleFactor,
        centerX: params.centerX * scaleFactor,
        centerY: params.centerY * scaleFactor,
      };
    },
    onInterpolate: (paramsA, paramsB, t) => {
      return {
        radialRate: lerp(paramsA.radialRate, paramsB.radialRate, t),
        rotateAngle: lerp(paramsA.rotateAngle, paramsB.rotateAngle, t),
        strength: lerp(paramsA.strength, paramsB.strength, t),
        relativePos: lerp(paramsA.relativePos, paramsB.relativePos, t),
        keepSize: t < 0.5 ? paramsA.keepSize : paramsB.keepSize,
        directionX: lerp(paramsA.directionX, paramsB.directionX, t),
        directionY: lerp(paramsA.directionY, paramsB.directionY, t),
        centerX: lerp(paramsA.centerX, paramsB.centerX, t),
        centerY: lerp(paramsA.centerY, paramsB.centerY, t),
        quality: Math.round(lerp(paramsA.quality, paramsB.quality, t)),
      };
    },

    renderUI: (params, { setParam }) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "col" }, [
          ui.text({ text: t("radialRate") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "radialRate",
              dataType: "float",
              min: 1,
              max: 1000,
              value: params.radialRate,
            }),
            ui.numberInput({
              key: "radialRate",
              dataType: "float",
              value: params.radialRate,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ radialRate: 120.0 }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("rotateAngle") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "rotateAngle",
              dataType: "float",
              min: -720,
              max: 720,
              value: params.rotateAngle,
            }),
            ui.numberInput({
              key: "rotateAngle",
              dataType: "float",
              value: params.rotateAngle,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ rotateAngle: 0.0 }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("strength") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "strength",
              dataType: "float",
              min: -200,
              max: 200,
              value: params.strength,
            }),
            ui.numberInput({
              key: "strength",
              dataType: "float",
              value: params.strength,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ strength: 100.0 }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("relativePos") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "relativePos",
              dataType: "float",
              min: -100,
              max: 100,
              value: params.relativePos,
            }),
            ui.numberInput({
              key: "relativePos",
              dataType: "float",
              value: params.relativePos,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ relativePos: 0.0 }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("keepSize") }),
          ui.checkbox({ key: "keepSize", value: params.keepSize }),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("directionX") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "directionX",
              dataType: "float",
              min: -1000,
              max: 1000,
              value: params.directionX,
            }),
            ui.numberInput({
              key: "directionX",
              dataType: "float",
              value: params.directionX,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ directionX: 0.0 }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("directionY") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "directionY",
              dataType: "float",
              min: -1000,
              max: 1000,
              value: params.directionY,
            }),
            ui.numberInput({
              key: "directionY",
              dataType: "float",
              value: params.directionY,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ directionY: 0.0 }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("centerX") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "centerX",
              dataType: "float",
              min: -2000,
              max: 2000,
              value: params.centerX,
            }),
            ui.numberInput({
              key: "centerX",
              dataType: "float",
              value: params.centerX,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ centerX: 0.0 }),
            }),
          ]),
        ]),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("centerY") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "centerY",
              dataType: "float",
              min: -2000,
              max: 2000,
              value: params.centerY,
            }),
            ui.numberInput({
              key: "centerY",
              dataType: "float",
              value: params.centerY,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ centerY: 0.0 }),
            }),
          ]),
        ]),
        ui.separator(),
        ui.group({ direction: "col" }, [
          ui.text({ text: t("quality") }),
          ui.group({ direction: "row" }, [
            ui.slider({
              key: "quality",
              dataType: "int",
              min: 2,
              max: 4096,
              value: params.quality,
            }),
            ui.numberInput({
              key: "quality",
              dataType: "int",
              value: params.quality,
            }),
            ui.button({
              text: "Reset",
              onClick: () => setParam({ quality: 512 }),
            }),
          ]),
        ]),
      ]);
    },
    initLiveEffect: async () => {
      return await createGPUDevice(
        {
          device: { label: "WebGPU(Radial Rotation Directional Blur V1)" },
        },
        (device) => {
          const code = `
            struct Params {
              outputSize: vec2i,
              dpiScale: f32,
              scaleRotMat: mat2x2f,
              delta: vec2f,
              iniScaleRotMat: mat2x2f,
              iniDelta: vec2f,
              center: vec2f,
              count: i32,
            }

            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
            @group(0) @binding(2) var textureSampler: sampler;
            @group(0) @binding(3) var<uniform> params: Params;

            @compute @workgroup_size(16, 16)
            fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dimsWithGPUPadding = vec2f(textureDimensions(inputTexture));
              let dims = vec2f(params.outputSize);
              let texCoord = vec2f(id.xy) / dims;
              let toInputTexCoord = dims / dimsWithGPUPadding;

              if (texCoord.x > 1.0 || texCoord.y > 1.0) { return; }

              var v = params.iniScaleRotMat * (texCoord - params.center + params.iniDelta);
              var d = params.iniScaleRotMat * params.delta;

              var color = textureSampleLevel(inputTexture, textureSampler, (v + params.center) * toInputTexCoord, 0.0);
              color = vec4f(color.rgb * color.a, color.a);

              for (var i = 0; i < params.count; i++) {
                v = params.scaleRotMat * (v + d);
                d = params.scaleRotMat * d;

                var c = textureSampleLevel(inputTexture, textureSampler, (v + params.center) * toInputTexCoord, 0.0);
                c = vec4f(c.rgb * c.a, c.a);
                color += c;
              }

              var finalColor = color;
              if (color.a > 0.0) {
                finalColor = vec4f(
                  color.rgb / color.a,
                  color.a / f32(params.count + 1)
                );
              }

              textureStore(resultTexture, id.xy, finalColor);
            }
          `;

          const shader = device.createShaderModule({
            label: "Radial Rotation Directional Blur V1 Shader",
            code,
          });

          const pipelineDef = makeShaderDataDefinitions(code);

          const pipeline = device.createComputePipeline({
            label: "Radial Rotation Directional Blur V1 Pipeline",
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
      console.log("Radial Rotation Directional Blur V1", params);

      let radialRate = Math.max(params.radialRate / 100, 0.01);
      let rotateRad = (params.rotateAngle * Math.PI) / 180;
      const amount = params.strength / 100;
      const relPos = Math.max(-1, Math.min(1, params.relativePos / 100));
      const quality = Math.max(2, Math.min(4096, params.quality));
      let directionX = params.directionX * (dpi / baseDpi);
      let directionY = params.directionY * (dpi / baseDpi);
      let centerX = params.centerX * (dpi / baseDpi);
      let centerY = params.centerY * (dpi / baseDpi);

      if (
        amount === 0 ||
        (radialRate === 1 &&
          rotateRad === 0 &&
          directionX === 0 &&
          directionY === 0)
      ) {
        return imgData;
      }

      radialRate = Math.pow(radialRate, amount);
      rotateRad = rotateRad * amount;
      directionX = directionX * amount;
      directionY = directionY * amount;

      const relPos1 = (relPos - 1) / 2;
      const relPos2 = (relPos + 1) / 2;
      const scale1 = Math.pow(radialRate, relPos1);
      const scale2 = Math.pow(radialRate, relPos2);
      const rotate1 = rotateRad * relPos1;
      const rotate2 = rotateRad * relPos2;
      const moveX1 = directionX * relPos1;
      const moveX2 = directionX * relPos2;
      const moveY1 = directionY * relPos1;
      const moveY2 = directionY * relPos2;

      const outputWidth = imgData.width;
      const outputHeight = imgData.height;

      if (!params.keepSize) {
        const extraSize = calcExtraSize(
          outputWidth,
          outputHeight,
          scale1,
          rotate1,
          moveX1,
          moveY1,
          scale2,
          rotate2,
          moveX2,
          moveY2,
          centerX,
          centerY
        );

        const paddingSize = Math.max(
          Math.max(1, extraSize.left),
          Math.max(1, extraSize.top),
          Math.max(1, extraSize.right),
          Math.max(1, extraSize.bottom)
        );

        imgData = await paddingImageData(imgData, paddingSize);
        centerX = centerX + (extraSize.left - extraSize.right) / 2;
        centerY = centerY + (extraSize.top - extraSize.bottom) / 2;
      }

      imgData = await addWebGPUAlignmentPadding(imgData);

      const bufferInputWidth = imgData.width;
      const bufferInputHeight = imgData.height;

      const texture = device.createTexture({
        label: "Radial Rotation Directional Blur Input Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.STORAGE_BINDING,
      });

      const resultTexture = device.createTexture({
        label: "Radial Rotation Directional Blur Result Texture",
        size: [bufferInputWidth, bufferInputHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const sampler = device.createSampler({
        label: "Radial Rotation Directional Blur Texture Sampler",
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      const uniformValues = makeStructuredView(pipelineDef.uniforms.params);
      const uniformBuffer = device.createBuffer({
        label: "Radial Rotation Directional Blur Params Buffer",
        size: uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const scale = scale2 / scale1;
      const rotate = rotate2 - rotate1;
      const moveX = moveX2 - moveX1;
      const moveY = moveY2 - moveY1;
      const count = quality - 1;

      const scaleRotPerStep = Math.pow(scale, -1 / count);
      const rotatePerStep = -rotate / count;
      const c = scaleRotPerStep * Math.cos(rotatePerStep);
      const s = scaleRotPerStep * Math.sin(rotatePerStep);

      const iniC = Math.cos(-rotate1) / scale1;
      const iniS = Math.sin(-rotate1) / scale1;

      uniformValues.set({
        outputSize: [outputWidth, outputHeight],
        dpiScale: dpi / baseDpi,
        scaleRotMat: [
          c,
          (s * outputWidth) / outputHeight,
          (-s * outputHeight) / outputWidth,
          c,
        ],
        delta: [-moveX / count / outputWidth, -moveY / count / outputHeight],
        iniScaleRotMat: [
          iniC,
          (iniS * outputWidth) / outputHeight,
          (-iniS * outputHeight) / outputWidth,
          iniC,
        ],
        iniDelta: [-moveX1 / outputWidth, -moveY1 / outputHeight],
        center: [centerX / outputWidth + 0.5, centerY / outputHeight + 0.5],
        count: count,
      });

      device.queue.writeBuffer(uniformBuffer, 0, uniformValues.arrayBuffer);

      const bindGroup = device.createBindGroup({
        label: "Radial Rotation Directional Blur Main Bind Group",
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

      device.queue.writeTexture(
        { texture },
        imgData.data,
        { bytesPerRow: bufferInputWidth * 4, rowsPerImage: bufferInputHeight },
        [bufferInputWidth, bufferInputHeight]
      );

      const commandEncoder = device.createCommandEncoder({
        label: "Main Command Encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "Radial Rotation Directional Blur Compute Pass",
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
