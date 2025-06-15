import path from "node:path";
import { defineConfig } from "vite";
import deno from "@deno/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // root: "effect-checker",
  plugins: [deno(), tailwindcss()],
  resolve: {
    external: ["jsr:@gfx/canvas"],
    alias: {
      "npm:@hanakla/svg-variable-width-line":
        "@hanakla/svg-variable-width-line",
      "npm:webgpu-utils": "webgpu-utils",
      "npm:zod@3.24.2": "zod",
      "~ext": path.resolve(__dirname, "../src/js/src"),
    },
  },
});
