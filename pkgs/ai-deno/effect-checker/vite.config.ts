import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // root: "effect-checker",
  plugins: [
    {
      name: "ignore-jsr-imports",
      resolveId(id) {
        if (id.startsWith("jsr:")) {
          return {
            id: "data:text/javascript,export default {}",
            external: true,
          };
        }
      },
    },
  ],
  resolve: {
    external: ["jsr:@gfx/canvas"],
    alias: {
      "~ext": path.resolve(__dirname, "../src/js/src"),
    },
  },
});
