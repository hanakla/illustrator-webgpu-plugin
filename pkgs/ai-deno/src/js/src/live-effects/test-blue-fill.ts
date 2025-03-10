import { definePlugin, StyleFilterFlag } from "../types.ts";
import { ui } from "../ui/nodes.ts";
import { toPng } from "./utils.ts";
import { paddingImageData } from "./utils.ts";

export const testBlueFill = definePlugin({
  id: "test-blue-fill",
  title: "Test Blue Fill",
  version: { major: 1, minor: 0 },
  liveEffect: {
    paramSchema: {
      useNewBuffer: {
        type: "bool",
        default: false,
      },
      fillOtherChannels: {
        type: "bool",
        default: false,
      },
      padding: {
        type: "int",
        default: 0,
      },
      opacity: {
        type: "real",
        default: 100,
      },
      count: {
        type: "int",
        default: 0,
      },
    },
    styleFilterFlags: {
      main: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    editLiveEffectParameters: (params) => params,
    liveEffectScaleParameters: (params, scaleFactor) => params,
    liveEffectInterpolate: (paramsA, paramsB, t) => paramsA,
    doLiveEffect: async (init, params, input) => {
      let width = input.width;
      let height = input.height;
      let len = input.data.length;

      const alpha = Math.round(255 * (params.opacity / 100));

      let buffer = params.useNewBuffer
        ? Uint8ClampedArray.from(input.data)
        : input.data;

      if (params.padding > 0) {
        const data = await paddingImageData(
          {
            data: buffer,
            width: input.width,
            height: input.height,
          },
          params.padding
        );

        buffer = data.data;
        len = buffer.length;
        width = data.width;
        height = data.height;
      }

      if (params.fillOtherChannels) {
        for (let i = 0; i < len; i += 4) {
          buffer[i] = 0;
          buffer[i + 1] = 0;
          buffer[i + 2] = 255;
          buffer[i + 3] = alpha;
        }
      } else {
        for (let i = 0; i < len; i += 4) {
          buffer[i + 2] = 255;
          buffer[i + 3] = alpha;
        }
      }

      // const png = await toPng({ data: buffer, width, height });
      // Deno.writeFile(
      //   "test-blue-fill.png",
      //   new Uint8Array(await png.arrayBuffer())
      // );

      return {
        data: buffer,
        width,
        height,
      };
    },
    renderUI: (params, setParam) => {
      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.button({
            text: "Test",
            onClick: () => {
              console.log("Hi from TestBlueFill");
              setParam((prev) => {
                console.log("prev params", prev);
                return { count: prev.count + 1 };
              });
            },
          }),
          ui.text({ text: `Count: ${params.count}` }),
        ]),

        // ui.text({ text: "Use new buffer" }),
        ui.checkbox({
          label: "Use new buffer",
          key: "useNewBuffer",
          value: params.useNewBuffer,
        }),

        // ui.text({ text: "Fill other channels" }),
        ui.checkbox({
          label: "Fill other channels",
          key: "fillOtherChannels",
          value: params.fillOtherChannels,
        }),

        ui.text({ text: "Padding" }),
        ui.slider({
          label: "Padding",
          key: "padding",
          dataType: "int",
          min: 0,
          max: 100,
          value: params.padding,
        }),

        ui.text({ text: "Opacity" }),
        ui.slider({
          label: "Opacity",
          key: "opacity",
          dataType: "float",
          min: 0,
          max: 100,
          value: params.opacity,
        }),
      ]);
    },
  },
});
