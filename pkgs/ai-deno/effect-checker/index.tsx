// import { } from 'react'
import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { blurEffect } from "~ext/live-effects/blurEffect.ts";
import { glow } from "~ext/live-effects/glow.ts";
import { glitch } from "~ext/live-effects/glitch.ts";
import { dithering } from "~ext/live-effects/dithering.ts";
import { chromaticAberration } from "~ext/live-effects/chromatic-aberration.ts";
import { directionalBlur } from "~ext/live-effects/directional-blur.ts";
import { testBlueFill } from "~ext/live-effects/test-blue-fill.ts";

const plugins = [
  // blurEffect,
  glitch,
  testBlueFill,
  glow,
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

    console.time("doLiveEffect", pluginRef());
    const input = {
      width: imgData.width,
      height: imgData.height,
      data: Uint8ClampedArray.from(imgData.data),
    };
    const result = await pluginRef().liveEffect.doLiveEffect(
      init,
      params,
      input
    );

    const resultData = new ImageData(result.data, result.width, result.height);

    canvas.width = result.width;
    canvas.height = result.height;
    ctx.putImageData(resultData, 0, 0);

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
      console.log(effectId);
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
            value={params[node.key]}
            onChange={(e) => onParamChanged(node.key, e.currentTarget.value)}
          />
        );
      case "checkbox":
        return (
          <label style={{ display: "flex", alignItems: "center" }}>
            {node.label}
            <input
              type="checkbox"
              checked={params[node.key]}
              onChange={(e) =>
                onParamChanged(node.key, e.currentTarget.checked)
              }
            />
          </label>
        );
      case "slider": {
        return (
          <label style={{ display: "flex", alignItems: "center" }}>
            {node.label}
            <input
              type="range"
              min={node.min}
              max={node.max}
              value={params[node.key]}
              step={node.dataType === "int" ? 1 : 0.01}
              onChange={(e) =>
                onParamChanged(node.key, parseFloat(e.currentTarget.value))
              }
            />
          </label>
        );
      }
      case "select":
        return (
          <label style={{ display: "flex", alignItems: "center" }}>
            {node.label}
            <select
              value={node.options[node.selectedIndex]}
              onChange={(e) => onParamChanged(node.key, e.currentTarget.value)}
            >
              {node.options.map((option, i) => (
                <option key={i} value={option}>
                  {option}
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
        padding: "4px",
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
