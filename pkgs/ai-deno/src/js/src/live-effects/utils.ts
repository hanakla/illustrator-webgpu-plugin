const createCanvasImpl =
  typeof window === "undefined"
    ? async (width: number, height: number) => {
        const { createCanvas } = await import("jsr:@gfx/canvas");
        return createCanvas(width, height);
      }
    : (width: number, height: number) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
      };

const createImageDataImpl =
  typeof window === "undefined"
    ? async (
        data: Uint8ClampedArray,
        width: number,
        height: number,
        settings?: ImageDataSettings
      ) => {
        const { ImageData } = await import("jsr:@gfx/canvas");
        return new ImageData(
          data,
          width,
          height,
          settings
        ) as globalThis.ImageData;
      }
    : (
        data: Uint8ClampedArray,
        width: number,
        height: number,
        settings?: ImageDataSettings
      ) => {
        return new ImageData(data, width, height, settings);
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
  const canvas = createCanvasImpl(data.width, data.height);
  const ctx = canvas.getContext("2d")!;
  const imgData = createImageDataImpl(data.data, data.width, data.height, {
    colorSpace: "srgb",
  });
  ctx.putImageData(imgData, 0, 0);

  const resizedCanvas = createCanvasImpl(width, height);
  const resizedCtx = resizedCanvas.getContext("2d")!;
  resizedCtx.drawImage(canvas, 0, 0, width, height);

  return resizedCtx.getImageData(0, 0, width, height);
}
