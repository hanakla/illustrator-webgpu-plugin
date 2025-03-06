import { createCanvas, ImageData } from "jsr:@gfx/canvas";

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

export async function adjustImageToNearestAligned256Resolution(imageDataLike: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): Promise<ImageData> {
  const { width: newWidth, height: newHeight } = getNearestAligned256Resolution(
    imageDataLike.width,
    imageDataLike.height
  );

  const resized = await resizeImageData(imageDataLike, newWidth, newHeight);

  return resized;
}

export async function resizeImageData(
  data: { width: number; height: number; data: Uint8ClampedArray },
  width: number,
  height: number
) {
  // const { createCanvas } = await import("npm:@napi-rs/canvas@0.1.68");
  const canvas = createCanvas(data.width, data.height);
  const ctx = canvas.getContext("2d")!;
  const imgData = new ImageData(data.data, data.width, data.height, {
    colorSpace: "srgb",
  });
  ctx.putImageData(imgData, 0, 0);

  const resizedCanvas = createCanvas(width, height);
  const resizedCtx = resizedCanvas.getContext("2d")!;
  resizedCtx.drawImage(canvas, 0, 0, width, height);

  return resizedCtx.getImageData(0, 0, width, height);
}
