import { blurEffect } from "~ext/live-effects/blurEffect.ts";
import { ChromaticAberration } from "~ext/live-effects/chromatic-aberration.ts";

console.log("Hello, world!", blurEffect);

const effects = new Map([
  [blurEffect, [blurEffect, { radius: 10 }]],
  [
    ChromaticAberration,
    [
      ChromaticAberration,
      { colorModde: "rgb", strength: 1, angle: 40, opacity: 20 },
    ],
  ],
]);

setTimeout(async () => {
  const canvas: HTMLCanvasElement = document.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  let imgData: ImageData | null = null;

  const [effect, params] = effects.get(ChromaticAberration)!;
  const init = await effect.initDoLiveEffect();

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

      console.log(imgData);

      console.time("doLiveEffect");
      const result = await effect.doLiveEffect(init, params, imgData);
      console.timeEnd("doLiveEffect");

      canvas.width = imgData.width;
      canvas.height = imgData.height;
      ctx.putImageData(result, 0, 0);
    } finally {
      requestAnimationFrame(loop);
    }
  });
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
