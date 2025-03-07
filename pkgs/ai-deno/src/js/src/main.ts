import { blurEffect } from "./live-effects/blurEffect.ts";
import { chromaticAberration } from "./live-effects/chromatic-aberration.ts";
import { randomNoiseEffect } from "./live-effects/effects.ts";
import { toPng } from "./live-effects/utils.ts";
import { Effect, UINode } from "./types.ts";
import { expandGlobSync, ensureDir, ensureDirSync } from "jsr:@std/fs@1.0.14";
import { toFileUrl, join, fromFileUrl } from "jsr:@std/path@1.0.8";
import { homedir } from "node:os";

const EFFECTS_DIR = new URL(toFileUrl(join(homedir(), ".ai-deno/effects")));

const allEffects: Effect<any, any>[] = [
  randomNoiseEffect,
  blurEffect,
  chromaticAberration,
];
const effectInits = new Map<Effect<any, any>, any>();

await Promise.all(
  allEffects.map(async (effect) => {
    effectInits.set(effect, await effect.initDoLiveEffect?.());
  })
);

export const loadEffects = async () => {
  console.log("[deno_ai(js)] loadEffects", EFFECTS_DIR);
  await ensureDirSync(EFFECTS_DIR);
  console.log("[deno_ai(js)] loadEffects ensuredir");

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
};

export const getLiveEffects = (): Array<{
  id: string;
  title: string;
  version: { major: number; minor: number };
}> => {
  return allEffects.map((effect) => ({
    id: effect.id,
    title: effect.title,
    version: effect.version,
  }));
};

export const getEffectViewNode = (id: string, state: any): UINode => {
  const effect = findEffect(id);
  if (!effect) return null;

  console.log("getEffectViewNode", id, state);
  const defaultValues = getDefaultValus(id);

  try {
    return effect.renderUI({
      ...defaultValues,
      ...state,
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
};

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

  console.log(Deno.cwd());
  Deno.writeFileSync(
    "buffer.png",
    Uint8Array.from([
      ...new Uint8Array(
        await (await toPng({ data, width, height })).arrayBuffer()
      ),
    ])
  );

  console.log("[deno_ai(js)] doLiveEffect", id, state, width, height);
  try {
    const result = await effect.doLiveEffect(
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

const getDefaultValus = (effectId: string) => {
  const effect = findEffect(effectId);
  if (!effect) return null;
  return Object.fromEntries(
    Object.entries(effect.paramSchema).map(([key, value]) => [
      key,
      structuredClone(value.default),
    ])
  );
};

const findEffect = (id: string) => {
  const effect = allEffects.find((e) => e.id === id);
  if (!effect) console.error(`Effect not found: ${id}`);
  return effect;
};
