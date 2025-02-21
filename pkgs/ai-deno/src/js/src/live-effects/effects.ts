import { Effect, StyleFilterFlag } from "../types.ts";
import { ui } from "../ui.ts";

export const randomNoiseEffect: Effect<{}> = {
  id: "randomNoise-v1",
  title: "Random Noise V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: StyleFilterFlag.kPostEffectFilter,
    features: [],
  },
  paramSchema: {},
  doLiveEffect: async (params, input) => {
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
  editLiveEffectParameters: () => "{}",
  renderUI: (params) => ui.group({}, []),
};
