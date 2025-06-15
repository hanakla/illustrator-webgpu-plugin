/// <reference path="../../ext/js/ai_extension.js.d.ts" />

import {
  AIEffectPlugin,
  AIPlugin,
  LiveEffectEnv,
  ColorRGBA,
} from "./plugin.ts";
import { expandGlobSync, ensureDirSync } from "jsr:@std/fs@1.0.14";
import { toFileUrl, join, fromFileUrl } from "jsr:@std/path@1.0.8";
import { isEqual } from "jsr:@es-toolkit/es-toolkit@1.33.0";
import { homedir } from "node:os";

import { chromaticAberration } from "./live-effects/stylize-chromatic-aberration.ts";
import { testBlueFill } from "./live-effects/test-blue-fill.ts";
import { ChangeEventHandler, ui, UINode, UI_NODE_SCHEMA } from "./ui/nodes.ts";
import { directionalBlur } from "./live-effects/blur-directional.ts";
import {
  kirakiraBlur1,
  kirakiraBlur1_1,
} from "./live-effects/blur-kirakira.ts";
import { dithering } from "./live-effects/stylize-dithering.ts";
import { pixelSort } from "./live-effects/pixel-sort.ts";
import { glitch } from "./live-effects/distortion-glitch.ts";
import { logger } from "./logger.ts";
import { outline } from "./live-effects/stylize-outline.ts";
import { innerGlow } from "./live-effects/stylize-inner-glow.ts";
import { coastic } from "./live-effects/other-coastic.ts";
import { halftone } from "./live-effects/stylize-halftone.ts";
import { fluidDistortion } from "./live-effects/distortion-fluid.ts";
import { kaleidoscope } from "./live-effects/kaleidoscope.ts";
import { vhsInterlace } from "./live-effects/stylize-vhs-interlace.ts";
import { downsampler } from "./live-effects/distortion-downsampler.ts";
import { waveDistortion } from "./live-effects/distortion-wave.ts";
import { selectiveColorCorrection } from "./live-effects/color-selective-correction.ts";
import { posterization } from "./live-effects/color-posterization.ts";
import { dataMosh } from "./live-effects/data-mosh.ts";
import { gaussianBlur } from "./live-effects/blur-gaussian.ts";
import { brushStroke } from "./live-effects/stylize-blush-stroke.ts";
import { paperTexture } from "./live-effects/texture-paper.ts";
import { paperTextureV2 } from "./live-effects/texture-paper-v2.ts";
import { comicTone } from "./live-effects/stylize-comic-tone.ts";
import { gradientMap } from "./live-effects/color-gradient-map.ts";
import { husky } from "./live-effects/husky.ts";
import { bloom } from "./live-effects/blur-bloom.ts";
import { spraying } from "./live-effects/distortion-spraying.ts";
import { oilPainting } from "./live-effects/wips/color-oil-painting.ts";

const EFFECTS_DIR = new URL(toFileUrl(join(homedir(), ".ai-deno/effects")));

const collator = new Intl.Collator(
  _AI_DENO_.op_ai_deno_get_user_locale().replace(/_/g, "-")
);

const allPlugins: AIPlugin<any, any, any>[] = [
  brushStroke,
  bloom,
  chromaticAberration,
  coastic,
  comicTone,
  dataMosh,
  directionalBlur,
  dithering,
  downsampler,
  fluidDistortion,
  gaussianBlur,
  glitch,
  gradientMap,
  halftone,
  husky,
  // innerGlow,
  kaleidoscope,
  kirakiraBlur1,
  kirakiraBlur1_1,
  outline,
  paperTexture,
  paperTextureV2,
  // pixelSort,
  selectiveColorCorrection,
  spraying,
  testBlueFill,
  vhsInterlace,
  waveDistortion,
  posterization,
  oilPainting,
].sort((a, b) => {
  const isLegacyA = a.title.startsWith("Legacy");
  const isLegacyB = b.title.startsWith("Legacy");
  if (isLegacyA && !isLegacyB) return -1;
  if (!isLegacyA && isLegacyB) return 1;

  if (
    a.liveEffect?.subCategory &&
    b.liveEffect?.subCategory &&
    a.liveEffect.subCategory !== b.liveEffect.subCategory
  ) {
    const cmp = collator.compare(
      a.liveEffect.subCategory,
      b.liveEffect.subCategory
    );

    // "Other"カテゴリは一番最初に来るようにする
    // (あんまり使わなさそうだからアクセスしづらいところに)
    if (
      a.liveEffect.subCategory === "Other" &&
      b.liveEffect.subCategory !== "Other"
    )
      return -1;

    if (
      a.liveEffect.subCategory !== "Other" &&
      b.liveEffect.subCategory === "Other"
    )
      return 1;

    return cmp;
  }

  return collator.compare(a.title, b.title);
});

