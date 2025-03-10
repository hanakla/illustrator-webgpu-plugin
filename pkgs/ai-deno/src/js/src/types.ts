import { UINode } from "./ui/nodes.ts";

export type ParameterSchema = {
  [name: string]: {
    type: "real" | "int" | "bool" | "string";
    enum?: any[];
    default: any;
  };
};

export type ParameterSchemaToState<T extends ParameterSchema> = {
  [K in keyof T]: T[K]["type"] extends "real"
    ? number
    : T[K]["type"] extends "int"
    ? number
    : T[K]["type"] extends "bool"
    ? boolean
    : T[K]["type"] extends "string"
    ? string
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

export type DoLiveEffectPayload = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
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
      main:
        | StyleFilterFlag.kPreEffectFilter
        | StyleFilterFlag.kPostEffectFilter
        | StyleFilterFlag.kFillFilter
        | StyleFilterFlag.kStrokeFilter;
      features: StyleFilterFlag[];
    };

    /** Called once at first effect use */
    initLiveEffect?(): Promise<TInit> | TInit;
    doLiveEffect: (
      init: NoInfer<TInit>,
      params: Params,
      input: DoLiveEffectPayload
    ) => Promise<DoLiveEffectPayload>;

    /**
     * Called when the EditLiveEffect callback is triggered.
     * This function must return a normalized parameter object.
     */
    editLiveEffectParameters?: (nextParams: Params) => Params;

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
    liveEffectScaleParameters: (
      params: Params,
      scaleFactor: number
    ) => Params | null;

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
    liveEffectInterpolate: (
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
