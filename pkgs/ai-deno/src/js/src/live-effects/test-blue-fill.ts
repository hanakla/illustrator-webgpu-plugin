import { toFileUrl, join } from "jsr:@std/path@1.0.8";
import { definePlugin, StyleFilterFlag } from "../plugin.ts";
import { ui } from "../ui/nodes.ts";
import { toPng } from "./_utils.ts";
import { paddingImageData } from "./_utils.ts";

const global: {
  lastInput: {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  } | null;
  inputSize: { width: number; height: number } | null;
} = {
  lastInput: null,
  inputSize: null,
};

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
      color: {
        type: "color",
        default: { r: 0, g: 0, b: 1, a: 1 },
      },
      fillOtherChannels: {
        type: "bool",
        default: false,
      },
      passThrough: {
        type: "bool",
        default: false,
      },
      fullTransparent: {
        type: "bool",
        default: false,
      },
      halfFill: {
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
      type: StyleFilterFlag.kPostEffectFilter,
      features: [],
    },
    onAdjustColors: (params, adjustColor) => params,
    onEditParameters: (params) => params,
    onScaleParams: (params, scaleFactor) => params,
    onInterpolate: (paramsA, paramsB, t) => paramsA,
    goLiveEffect: async (init, params, input, env) => {
      console.log("[test-blue-fill] goLiveEffect", { params, env });

      let width = input.width;
      let height = input.height;
      let len = input.data.length;

      global.lastInput = {
        data: Uint8ClampedArray.from(input.data),
        width,
        height,
      };
      global.inputSize = { width, height };

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

      if (params.passThrough) {
        return {
          data: buffer,
          width,
          height,
        };
      }

      if (params.fullTransparent) {
        for (let i = 0; i < len; i += 4) {
          buffer[i + 3] = 0;
        }

        return {
          data: buffer,
          width,
          height,
        };
      }

      const start = params.halfFill ? Math.ceil((height * (width * 4)) / 2) : 0;

      if (params.fillOtherChannels) {
        for (let i = start; i < len; i += 4) {
          buffer[i] = 0;
          buffer[i + 1] = 0;
          buffer[i + 2] = 255;
          buffer[i + 3] = alpha;
        }
      } else {
        for (let i = start; i < len; i += 4) {
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
    renderUI: (params, { setParam }) => {
      const onClickSaveInputAsPng = async () => {
        if (!global.lastInput) {
          _AI_DENO_.op_ai_alert("No input data");
          return;
        }

        const path = new URL(
          "./test-blue-fill.png",
          toFileUrl(join(Deno.cwd(), "./"))
        );
        const png = await toPng(global.lastInput);
        Deno.writeFile(path, new Uint8Array(await png.arrayBuffer()));

        _AI_DENO_.op_ai_alert(`Saved to ${path}`);
      };

      return ui.group({ direction: "col" }, [
        ui.group({ direction: "row" }, [
          ui.button({
            text: "Update view",
            onClick: () => {
              setParam((prev) => {
                return { count: prev.count + 1 };
              });
            },
          }),

          ui.button({
            text: "Save input as PNG",
            onClick: onClickSaveInputAsPng,
          }),

          ui.button({
            text: "Alert",
            onClick: () => {
              console.log("Hello");
            },
          }),
        ]),

        ui.group({ direction: "row" }, [
          ui.text({
            text: `Input: ${global.inputSize?.width}x${global.inputSize?.height}`,
          }),

          ui.text({ text: `Count: ${params.count}` }),
        ]),

        ui.group({ direction: "row" }, [
          // ui.text({ text: "Use new buffer" }),
          ui.checkbox({
            label: "Use new buffer",
            key: "useNewBuffer",
            value: params.useNewBuffer,
          }),

          // ui.text({ text: "Fill other channels" }),
          ui.checkbox({
            key: "fillOtherChannels",
            label: "Fill other channels",
            value: params.fillOtherChannels,
          }),
        ]),

        ui.group({ direction: "row" }, [
          ui.checkbox({
            key: "passThrough",
            label: "Pass through",
            value: params.passThrough,
          }),

          ui.checkbox({
            key: "fullTransparent",
            label: "Full transparent",
            value: params.fullTransparent,
          }),
        ]),

        ui.text({ text: "Color" }),
        ui.colorInput({
          key: "color",
          value: params.color,
        }),

        ui.text({ text: "Padding" }),
        ui.group({ direction: "row" }, [
          ui.slider({
            key: "padding",
            dataType: "int",
            min: 0,
            max: 100,
            value: params.padding,
          }),
          ui.numberInput({
            dataType: "int",
            key: "padding",
            value: params.padding,
            min: 0,
            max: 100,
            step: 1,
          }),
        ]),

        ui.text({ text: "Opacity" }),
        ui.slider({
          key: "opacity",
          dataType: "float",
          min: 0,
          max: 100,
          value: params.opacity,
        }),

        ui.textInput({ value: "Hello" }),
      ]);
    },
  },
});
