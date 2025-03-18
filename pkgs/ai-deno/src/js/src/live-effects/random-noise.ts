// import { createCanvas } from "npm:@napi-rs/canvas@0.1.68";
import { definePlugin, StyleFilterFlag } from "../types.ts";
import { ui } from "../ui/nodes.ts";

export const randomNoiseEffect = definePlugin({
  id: "randomNoise-v1",
  title: "Random Noise V1",
  version: { major: 1, minor: 0 },
  liveEffect: {
    styleFilterFlags: {
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    paramSchema: {},
    goLiveEffect: async (init, params, input, env) => {
      const buffer = input.data;
      console.log("Deno code running", buffer.byteLength / 4, buffer);

      // Random color
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = Math.random() * 255;
        buffer[i + 1] = Math.random() * 255;
        buffer[i + 2] = Math.random() * 255;
        buffer[i + 3] = i > 2000 ? 0 : 255;
      }

      return input;
    },
    onAdjustColors: (params, adjustColor) => params,
    onScaleParams: (params, scaleFactor) => params,
    onInterpolate: (params, params2, t) => params,
    onEditParameters: (params) => params,
    renderUI: (params) => ui.group({}, []),
  },
});
