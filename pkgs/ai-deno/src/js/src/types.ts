import { z } from "npm:zod@3.24.2";
import { UINode } from "./ui/nodes.ts";

export type ParameterSchema = {
  [name: string]:
    | SchemaRealNode
    | SchemaIntNode
    | SchemaBoolNode
    | SchemaStringNode
    | SchemaColorNode;
};

type SchemaRealNode = {
  type: "real";
  enum?: number[];
  default: number;
};

type SchemaIntNode = {
  type: "int";
  enum?: number[];
  default: number;
};

type SchemaBoolNode = {
  type: "bool";
  enum?: boolean[];
  default: boolean;
};

type SchemaStringNode = {
  type: "string";
  enum?: string[];
  default: string;
};

type SchemaColorNode = {
  type: "color";
  enum?: ColorRGBA[];
  default: ColorRGBA;
};

export type ColorRGBA = {
  /** 0 to 1 */
  r: number;
  /** 0 to 1 */
  g: number;
  /** 0 to 1 */
  b: number;
  /** 0 to 1 */
  a: number;
};

export type ParameterSchemaToState<T extends ParameterSchema> = {
  [K in keyof T]: T[K]["type"] extends "real"
    ? T[K]["enum"] extends number[]
      ? T[K]["enum"][number]
      : number
    : T[K]["type"] extends "int"
    ? T[K]["enum"] extends number[]
      ? T[K]["enum"][number]
      : number
    : T[K]["type"] extends "bool"
    ? T[K]["enum"] extends boolean[]
      ? T[K]["enum"][number]
      : boolean
    : T[K]["type"] extends "string"
    ? T[K]["enum"] extends string[]
      ? T[K]["enum"][number]
      : string
    : T[K]["type"] extends "color"
    ? T[K]["enum"] extends ColorRGBA[]
      ? T[K]["enum"][number]
      : ColorRGBA
    : never;
};

export enum StyleFilterFlag {
  /** Applied by default before the object is painted with fill or stroke. */
  kPreEffectFilter = 0x1,
  /**  Applied by default after the object is painted with fill or stroke. */
  kPostEffectFilter = 0x2,
  /** Replaces the default stroke behavior.
  Brushes are an example of an effect of this type. */
  kStrokeFilter = 0x3,
  /** Replaces the default fill behavior. */
  kFillFilter = 0x4,
  /** A mask to OR with the filter-style value to retrieve specific bit flags.
  Do not use with \c #AILiveEffectSuite::AddLiveEffect(). */
  kFilterTypeMask = 0x0ffff,
  /** Internal. Do not use. */
  kSpecialGroupPreFilter = 1 << 16,
  /** Parameters can be scaled. */
  kHasScalableParams = 1 << 17,
  /** Supports automatic rasterization. */
  kUsesAutoRasterize = 1 << 18,
  /** Supports the generation of an SVG filter. */
  kCanGenerateSVGFilter = 1 << 19,
  /** Has parameters that can be modified by a \c #kSelectorAILiveEffectAdjustColors message. */
  kHandlesAdjustColorsMsg = 1 << 20,
  /** Handles \c #kSelectorAILiveEffectIsCompatible messages. If this flag is not set the message will not be sent. */
  kHandlesIsCompatibleMsg = 1 << 21,
  /*Parameters can be converted during Document Scale Conversion*/
  kHasDocScaleConvertibleParams = 1 << 22,
  /** Flag indicating support for parallel execution: This Live Effect plugin is capable of being
  invoked on non-main threads concurrently for processing multiple art objects within different
  or the same documents. The plugin is responsible for ensuring thread safety by preventing data races,
  deadlocks, and other concurrency issues when this flag is enabled. */
  kParallelExecutionFilter = 1 << 23,
}

export type GoLiveEffectPayload = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type LiveEffectEnv = {
  baseDpi: number;
  dpi: number;
};

export type AIPlugin<
  T extends ParameterSchema,
  TInit,
  Params = ParameterSchemaToState<T>
> = {
  id: string;
  title: string;
  version: { major: number; minor: number };

  liveEffect?: {
    paramSchema: T;

    /** map to styleFilterFlags */
    styleFilterFlags: {
      type:
        | StyleFilterFlag.kPreEffectFilter
        | StyleFilterFlag.kPostEffectFilter
        | StyleFilterFlag.kFillFilter
        | StyleFilterFlag.kStrokeFilter;
      features: StyleFilterFlag[];
    };

    /** Called once at first effect use */
    initLiveEffect?(): Promise<TInit> | TInit;
    goLiveEffect: (
      init: NoInfer<TInit>,
      params: Params,
      input: GoLiveEffectPayload,
      env: LiveEffectEnv
    ) => Promise<GoLiveEffectPayload>;

    /**
     * Called when the EditLiveEffect callback is triggered.
     * This function must return a normalized parameter object.
     */
    onEditParameters?: (nextParams: Params) => Params;

    onAdjustColors: (
      params: Params,
      adjustColor: (color: ColorRGBA) => ColorRGBA
    ) => Params;

    /**
     * Called when the LiveEffectScale callback is triggered.
     * This function scales the given params by the given scale factor.
     *
     * If the effect unnecessarily scales the parameters, it should return null.
     * Else, it should return the after scaled parameters.
     *
     * @param params The parameters to scale.
     * @param scaleFactor The scale factor (0.0 to 1.0).
     * @returns The scaled parameters or null if the parameters are not scaled.
     */
    onScaleParams: (params: Params, scaleFactor: number) => Params | null;

    // liveEffectAdjustColors(params: T, colorAdjustment: any): T

    /**
     * Called when the LiveEffectInterpolate callback is triggered.
     * This function interpolates between paramsA and paramsB
     * based on the given percent (0 to 1).
     * It is invoked when this effect is targeted by Illustrator's Blend feature.
     *
     * @param paramsA The first set of parameters.
     * @param paramsB The second set of parameters.
     * @param percent The interpolation percent (0.0 to 1.0).
     */
    onInterpolate: (
      paramsA: Params,
      paramsB: Params,
      percent: number
    ) => Params;

    renderUI: (
      params: Params,
      setParam: (
        update: Partial<Params> | ((prev: Params) => Partial<Params>)
      ) => void
    ) => UINode;
  };
};

export type AIEffectPlugin<T extends ParameterSchema, TInit> = Ensure<
  AIPlugin<T, TInit>,
  "liveEffect"
>;

type Ensure<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export function definePlugin<T extends ParameterSchema, IT>(
  plugin: AIPlugin<T, IT>
) {
  return plugin;
}
