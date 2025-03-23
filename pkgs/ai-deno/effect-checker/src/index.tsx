// import { } from 'react'
import "./mocks.ts";
import { useState, useRef, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useEventCallback, useStableEvent, useThroughRef } from "./hooks.ts";

import { blurEffect } from "~ext/live-effects/blurEffect.ts";
import { pixelSort } from "~ext/live-effects/pixel-sort.ts";
import { kirakiraGlow } from "~ext/live-effects/kirakira-glow.ts";
import { glitch } from "~ext/live-effects/glitch.ts";
import { coastic } from "~ext/live-effects/coastic.ts";
import { dithering } from "~ext/live-effects/dithering.ts";
import { chromaticAberration } from "~ext/live-effects/chromatic-aberration.ts";
import { directionalBlur } from "~ext/live-effects/directional-blur.ts";
import { halftone } from "~ext/live-effects/halftone.ts";
import { testBlueFill } from "~ext/live-effects/test-blue-fill.ts";
import { innerGlow } from "~ext/live-effects/inner-glow.ts";
import { imageReverbGPU } from "~ext/live-effects/image-reverb-gpu.ts";
import { imageReverb } from "~ext/live-effects/image-reverb.ts";
import { outline } from "~ext/live-effects/outline.ts";
import { compressor } from "~ext/live-effects/compressor.ts";
import { fluidDistortion } from "~ext/live-effects/fluid-distortion.ts";
import { kaleidoscope } from "~ext/live-effects/kaleidoscope.ts";
import { downsampler } from "~ext/live-effects/downsampler.ts";
import { vhsInterlace } from "~ext/live-effects/vhs-interlace.ts";
import { dataMosh } from "~ext/live-effects/data-mosh.ts";
import { waveDistortion } from "~ext/live-effects/wave-distortion.ts";
import { selectiveColorCorrection } from "~ext/live-effects/selective-color-correction.ts";

const plugins = [
  dithering,
  selectiveColorCorrection,
  vhsInterlace,
  waveDistortion,
  dataMosh,
  downsampler,
  halftone,
  kaleidoscope,
  fluidDistortion,
  coastic,
  compressor,
  imageReverbGPU,
  kirakiraGlow,
  glitch,
  pixelSort,
  outline,
  // blurEffect,
  // innerGlow,
  testBlueFill,

  chromaticAberration,
  directionalBlur,
];

const effectInits = new Map<string, any>();

setTimeout(async () => {
  // Initialize effects
  await Promise.all(
    plugins.map(async (effect) => {
      console.log(effect);
      const init = await effect.liveEffect.initLiveEffect?.();
      effectInits.set(effect.id, init);
    })
  );

  const root = createRoot(document.getElementById("controls")!);
  root.render(<Controls plugins={[...plugins]} />);
});

