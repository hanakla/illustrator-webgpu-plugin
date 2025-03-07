import path from "node:path";
import { defineConfig } from "vite";
import deno from "@deno/vite-plugin";

export default defineConfig({
  // root: "effect-checker",
  plugins: [deno()],
  resolve: {
    external: ["jsr:@gfx/canvas"],
    alias: {
      "~ext": path.resolve(__dirname, "../src/js/src"),
    },
  },
});
