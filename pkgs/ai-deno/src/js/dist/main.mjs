// src/js/src/ui.ts
var ui = {
  group: ({ direction = "horizontal" }, children) => ({
    type: "group",
    direction,
    children
  }),
  slider: (props) => ({
    ...props,
    type: "slider"
  }),
  checkbox: (props) => ({
    ...props,
    type: "checkbox"
  }),
  textInput: (props) => ({
    ...props,
    type: "textInput"
  }),
  text: (props) => ({
    ...props,
    type: "text"
  }),
  button: (props) => ({
    ...props,
    type: "button"
  })
};

// src/js/src/live-effects/effects.ts
var randomNoiseEffect = {
  id: "randomNoise-v1",
  title: "Random Noise V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: 2 /* kPostEffectFilter */,
    features: []
  },
  paramSchema: {},
  doLiveEffect: async (params, input) => {
    const buffer = input.buffer;
    console.log("Deno code running", buffer.byteLength / 4, buffer);
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = Math.random() * 255;
      buffer[i + 1] = Math.random() * 255;
      buffer[i + 2] = Math.random() * 255;
      buffer[i + 3] = i > 2e3 ? 0 : 255;
    }
    return input;
  },
  editLiveEffectParameters: () => "{}",
  renderUI: (params) => ui.group({}, [])
};
var blurEffect = {
  id: "blur-v1",
  title: "Gausian Blur V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: 2 /* kPostEffectFilter */,
    features: []
  },
  paramSchema: {
    radius: {
      type: "real",
      default: 1
    }
  },
  doLiveEffect: async (params, input) => {
    console.log("Deno code running", input.buffer.byteLength / 4, input);
    return input;
  },
  editLiveEffectParameters: (params) => JSON.stringify(params),
  renderUI: (params) => ui.group({ direction: "horizontal" }, [
    ui.text({ text: "Radius" }),
    ui.slider({
      key: "radius",
      label: "Radius",
      dataType: "float",
      min: 0,
      max: 400,
      value: params.radius ?? 1
    })
  ])
};

// src/js/src/main.ts
var allEffects = [randomNoiseEffect, blurEffect];
var getLiveEffects = () => {
  return allEffects.map((effect) => ({
    id: effect.id,
    title: effect.title,
    version: effect.version
  }));
};
var getEffectViewNode = (id, state) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);
  return effect.renderUI({
    ...defaultValues,
    ...state
  });
};
var doLiveEffect = (id, state, data) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);
  return effect.doLiveEffect(
    {
      ...defaultValues,
      ...state
    },
    data
  );
};
var getDefaultValus = (effectId) => {
  const effect = findEffect(effectId);
  if (!effect) return null;
  return Object.fromEntries(
    Object.entries(effect.paramSchema).map(([key, value]) => [
      key,
      structuredClone(value.default)
    ])
  );
};
var findEffect = (id) => {
  return allEffects.find((e) => e.id === id);
};
export {
  doLiveEffect,
  getEffectViewNode,
  getLiveEffects
};