function Controls({
  plugins,
}: // initialParams,
// initialDpi,
// renderUI,
// onEffectChange,
// onParamsChange,
// onDpiChange,
{
  plugins: Array<any>;
  initialParams: any;
  initialDpi: number;
  renderUI: (params: any) => any;
  onEffectChange: (effect: any) => void;
  onParamsChange: (params: any) => void;
  onDpiChange: (dpi: number) => void;
}) {
  const [pluginId, setPluginId] = useState(plugins[0].id);
  const [currentPlugin, setCurrentPlugin] = useState(plugins[0]);
  const [params, setParams] = useState<any>(getInitialParams(currentPlugin));
  const [dpi, setDpi] = useState(72);
  const [paused, setPaused] = useState(false);

  const pausedRef = useThroughRef(paused);
  const paramsRef = useThroughRef(params);
  const dpiRef = useThroughRef(dpi);
  const sourceImgData = useRef<ImageData | null>(null);
  const scaledImgData = useRef<ImageData | null>(null);
  const resultImgData = useRef<ImageData | null>(null);

  const nodeMap = new Map<string, any>();

  useEffect(() => {
    setParams(getInitialParams(currentPlugin));

    const abort = new AbortController();
    const signal = abort.signal;

    window.addEventListener("dragover", (e) => e.preventDefault(), { signal });

    window.addEventListener(
      "drop",
      async (e) => {
        e.preventDefault();
        const imageFile = [...e.dataTransfer!.files].find((file) =>
          file.type.startsWith("image/")
        );

        if (imageFile) onLoadImage(imageFile);
      },
      { signal }
    );

    window.addEventListener(
      "paste",
      async (e) => {
        const imageFile = [...e.clipboardData.files].find((file) =>
          file.type.startsWith("image/")
        );
        if (imageFile) onLoadImage(imageFile);
      },
      { signal }
    );

    fetch("./source.png", {
      cache: "no-store",
    }).then(async () => {
      const response = await fetch("./source.png");
      const blob = await response.blob();
      await onLoadImage(blob);
    });

    async function onLoadImage(blob: Blob) {
      sourceImgData.current = await loadImageData(blob);
      await scaleImageForDpi(sourceImgData.current!, dpiRef.current);
    }

    return () => {
      abort.abort();
    };
  }, []);

  useStableEvent(() => {
    const sizeLabel = document.getElementById("size-label")!;
    const colorLabel = document.getElementById("color-label")!;
    const canvas: HTMLCanvasElement = document.getElementById("canvas")!;
    const ctx = canvas.getContext("2d")!;

    const abort = new AbortController();
    const signal = abort.signal;

    canvas.addEventListener(
      "mousemove",
      (e) => {
        if (!resultImgData.current) return;

        // Get pixel color under mouse from resultImgData
        const x = (e.offsetX * resultImgData.current!.width) / canvas.width;
        const y = (e.offsetY * resultImgData.current!.height) / canvas.height;
        const index = (y | 0) * resultImgData.current!.width + (x | 0);
        const i = index * 4;
        const r = resultImgData.current!.data[i];
        const g = resultImgData.current!.data[i + 1];
        const b = resultImgData.current!.data[i + 2];
        const a = resultImgData.current!.data[i + 3];
        colorLabel.innerHTML = `rgba(${r}, ${g}, ${b}, ${a})
          <span style="background-color: rgba(${r}, ${g}, ${b}, ${a})">&nbsp;&nbsp;&nbsp;&nbsp;</span>`;
      },
      { signal }
    );

    let animId = requestAnimationFrame(async function loop() {
      const init = effectInits.get(currentPlugin.id);
      const params = paramsRef.current;

      if (signal.aborted) return;
      if (pausedRef.current || !sourceImgData.current || !scaledImgData.current)
        return (animId = requestAnimationFrame(loop));

      const timeLabel = `goLiveEffect (${currentPlugin.title})`;
      console.time(timeLabel);
      const input = {
        width: scaledImgData.current.width,
        height: scaledImgData.current.height,
        data: Uint8ClampedArray.from(scaledImgData.current.data),
      };

      const result = await currentPlugin.liveEffect.goLiveEffect(
        init,
        params,
        input,
        {
          dpi: dpiRef.current,
          baseDpi: 72,
        }
      );
      if (signal.aborted) return;

      const currentDpiScale = 72 / dpiRef.current;

      // as 72dpi image
      const resultData = new ImageData(
        result.data,
        result.width,
        result.height
      );
      const image = await createImageBitmap(resultData);
      resultImgData.current = resultData;
      // const sourceImage = await createImageBitmap(scaledImgData);

      sizeLabel.textContent =
        `${resultData.width}x${resultData.height} <= input: ${input.width}x${input.height} @ ${dpi}dpi` +
        ` / Source: ${sourceImgData.current.width}x${sourceImgData.current.height}`;
      canvas.style.width = `${(result.width * currentDpiScale) | 0}px`;
      canvas.style.height = `${(result.height * currentDpiScale) | 0}px`;
      canvas.width = result.width;
      canvas.height = result.height;

      // time based linear colort ping-pong light-gray to dark-gray
      // ctx.fillStyle = `hsl(0, 0%, ${Math.max(
      //   Math.sin(Date.now() / 500) * 60,
      //   20
      // )}%)`;
      ctx.fillStyle = "#ddd";
      // ctx.fillRect(0, 0, result.width, result.height);

      // draw gradient background
      // const gradient = ctx.createLinearGradient(0, 0, 0, result.height);
      // gradient.addColorStop(0, "#f0f0f0");
      // gradient.addColorStop(1, "#474747");
      // ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, result.width, result.height);

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      // ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
      console.timeEnd(timeLabel);

      animId = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(animId);
      abort.abort();
    };
  }, [currentPlugin]);

  const onParamChanged = useEventCallback((key, value) => {
    const nextParams = { ...params, [key]: value };
    setParams(nextParams);
  });

  const onEffectChanged = useEventCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const effectId = e.currentTarget.value;
      const effect = plugins.find((effect) => effect.id === effectId)!;
      if (!effect) return;

      setParams(getInitialParams(effect));
      setPluginId(effectId);
      setCurrentPlugin(effect);
    }
  );

  const onDpiChanged = useEventCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = parseInt(e.currentTarget.value);
      scaleImageForDpi(sourceImgData.current!, value);
      setDpi(value);
    }
  );

  function scaleImageForDpi(imageData: ImageData, dpi: number) {
    const scale = dpi / 72;
    const scaledWidth = imageData.width * scale;
    const scaledHeight = imageData.height * scale;
    scaledImgData.current = resizeImageData(
      imageData,
      scaledWidth,
      scaledHeight
    );
  }

  const renderUI = (params: any) => {
    const setParamFn = (patch: object | ((params: any) => any)) => {
      const nextParams = typeof patch === "function" ? patch(params) : patch;
      setParams((prev) => ({ ...prev, ...nextParams }));
    };
    return currentPlugin.liveEffect.renderUI(params, setParamFn);
  };

  const renderComponents = (node: any, idPrefix = ".") => {
    if (node == null) return null;

    const nodeId = idPrefix + node.type;
    nodeMap.set(nodeId, node);

    const onClickHandler = () => {
      node.onClick?.({ type: "click" });
    };

    const onChangeHandler = (node: any, value: any) => {
      node.onChange?.({ type: "change", value });
    };

    switch (node.type) {
      case "group":
        return (
          <div
            style={{
              display: "flex",
              flexDirection: node.direction === "col" ? "column" : "row",
              gap: "8px",
            }}
          >
            {node.children.map((child: any, i: number) => {
              return renderComponents(child, `${nodeId}.${i}-`);
            })}
          </div>
        );
      case "button":
        return <button onClick={onClickHandler}>{node.text}</button>;
      case "text":
        return <div>{node.text}</div>;
      case "textInput":
        return (
          <input
            type="text"
            value={node.value}
            onChange={(e) => {
              if (node.key) onParamChanged(node.key, e.currentTarget.value);
              onChangeHandler(node, e.currentTarget.value);
            }}
          />
        );
      case "numberInput":
        return (
          <input
            type="number"
            value={params[node.key]}
            min={node.min}
            max={node.max}
            step={node.step ?? (node.dataType === "int" ? 1 : 0.01)}
            onChange={(e) => {
              const target = e.currentTarget as HTMLInputElement;
              const value =
                node.dataType === "int"
                  ? parseInt(target.value)
                  : parseFloat(target.value);

              if (!Number.isNaN(value) && node.key)
                onParamChanged(node.key, value);
              onChangeHandler(node, value);
            }}
          />
        );
      case "colorInput": {
        const iC = params[node.key];
        const r = ((iC.r * 255) | 0).toString(16).padStart(2, "0");
        const g = ((iC.g * 255) | 0).toString(16).padStart(2, "0");
        const b = ((iC.b * 255) | 0).toString(16).padStart(2, "0");
        const a = ((iC.a * 255) | 0).toString(16).padStart(2, "0");

        return (
          <div>
            <input
              type="color"
              value={`#${r}${g}${b}`}
              onChange={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                const value = target.value;
                const r = parseInt(value.slice(1, 3), 16) / 255;
                const g = parseInt(value.slice(3, 5), 16) / 255;
                const b = parseInt(value.slice(5, 7), 16) / 255;

                if (node.key) onParamChanged(node.key, { r, g, b, a: iC.a });
                onChangeHandler(node, { r, g, b, a: iC.a });
              }}
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={iC.a}
              onChange={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                const value = parseFloat(target.value);
                if (node.key) onParamChanged(node.key, { ...iC, a: value });
                onChangeHandler(node, { ...iC, a: value });
              }}
            />
          </div>
        );
      }
      case "checkbox":
        return (
          <label style={{ display: "flex", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={params[node.key]}
              onChange={(e) => {
                if (node.key) onParamChanged(node.key, e.currentTarget.checked);
                onChangeHandler(node, e.currentTarget.checked);
              }}
            />
            {node.label}
          </label>
        );
      case "slider": {
        return (
          <label style={{ display: "flex", alignItems: "center" }}>
            {/* {node.label} */}
            <input
              type="range"
              min={node.min}
              max={node.max}
              value={params[node.key]}
              step={node.dataType === "int" ? 1 : 0.01}
              onChange={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                const value =
                  node.dataType === "int"
                    ? parseInt(target.value)
                    : parseFloat(target.value);
                if (!Number.isNaN(value) && node.key)
                  onParamChanged(node.key, value);
                onChangeHandler(node, value);
              }}
            />
          </label>
        );
      }
      case "select":
        return (
          <label style={{ display: "flex", alignItems: "center" }}>
            {/* {node.label} */}
            <select
              value={node.options[node.selectedIndex].value}
              style={{ width: "100%" }}
              onChange={(e) => {
                if (node.key) onParamChanged(node.key, e.currentTarget.value);
                onChangeHandler(node, e.currentTarget.value);
              }}
            >
              {node.options.map((option, i) => (
                <option key={i} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        );
      case "separator":
        return (
          <hr style={{ flex: 1, borderTop: "1px solid #ddd", width: "100%" }} />
        );
      default:
        return null;
    }
  };

  const tree = renderUI(params, nodeMap);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        paddingRight: "16px",
      }}
    >
      <select value={dpi} onChange={onDpiChanged} style={{ width: "100%" }}>
        <option value="72">72 dpi</option>
        <option value="144">144 dpi</option>
        <option value="200">200 dpi</option>
        <option value="300">300 dpi</option>
      </select>
      <label>
        Effects:
        <br />
        <select
          value={plugins.find((e) => e.id === pluginId).id}
          onChange={onEffectChanged}
        >
          {plugins.map((plugin) => (
            <option key={plugin.id} value={plugin.id}>
              {plugin.title}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={() => {
          pausedRef.current = !pausedRef.current;
          setPaused(pausedRef.current);
        }}
      >
        {paused ? "Resume" : "Pause"}
      </button>

      <hr style={{ borderTop: "1px solid #ddd", width: "100%" }} />

      {renderComponents(tree)}
    </div>
  );
}

async function loadImageData(blob: Blob): Promise<ImageData> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();

  const canvas = document.createElement("canvas");

  // canvas.width = Math.ceil(img.width / 256) * 256;
  // canvas.height = Math.ceil(img.height / 256) * 256;

  const { width, height } = getNearestAligned256Resolution(
    img.naturalWidth,
    img.naturalHeight
  );
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  console.log("bytesPerRow", imageData.width * 4, (imageData.width * 4) / 256, {
    width,
    height,
  });

  // const size = 512;
  // const canvas2 = document.createElement("canvas");
  // const ctx2 = canvas2.getContext("2d");

  // // Draw black triangle
  // ctx.fillStyle = "white";
  // ctx.fillRect(0, 0, size, size);

  // ctx.fillStyle = "black";
  // ctx.beginPath();
  // ctx.moveTo(256, 128);
  // ctx.lineTo(128, 384);
  // ctx.lineTo(384, 384);
  // ctx.closePath();
  // ctx.fill();

  // return ctx.getImageData(0, 0, size, size);

  return imageData;
}

export function getNearestAligned256Resolution(
  width: number,
  height: number,
  bytesPerPixel: number = 4
): { width: number; height: number } {
  const currentBytesPerRow = width * bytesPerPixel;
  const targetBytesPerRow = Math.ceil(currentBytesPerRow / 256) * 256;
  const newWidth = Math.round(targetBytesPerRow / bytesPerPixel);

  return {
    width: newWidth,
    height: height,
  };
}

function getInitialParams(effect: any) {
  return Object.fromEntries(
    Object.entries(effect.liveEffect.paramSchema).map(([key, value]: any) => [
      key,
      value.default,
    ])
  );
}

export function resizeImageData(
  data: ImageData,
  width: number,
  height: number
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;

  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(data, 0, 0);

  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = width;
  resizedCanvas.height = height;
  const resizedCtx = resizedCanvas.getContext("2d")!;
  resizedCtx.drawImage(canvas, 0, 0, width, height);

  return resizedCtx.getImageData(0, 0, width, height);
}
