type ResponseListEffects = Array<{
  id: string;
  title: string;
  version: { major: number; minor: number };
}>;

const pluginManager = new (class PluginManager {
  public allEffects: Effect<any>[] = [randomNoiseEffect, blurEffect];

  listEffects(): ResponseListEffects {
    return this.allEffects.map((effect) => ({
      id: effect.id,
      title: effect.title,
      version: effect.version,
    }));
  }
  doLiveEffect() {
    console.log("doLiveEffect");
  }
})();

export const getLiveEffects = () => {
  return pluginManager.listEffects();
};

export const getEffectViewNode = (id: string, state: any): UINode => {
  console.log(id, state);
  const effect = pluginManager.allEffects.find((e) => e.id === id);
  if (!effect) return null;
  return effect.renderUI(state);
};

type ParameterSchema = {
  [name: string]: {
    type: "real" | "int" | "bool" | "string";
    default: any;
  };
};

type UINode =
  | {
      type: "group";
      direction: "horizontal" | "vertical";
      children: UINode[];
    }
  | {
      type: "slider";
      key: string;
      value: number;
    }
  | {
      type: "checkbox";
      key: string;
      checked: boolean;
    }
  | {
      type: "textInput";
      key: string;
      value: string;
    }
  | {
      type: "text";
      text: string;
    }
  | {
      type: "button";
    }
  | null;

type Effect<T extends object> = {
  id: string;
  title: string;
  version: { major: number; minor: number };
  paramSchema: ParameterSchema;
  goLiveEffect: (bitmap: Uint8ClampedArray) => void;
  editLiveEffectParameters: (nextParams: T) => string;
  renderUI: (params: T) => UINode;
};

const ui = {
  group: (
    {
      direction = "vertical",
    }: {
      direction?: "horizontal" | "vertical";
    },
    children: UINode[]
  ): UINode => ({
    type: "group",
    direction,
    children,
  }),
  slider: ({ key, value }: { key: string; value: number }): UINode => ({
    type: "slider",
    key,
    value,
  }),
  checkbox: ({ key, checked }: { key: string; checked: boolean }): UINode => ({
    type: "checkbox",
    key,
    checked,
  }),
  textInput: ({ key, value }: { key: string; value: string }): UINode => ({
    type: "textInput",
    key,
    value,
  }),
  text: ({ text }: { text: string }): UINode => ({
    type: "text",
    text,
  }),
  button: (): UINode => ({
    type: "button",
  }),
};

const randomNoiseEffect: Effect<{}> = {
  id: "randomNoise-v1",
  title: "Random Noise V1",
  version: { major: 1, minor: 0 },
  paramSchema: {},
  goLiveEffect: (input) => {
    console.log("Deno code running", input.byteLength / 4, input);

    // Random color
    for (let i = 0; i < input.length; i += 4) {
      input[i] = Math.random() * 255;
      input[i + 1] = Math.random() * 255;
      input[i + 2] = Math.random() * 255;
      input[i + 3] = i > 2000 ? 0 : 255;
    }
  },
  editLiveEffectParameters: () => "{}",
  renderUI: (params) => ui.group({}, []),
};

const blurEffect: Effect<{ radius: number }> = {
  id: "blur-v1",
  title: "Gausian Blur V1",
  version: { major: 1, minor: 0 },
  paramSchema: {
    radius: {
      type: "real",
      default: 1.0,
    },
  },
  goLiveEffect: (input) => {
    console.log("Deno code running", input.byteLength / 4, input);
  },
  editLiveEffectParameters: (params) => JSON.stringify(params),
  renderUI: (params) =>
    ui.group({ direction: "horizontal" }, [
      ui.text({ text: "Radius" }),
      ui.slider({ key: "radius", value: params.radius }),
    ]),
};
