import { decodeBase64 } from "jsr:@std/encoding@1.0.7";
import { ColorRGBA } from "../plugin.ts";

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

export function createCanvas(width: number, height: number) {
  return createCanvasImpl(width, height);
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

/**
 * Add right and bottom padding to the image data to align the resolution to the nearest 256.
 */
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
  console.log("resizeImageData", data.width, data.height, width, height);
  width = Math.round(width);
  height = Math.round(height);

  if (data.width === width && data.height === height) {
    return data;
  }

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

export async function cropImageData(
  data: ImageDataLike,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<ImageDataLike> {
  x = Math.round(x);
  y = Math.round(y);
  width = Math.round(width);
  height = Math.round(height);

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

  const croppedCanvas = await createCanvasImpl(width, height);
  const croppedCtx = croppedCanvas.getContext("2d")!;
  croppedCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

  return croppedCtx.getImageData(0, 0, width, height);
}

export async function paddingImageData(
  data: ImageDataLike,
  padding: number
): Promise<ImageDataLike> {
  padding = Math.ceil(padding);

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

/**
 * Parsing `#RRGGBBAA`(or `RRGGBBAA`) color code to ColorRGBA,
 * Also support `#RGB`, `#RGBA`, `#RRGGBB` (or without #) color code.
 * @param color
 * @returns
 */
export function parseColorCode(color: string): ColorRGBA | null {
  const hex = (color.startsWith("#") ? color.slice(1) : color).toUpperCase();

  // Check if valid hex format (3, 4, 6, 8 characters)
  if (!/^[0-9A-F]{3}$|^[0-9A-F]{4}$|^[0-9A-F]{6}$|^[0-9A-F]{8}$/.test(hex)) {
    return null;
  }

  // Parse 3-digit hex (RGB)
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;

    return { r, g, b, a: 1 };
  }

  // Parse 4-digit hex (RGBA)
  if (hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;
    const a = parseInt(hex[3] + hex[3], 16) / 255;

    return { r, g, b, a };
  }

  // Parse 6-digit hex (RRGGBB)
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    return { r, g, b, a: 1 };
  }

  // Parse 8-digit hex (RRGGBBAA)
  if (hex.length === 8) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const a = parseInt(hex.substring(6, 8), 16) / 255;

    return { r, g, b, a };
  }

  return null;
}

/**
 * Convert ColorRGBA to hex color code
 * Returns `RRGGBB` format if alpha is 1, otherwise `RRGGBBAA`
 * @param color ColorRGBA object with values in 0-1 range
 * @param includeHash Whether to include "#" prefix (default: false)
 * @returns Hex color code string
 */
export function toColorCode(
  color: ColorRGBA,
  includeHash: boolean = false
): string {
  // Convert 0-1 range to 0-255 and then to hex
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, "0");

  // Prepare the prefix based on includeHash parameter
  const prefix = includeHash ? "#" : "";

  // If alpha is 1, return without alpha component
  if (color.a === 1) {
    return `${prefix}${r}${g}${b}`.toLowerCase();
  }

  // Otherwise include alpha
  const a = Math.round(color.a * 255)
    .toString(16)
    .padStart(2, "0");
  return `${prefix}${r}${g}${b}${a}`.toLowerCase();
}