const effectInits = new Map<AIPlugin<any, any, any>, any>();

const allEffectPlugins: Record<
  string,
  AIEffectPlugin<any, any, any>
> = Object.fromEntries(
  allPlugins
    .filter((p): p is AIEffectPlugin<any, any, any> => !!p.liveEffect)
    .map((p) => [p.id, p])
);

// Initialize effects at Startup of Illustrator
try {
  await Promise.all(
    Object.values(allEffectPlugins).map(
      async (effect: AIEffectPlugin<any, any, any>) => {
        return retry(6, async () => {
          try {
            effectInits.set(
              effect,
              (await effect.liveEffect.initLiveEffect?.()) ?? {}
            );
          } catch (e) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            throw new Error(
              `[effect: ${effect.id}] Failed to initialize effect: ${e.message}\n`,
              {
                cause: e,
              }
            );
          }
        });
      }
    )
  );
} catch (e) {
  console.error(e);

  if (e instanceof AggregateError) {
    const _e: AggregateError = e as unknown as AggregateError;
    const logs = _e.errors.map((e: Error) => `${e.message}`).join("\n");
    _AI_DENO_.op_ai_alert("[AiDeno] Failed to initialize effects\n\n" + logs);
  }
}

export async function loadEffects() {
  ensureDirSync(EFFECTS_DIR);

  logger.log("loadEffects", `${fromFileUrl(EFFECTS_DIR)}/*/meta.json`);
  const metas = [
    ...expandGlobSync(`${fromFileUrl(EFFECTS_DIR)}/*/meta.json`, {
      followSymlinks: true,
      includeDirs: false,
    }),
  ];

  logger.log("loadEffects metas", metas);

  await Promise.allSettled(
    metas.map((dir) => {
      logger.log("dir", dir);
      // const pkgDir = join(fromFileUrl(EFFECTS_DIR), dir.name);
    })
  );
}

export function getLiveEffects(): Array<{
  id: string;
  title: string;
  version: { major: number; minor: number };
}> {
  logger.log("allEffectPlugins", allEffectPlugins);

  return Object.values(allEffectPlugins).map((effect) => ({
    id: effect.id,
    title: effect.title,
    version: effect.version,
  }));
}

type NodeState = {
  effectId: string;
  nodeMap: Map<string, UINode>;
  latestParams: any;
  state: any;
};

// Holding latest editor tree and state
let nodeState: NodeState | null = null;

export function getEffectViewNode(effectId: string, params: any): UINode {
  const effect = findEffect(effectId);
  if (!effect) return null;

  params = getParams(effectId, params);
  params = effect.liveEffect.onEditParameters?.(params) ?? params;

  let localNodeState: NodeState | null = null;

  const setParam = (update: Partial<any> | ((prev: any) => any)) => {
    if (!localNodeState) {
      throw new Error("Unpextected null localNodeState");
    }

    const clone = structuredClone(localNodeState.latestParams);
    let patch: Partial<any> | null = null;
    if (typeof update === "function") {
      patch = update(Object.freeze(clone));
    } else {
      patch = update;
    }

    const next = Object.assign({}, localNodeState.latestParams, patch);
    console.log({ clone, patch });

    // Normalize parameters
    localNodeState.latestParams = editLiveEffectParameters(effectId, next);
  };

  const useStateObject = <T>(initialState: T) => {
    if (!localNodeState) {
      throw new Error("Unpextected null localNodeState");
    }

    localNodeState.state ??= initialState;

    const setState = (update: Partial<T> | ((prev: T) => T)) => {
      if (!localNodeState) {
        throw new Error("Unpextected null localNodeState");
      }

      if (typeof update === "function") {
        update = update(Object.freeze(localNodeState.state));
      }

      localNodeState.state = Object.assign({}, localNodeState.state, update);
    };

    return [localNodeState.state, setState] as const;
  };

  try {
    nodeState = localNodeState = {
      effectId: effect.id,
      nodeMap: null as any,
      latestParams: params,
      state: undefined,
    };

    let tree = effect.liveEffect.renderUI(params, { setParam, useStateObject });

    tree = ui.group({ direction: "col" }, [
      tree,
      ui.separator(),
      ui.group({ direction: "row" }, [
        ui.text({
          size: "sm",
          text: `AiDeno: ${_AI_DENO_.op_ai_get_plugin_version()} Plugin: ${
            effect.version.major
          }.${effect.version.minor}`,
        }),
      ]),
    ]);

    const nodeMap = attachNodeIds(tree);
    localNodeState.nodeMap = nodeMap;

    // const parseResult = UI_NODE_SCHEMA.safeParse(tree);
    // if (!parseResult.success) {
    //   logger.error(
    //     "Invalid UI tree",
    //     parseResult.error.message,
    //     parseResult.error.errors
    //   );
    // }

    return tree;
  } catch (e) {
    logger.error(e);
    throw e;
  }
}

