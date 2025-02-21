import { blurEffect } from "~ext/live-effects/blurEffect.ts";

console.log("Hello, world!", blurEffect);

setTimeout(() => {
  const canvas: HTMLCanvasElement = document.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;

  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    const imageFile = [...e.dataTransfer!.files].find((file) =>
      file.type.startsWith("image/")
    );

    if (!imageFile) return;

    const imgData = await loadImageData(imageFile);
    const result = await blurEffect.doLiveEffect(
      {
        radius: 10,
      },
      imgData
    );

    canvas.width = imgData.width;
    canvas.height = imgData.height;
    ctx.putImageData(result, 0, 0);
  });
});

async function loadImageData(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  return imageData;
}
