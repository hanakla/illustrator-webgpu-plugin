import { defineConfig } from "tsup";

export default defineConfig({
  external: [/^npm:/, /^node:/, /^jsr:/, /^https?:/],
});