export function editLiveEffectParameters(id: string, params: any) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);

  params = getParams(id, params);

  return effect.liveEffect.onEditParameters?.(params) ?? params;
}

export async function editLiveEffectFireCallback(
  effectId: string,
  event: {
    type: "click" | "change";
    nodeId: string;
    value: any;
  },
  params: any
): Promise<{ updated: false } | { updated: true; params: any; tree: UINode }> {
  const effect = findEffect(effectId);
  const node = nodeState?.nodeMap.get(event.nodeId);

  if (!effect || !node || !nodeState || nodeState.effectId !== effectId) {
    return {
      updated: false,
    };
  }

  logger.log("Fire event callback", { effectId, event, params });

  nodeState.latestParams = structuredClone(params);
  const current = params;
  switch (event.type) {
    case "click": {
      if ("onClick" in node && typeof node.onClick === "function")
        await node.onClick({ type: "click" });
      break;
    }
    case "change": {
      if ("onChange" in node && typeof node.onChange === "function") {
        await (node.onChange as ChangeEventHandler)({
          type: "change",
          value: event.value,
        });
      }
    }
  }

  if (isEqual(current, nodeState.latestParams)) {
    return {
      updated: false,
    };
  }

  return {
    updated: true,
    params: nodeState.latestParams,
    tree: getEffectViewNode(effectId, nodeState.latestParams),
  };
}

function attachNodeIds(node: UINode) {
  const nodeMap = new Map<string, UINode>();

  const traverseNode = (
    node: (UINode & { nodeId?: string }) | null,
    nodeId: string = ""
  ) => {
    if (node == null) return;

    node.nodeId = nodeId;
    nodeMap.set(nodeId, node);

    if (node.type === "group") {
      node.children.forEach((child, index) => {
        if (child == null) return;
        traverseNode(child, `${node.nodeId}.${index}-${child.type}`);
      });
    }
  };

  traverseNode(node, ".root");

  return nodeMap;
}

/**
 * Handler of `LiveEffectAdjustColors`
 */
export function liveEffectAdjustColors(
  id: string,
  params: any,
  adjustCallback: (color: ColorRGBA) => ColorRGBA
): {
  hasChanged: boolean;
  params: any;
} {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);

  params = structuredClone(getParams(id, params));

  const result = effect.liveEffect.onAdjustColors(params, adjustCallback);

  return {
    hasChanged: !isEqual(result, params),
    params: result,
  };
}

export function liveEffectScaleParameters(
  id: string,
  params: any,
  scaleFactor: number
) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);

  params = getParams(id, params);

  const result = effect.liveEffect.onScaleParams(params, scaleFactor);

  return {
    hasChanged: result != null,
    params: result ?? params,
  };
}

export function liveEffectInterpolate(
  id: string,
  params: any,
  params2: any,
  t: number
) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);

  params = getParams(id, params);
  params2 = getParams(id, params2);

  return effect.liveEffect.onInterpolate(params, params2, t);
}

export const goLiveEffect = async (
  id: string,
  params: any,
  env: LiveEffectEnv,
  width: number,
  height: number,
  data: Uint8ClampedArray
) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultParams = getDefaultValus(id);

  const init = effectInits.get(effect);
  if (!init) {
    logger.error("Effect not initialized", id);
    return null;
  }

  logger.log("goLiveEffect", { id, input: { width, height }, env, params });
  logger.log("--- LiveEffect Logs ---");
  try {
    const input = {
      data,
      width,
      height,
    };

    const result = await effect.liveEffect.goLiveEffect(
      init,
      {
        ...defaultParams,
        ...params,
      },
      input,
      {
        ...env,
      }
    );

    if (
      typeof result.width !== "number" ||
      typeof result.height !== "number" ||
      !(result.data instanceof Uint8ClampedArray)
    ) {
      throw new Error("Invalid result from goLiveEffect");
    }

    return result;
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

function getParams(effectId: string, state: any) {
  const effect = findEffect(effectId);
  if (!effect) return null;

  const defaultValues = getDefaultValus(effectId);
  return {
    ...defaultValues,
    ...state,
  };
}

const getDefaultValus = (effectId: string) => {
  const effect = findEffect(effectId);
  if (!effect) return null;
  return Object.fromEntries(
    Object.entries(effect.liveEffect.paramSchema).map(([key, value]) => [
      key,
      structuredClone(value.default),
    ])
  );
};

function findEffect(id: string) {
  const effect = allEffectPlugins[id];
  if (!effect) logger.error(`Effect not found: ${id}`);
  return effect;
}

async function retry(maxRetries: number, fn: () => any): Promise<void> {
  const errors: any[] = [];

  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (e) {
      errors.push(e);
      retries++;
    }
  }

  throw new AggregateError(errors, "All retries failed");
}
