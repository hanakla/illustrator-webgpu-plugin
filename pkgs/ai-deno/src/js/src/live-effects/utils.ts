import { decodeBase64 } from "jsr:@std/encoding@1.0.7";

const createCanvasImpl: (
  width: number,
  height: number
) => Promise<import("jsr:@gfx/canvas").Canvas> =
  typeof window === "undefined"
    ? async (width: number, height: number) => {
        const { createCanvas } = await import("jsr:@gfx/canvas");
        return createCanvas(width, height);
      }
    : async (width: number, height: number) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
      };

const createImageDataImpl: (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings?: ImageDataSettings
) => Promise<import("jsr:@gfx/canvas").ImageData> =
  typeof window === "undefined"
    ? async (
        data: Uint8ClampedArray,
        width: number,
        height: number,
        settings?: ImageDataSettings
      ) => {
        const { ImageData } = await import("jsr:@gfx/canvas");
        return new ImageData(data, width, height, settings);
      }
    : async (
        data: Uint8ClampedArray,
        width: number,
        height: number,
        settings?: ImageDataSettings
      ) => {
        return new ImageData(
          data,
          width,
          height,
          settings
        ) as import("jsr:@gfx/canvas").ImageData;
      };

async function toBlob(
  canvas: import("jsr:@gfx/canvas").Canvas | HTMLCanvasElement,
  mime: string,
  quality?: number
): Promise<Blob> {
  if (typeof window === "undefined") {
    mime = mime.replace(/^image\//, "");

    const b64 = (canvas as import("jsr:@gfx/canvas").Canvas)
      .toDataURL(mime as any, quality)
      .split(",")[1];
    const buffer = decodeBase64(b64);
    return new Blob([buffer], { type: mime });
  } else {
    return new Promise((r) => {
      (canvas as HTMLCanvasElement).toBlob((b) => r(b), mime, quality);
    });
  }
}

export type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

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

/** @deprecated */
export async function resizeImageToNearestAligned256Resolution(
  imageDataLike: ImageDataLike
): Promise<ImageDataLike> {
  const { width: newWidth, height: newHeight } = getNearestAligned256Resolution(
    imageDataLike.width,
    imageDataLike.height
  );

  const resized = await resizeImageData(imageDataLike, newWidth, newHeight);

  return resized;
}

export async function addWebGPUAlignmentPadding(
  imageDataLike: ImageDataLike
): Promise<ImageDataLike> {
  const { width, height } = imageDataLike;
  const { width: newWidth, height: newHeight } = getNearestAligned256Resolution(
    width,
    height
  );

  if (newWidth === width && newHeight === height) {
    return imageDataLike;
  }

  const canvas = await createCanvasImpl(newWidth, newHeight);
  const ctx = canvas.getContext("2d")!;
  const imgData = await createImageDataImpl(imageDataLike.data, width, height);

  ctx.putImageData(imgData, 0, 0);

  return ctx.getImageData(0, 0, newWidth, newHeight);
}

export async function removeWebGPUAlignmentPadding(
  imageDataLike: ImageDataLike,
  originalWidth: number,
  originalHeight: number
): Promise<ImageDataLike> {
  const { width, height } = imageDataLike;

  const canvas = await createCanvasImpl(originalWidth, originalHeight);
  const ctx = canvas.getContext("2d")!;
  const imgData = await createImageDataImpl(imageDataLike.data, width, height);
  ctx.putImageData(imgData, 0, 0);

  return ctx.getImageData(0, 0, originalWidth, originalHeight);
}

export async function resizeImageData(
  data: ImageDataLike,
  width: number,
  height: number
): Promise<ImageDataLike> {
  const canvas = await createCanvasImpl(data.width, data.height);
  const ctx = canvas.getContext("2d")!;
  const imgData = await createImageDataImpl(
    data.data,
    data.width,
    data.height,
    {
      colorSpace: "srgb",
    }
  );
  ctx.putImageData(imgData, 0, 0);

  const resizedCanvas = await createCanvasImpl(width, height);
  const resizedCtx = resizedCanvas.getContext("2d")!;
  resizedCtx.drawImage(canvas, 0, 0, width, height);

  return resizedCtx.getImageData(0, 0, width, height);
}

export async function paddingImageData(
  data: ImageDataLike,
  padding: number
): Promise<ImageDataLike> {
  const width = data.width + padding * 2;
  const height = data.height + padding * 2;

  const canvas = await createCanvasImpl(width, height);
  const ctx = canvas.getContext("2d")!;
  const imgData = await createImageDataImpl(
    data.data,
    data.width,
    data.height,
    {
      colorSpace: "srgb",
    }
  );
  ctx.putImageData(imgData, padding, padding);

  return ctx.getImageData(0, 0, width, height);
}

export async function toPng(imgData: ImageDataLike) {
  const canvas = await createCanvasImpl(imgData.width, imgData.height);
  const ctx = canvas.getContext("2d")!;
  const img = await createImageDataImpl(
    imgData.data,
    imgData.width,
    imgData.height
  );

  ctx.putImageData(img, 0, 0);
  return toBlob(canvas, "image/png", 100);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
