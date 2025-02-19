import { blurEffect, randomNoiseEffect } from "./live-effects/effects.ts";
import { Effect, UINode } from "./types.ts";

const allEffects: Effect<any>[] = [randomNoiseEffect, blurEffect];

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
  const defaultValues = getDefaultValus(id);
  return effect.renderUI({
    ...defaultValues,
    ...state,
  });
};

export const doLiveEffect = (
  id: string,
  state: any,
  data: Uint8ClampedArray
) => {
  const effect = findEffect(id);
  if (!effect) return null;
  const defaultValues = getDefaultValus(id);

  return effect.doLiveEffect(
    {
      ...defaultValues,
      ...state,
    },
    data
  );
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
  return allEffects.find((e) => e.id === id);
};
