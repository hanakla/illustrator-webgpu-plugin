import { AIEffectPlugin, AIPlugin } from "./types.ts";
import { expandGlobSync, ensureDirSync } from "jsr:@std/fs@1.0.14";
import { toFileUrl, join, fromFileUrl } from "jsr:@std/path@1.0.8";
import { isEqual } from "jsr:@es-toolkit/es-toolkit@1.33.0";
import { homedir } from "node:os";

// import { blurEffect } from "./live-effects/blurEffect.ts";
import { chromaticAberration } from "./live-effects/chromatic-aberration.ts";
import { testBlueFill } from "./live-effects/test-blue-fill.ts";
import { UINode } from "./ui/nodes.ts";
import { directionalBlur } from "./live-effects/directional-blur.ts";
import { glow } from "./live-effects/glow.ts";
import { dithering } from "./live-effects/dithering.ts";

const EFFECTS_DIR = new URL(toFileUrl(join(homedir(), ".ai-deno/effects")));

const allPlugins: AIPlugin<any, any>[] = [
  // randomNoiseEffect,
  // blurEffect,
  glow,
  dithering,
  chromaticAberration,
  directionalBlur,
  testBlueFill,
];
const effectInits = new Map<AIPlugin<any, any>, any>();

const allEffectPlugins: Record<
  string,
  AIEffectPlugin<any, any>
> = Object.fromEntries(
  allPlugins
    .filter((p): p is AIEffectPlugin<any, any> => !!p.liveEffect)
    .map((p) => [p.id, p])
);

// Initialize effects at Startup of Illustrator
await Promise.all(
  Object.values(allEffectPlugins).map(
    async (effect: AIEffectPlugin<any, any>) => {
      await retry(3, async () => {
        effectInits.set(
          effect,
          (await effect.liveEffect.initLiveEffect?.()) ?? {}
        );
      });
    }
  )
);

export async function loadEffects() {
  ensureDirSync(EFFECTS_DIR);

  console.log(
    "[deno_ai(js)] loadEffects",
    `${fromFileUrl(EFFECTS_DIR)}/*/meta.json`
  );
  const metas = [
    ...expandGlobSync(`${fromFileUrl(EFFECTS_DIR)}/*/meta.json`, {
      followSymlinks: true,
      includeDirs: false,
    }),
  ];

  console.log("[deno_ai(js)] loadEffects metas", metas);

  await Promise.allSettled(
    metas.map((dir) => {
      console.log("dir", dir);
      // const pkgDir = join(fromFileUrl(EFFECTS_DIR), dir.name);
    })
  );
}

export function getLiveEffects(): Array<{
  id: string;
  title: string;
  version: { major: number; minor: number };
}> {
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
};

// Holding latest editor tree and state
let nodeState: NodeState | null = null;

export function getEffectViewNode(id: string, params: any): UINode {
  const effect = findEffect(id);
  if (!effect) return null;

  params = getParams(id, params);
  params = effect.liveEffect.editLiveEffectParameters?.(params) ?? params;

  let localNodeState: NodeState | null = null;

  const setParam = (update: Partial<any> | ((prev: any) => any)) => {
    if (!localNodeState) {
      throw new Error("Unextected null localNodeState");
    }

    const clone = structuredClone(localNodeState.latestParams);
    if (typeof update === "function") {
      update = update(Object.freeze(clone));
    }

    const next = Object.assign({}, localNodeState.latestParams, update);

    // Normalize parameters
    localNodeState.latestParams = editLiveEffectParameters(id, next);
  };

  try {
    const tree = effect.liveEffect.renderUI(params, setParam);
    const nodeMap = attachNodeIds(tree);
    nodeState = localNodeState = {
      effectId: effect.id,
      nodeMap,
      latestParams: params,
    };
    return tree;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export function editLiveEffectParameters(id: string, params: any) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);

  params = getParams(id, params);

  return effect.liveEffect.editLiveEffectParameters?.(params) ?? params;
}

export async function editLiveEffectFireCallback(
  effectId: string,
  event: {
    type: "click" | "change";
    nodeId: string;
  }
): Promise<{ updated: false } | { updated: true; params: any }> {
  const effect = findEffect(effectId);
  const node = nodeState?.nodeMap.get(event.nodeId);

  if (!effect || !node || !nodeState || nodeState.effectId !== effectId) {
    return {
      updated: false,
    };
  }

  const current = nodeState.latestParams;
  switch (event.type) {
    case "click": {
      if ("onClick" in node && typeof node.onClick === "function")
        await node.onClick?.({ type: "click" });
      break;
    }
    // case "change":
    //   node.onChange?.(event.key, event.value);
    //   break;
  }

  if (isEqual(current, nodeState.latestParams)) {
    return {
      updated: false,
    };
  }

  return {
    updated: true,
    params: nodeState.latestParams,
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

export function liveEffectScaleParameters(
  id: string,
  params: any,
  scaleFactor: number
) {
  const effect = findEffect(id);
  if (!effect) throw new Error(`Effect not found: ${id}`);

  params = getParams(id, params);

  const result = effect.liveEffect.liveEffectScaleParameters(
    params,
    scaleFactor
  );

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

  return effect.liveEffect.liveEffectInterpolate(params, params2, t);
}

export const doLiveEffect = async (
  id: string,
  state: any,
  width: number,
  height: number,
  data: Uint8ClampedArray
) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);

  const init = effectInits.get(effect);
  if (!init) {
    console.error("Effect not initialized", id);
    return null;
  }

  console.log("[deno_ai(js)] doLiveEffect", id, state, width, height);
  try {
    const result = await effect.liveEffect.doLiveEffect(
      init,
      {
        ...defaultValues,
        ...state,
      },
      {
        width,
        height,
        data,
      }
    );

    if (
      typeof result.width !== "number" ||
      typeof result.height !== "number" ||
      !(result.data instanceof Uint8ClampedArray)
    ) {
      throw new Error("Invalid result from doLiveEffect");
    }

    return result;
  } catch (e) {
    console.error(e);
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
  if (!effect) console.error(`Effect not found: ${id}`);
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

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new AggregateError(errors, "All retries failed");
}
