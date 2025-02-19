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
    const buffer = input.buffer;
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

export const blurEffect: Effect<{ radius: number }> = {
  id: "blur-v1",
  title: "Gausian Blur V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: StyleFilterFlag.kPostEffectFilter,
    features: [],
  },
  paramSchema: {
    radius: {
      type: "real",
      default: 1.0,
    },
  },
  doLiveEffect: async (params, input) => {
    console.log("Deno code running", input.buffer.byteLength / 4, input);
    return input;
  },
  editLiveEffectParameters: (params) => JSON.stringify(params),
  renderUI: (params) =>
    ui.group({ direction: "horizontal" }, [
      ui.text({ text: "Radius" }),
      ui.slider({
        key: "radius",
        label: "Radius",
        dataType: "float",
        min: 0,
        max: 400,
        value: params.radius ?? 1,
      }),
    ]),
};
