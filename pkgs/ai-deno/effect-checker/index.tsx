// import { } from 'react'
import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { blurEffect } from "~ext/live-effects/blurEffect.ts";
import { chromaticAberration } from "~ext/live-effects/chromatic-aberration.ts";

console.log("Hello, world!", blurEffect);

const effects = [blurEffect, chromaticAberration];
const effectInits = new Map<string, any>();

function getInitialParams(effect) {
  return Object.fromEntries(
    Object.entries(effect.paramSchema).map(([key, value]: any) => [
      key,
      value.default,
    ])
  );
}

setTimeout(async () => {
  const canvas: HTMLCanvasElement = document.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  let imgData: ImageData | null = null;

  // Initialize effects
  await Promise.all(
    effects.map(async (effect) => {
      const init = await effect.initDoLiveEffect?.();
      effectInits.set(effect.id, init);
    })
  );

  let effect = chromaticAberration;
  let params = getInitialParams(effect);
  let init = effectInits.get(effect.id);

  window.addEventListener("dragover", (e) => e.preventDefault());

  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    const imageFile = [...e.dataTransfer!.files].find((file) =>
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
    try {
      if (!imgData) return;

      console.time("doLiveEffect");
      const result = await effect.doLiveEffect(init, params, imgData);

      canvas.width = result.width;
      canvas.height = result.height;
      ctx.putImageData(result, 0, 0);
    } finally {
      requestAnimationFrame(loop);
    }
  });

  const root = createRoot(document.getElementById("controls")!);

  root.render(
    <Controls
      effects={[...effects]}
      initialParams={params}
      renderUI={() => effect.renderUI(params)}
      onEffectChange={(nextEffect) => {
        effect = nextEffect;
        init = effectInits.get(nextEffect.id);
      }}
      onParamsChange={(nextParams) => (params = nextParams)}
    />
  );
});

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

function Controls({
  effects,
  initialParams,
  renderUI,
  onEffectChange,
  onParamsChange,
}: {
  effects: Array<any>;
  initialParams: any;
  renderUI: (params: any) => any;
  onEffectChange: (effect: any) => void;
  onParamsChange: (params: any) => void;
}) {
  const [effectId, setEffectId] = useState(effects[0].id);
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
      const effect = effects.find((effect) => effect.id === effectId)!;

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
              {node.options.map((option) => (
                <option key={option} value={option}>
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
          value={effects.find((e) => e.id === effectId)}
          onChange={onEffectChanged}
        >
          {effects.map((effect) => (
            <option key={effect.id} value={effect}>
              {effect.title}
            </option>
          ))}
        </select>
      </label>

      <hr style={{ borderTop: "1px solid #ddd", width: "100%" }} />

      {renderComponents(tree)}
    </div>
  );
}
