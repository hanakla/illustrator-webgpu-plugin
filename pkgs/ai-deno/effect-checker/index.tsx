// import { } from 'react'
import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { blurEffect } from "~ext/live-effects/blurEffect.ts";
import { pixelSort } from "~ext/live-effects/pixel-sort.ts";
import { kirakiraGlow } from "~ext/live-effects/kirakira-glow.ts";
import { glitch } from "~ext/live-effects/glitch.ts";
import { dithering } from "~ext/live-effects/dithering.ts";
import { chromaticAberration } from "~ext/live-effects/chromatic-aberration.ts";
import { directionalBlur } from "~ext/live-effects/directional-blur.ts";
import { testBlueFill } from "~ext/live-effects/test-blue-fill.ts";
import { innerGlow } from "~ext/live-effects/inner-glow.ts";

const plugins = [
  // blurEffect,
  innerGlow,
  pixelSort,
  glitch,
  testBlueFill,
  kirakiraGlow,
  dithering,
  chromaticAberration,
  directionalBlur,
];
const effectInits = new Map<string, any>();

setTimeout(async () => {
  const canvas: HTMLCanvasElement = document.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  let imgData: ImageData | null = null;

  // Initialize effects
  await Promise.all(
    plugins.map(async (effect) => {
      console.log(effect);
      const init = await effect.liveEffect.initLiveEffect?.();
      effectInits.set(effect.id, init);
    })
  );

  let currentPlugin = plugins[0];
  let prevPlugin = currentPlugin;
  const pluginRef = (...args: any) => currentPlugin;
  let params = getInitialParams(currentPlugin);
  let init = effectInits.get(currentPlugin.id);

  window.addEventListener("dragover", (e) => e.preventDefault());

  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    const imageFile = [...e.dataTransfer!.files].find((file) =>
      file.type.startsWith("image/")
    );

    if (!imageFile) return;
    imgData = await loadImageData(imageFile);
  });

  window.addEventListener("paste", async (e) => {
    const imageFile = [...e.clipboardData.files].find((file) =>
      file.type.startsWith("image/")
    );

    if (!imageFile) return;
    imgData = await loadImageData(imageFile);
  });

  fetch("./source.png").then(async () => {
    const response = await fetch("./source.png");
    const blob = await response.blob();
    imgData = await loadImageData(blob);
  });

  requestAnimationFrame(async function loop() {
    if (!imgData) return requestAnimationFrame(loop);

    if (currentPlugin !== prevPlugin) {
      prevPlugin = currentPlugin;
      // console.clear();
    }

    console.time("doLiveEffect");
    const input = {
      width: imgData.width,
      height: imgData.height,
      data: Uint8ClampedArray.from(imgData.data),
    };
    const result = await currentPlugin.liveEffect.doLiveEffect(
      init,
      params,
      input
    );

    const resultData = new ImageData(result.data, result.width, result.height);

    canvas.width = result.width;
    canvas.height = result.height;
    ctx.putImageData(resultData, 0, 0);
    console.timeEnd("doLiveEffect", currentPlugin);

    requestAnimationFrame(loop);
  });

  const root = createRoot(document.getElementById("controls")!);

  root.render(
    <Controls
      plugins={[...plugins]}
      initialParams={params}
      renderUI={() => currentPlugin.liveEffect.renderUI(params)}
      onEffectChange={(nextEffect) => {
        currentPlugin = nextEffect;
        init = effectInits.get(nextEffect.id);
      }}
      onParamsChange={(nextParams) => (params = nextParams)}
    />
  );
});

function Controls({
  plugins,
  initialParams,
  renderUI,
  onEffectChange,
  onParamsChange,
}: {
  plugins: Array<any>;
  initialParams: any;
  renderUI: (params: any) => any;
  onEffectChange: (effect: any) => void;
  onParamsChange: (params: any) => void;
}) {
  const [pluginId, setEffectId] = useState(plugins[0].id);
  const [params, setParams] = useState(initialParams);

  const tree = renderUI(params);

  const onParamChanged = useCallback(
    (key, value) => {
      const nextParams = { ...params, [key]: value };

      setParams(nextParams);
      onParamsChange(nextParams);
    },
    [params, setParams, onParamsChange]
  );

  const onEffectChanged = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const effectId = e.currentTarget.value;
      const effect = plugins.find((effect) => effect.id === effectId)!;
      if (!effect) return;

      const nextParams = getInitialParams(effect);
      setParams(nextParams);
      onParamsChange(nextParams);

      setEffectId(effectId);
      onEffectChange(effect);
    },
    [setParams, onEffectChange]
  );

  const renderComponents = (node) => {
    if (node == null) return null;

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
            {node.children.map(renderComponents)}
          </div>
        );
      case "text":
        return <div>{node.text}</div>;
      case "textInput":
        return (
          <input
            type="text"
            value={node.value}
            onChange={(e) => onParamChanged(node.key, e.currentTarget.value)}
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
              if (!Number.isNaN(value)) onParamChanged(node.key, value);
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
          <>
            <input
              type="color"
              value={`#${r}${g}${b}`}
              onChange={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                const value = target.value;
                const r = parseInt(value.slice(1, 3), 16) / 255;
                const g = parseInt(value.slice(3, 5), 16) / 255;
                const b = parseInt(value.slice(5, 7), 16) / 255;

                onParamChanged(node.key, { r, g, b, a: iC.a });
              }}
            />
            <br />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={iC.a}
              onChange={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                const value = parseFloat(target.value);
                onParamChanged(node.key, { ...iC, a: value });
              }}
            />
          </>
        );
      }
      case "checkbox":
        return (
          <label style={{ display: "flex", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={params[node.key]}
              onChange={(e) =>
                onParamChanged(node.key, e.currentTarget.checked)
              }
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
                if (!Number.isNaN(value)) onParamChanged(node.key, value);
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
              onChange={(e) => onParamChanged(node.key, e.currentTarget.value)}
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

  useEffect(() => {}, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        paddingRight: "16px",
      }}
    >
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

      <hr style={{ borderTop: "1px solid #ddd", width: "100%" }} />

      {renderComponents(tree)}
    </div>
  );
}

async function loadImageData(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();

  const canvas = document.createElement("canvas");

  // canvas.width = Math.ceil(img.width / 256) * 256;
  // canvas.height = Math.ceil(img.height / 256) * 256;

  const { width, height } = getNearestAligned256Resolution(600, 600);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 100, 100, 500, 500);

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
