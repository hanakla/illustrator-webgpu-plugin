import { createCanvas } from "npm:@napi-rs/canvas";

const bitmap = JSON.parse(await Deno.readTextFile(Deno.args[0]));

const canvas = createCanvas(bitmap.width, bitmap.height);
const ctx = canvas.getContext("2d");

const imageData = ctx.createImageData(bitmap.width, bitmap.height);
imageData.data.set(new Uint8ClampedArray(bitmap.data));

ctx.putImageData(imageData, 0, 0);

const png = canvas.toBuffer("image/png");
await Deno.writeFile(new URL("../output.png", import.meta.url), png);
