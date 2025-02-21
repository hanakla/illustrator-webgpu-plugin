import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // root: "effect-checker",
  resolve: {
    alias: {
      "~ext": path.resolve(__dirname, "../src/js/src"),
    },
  },
});
