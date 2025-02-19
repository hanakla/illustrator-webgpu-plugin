export type ParameterSchema = {
  [name: string]: {
    type: "real" | "int" | "bool" | "string";
    default: any;
  };
};

export type UINodeGroup = {
  type: "group";
  direction: "horizontal" | "vertical";
  children: UINode[];
};

export type UINodeSlider = {
  type: "slider";
  key: string;
  label: string;
  dataType: "int" | "float";
  min: number;
  max: number;
  value: number;
};

export type UINodeCheckbox = {
  type: "checkbox";
  key: string;
  label: string;
  checked: boolean;
};

export type UINodeTextInput = {
  type: "textInput";
  key: string;
  label: string;
  value: string;
};

export type UINodeText = {
  type: "text";
  text: string;
};

export type UINodeButton = {
  type: "button";
};

export type UINode =
  | UINodeGroup
  | UINodeSlider
  | UINodeCheckbox
  | UINodeTextInput
  | UINodeText
  | UINodeButton
  | null;

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
  buffer: Uint8ClampedArray;
};

export type Effect<T extends object> = {
  id: string;
  title: string;
  version: { major: number; minor: number };
  paramSchema: ParameterSchema;
  /** map to styleFilterFlags */
  styleFilterFlags: {
    main:
      | StyleFilterFlag.kPreEffectFilter
      | StyleFilterFlag.kPostEffectFilter
      | StyleFilterFlag.kFillFilter
      | StyleFilterFlag.kStrokeFilter;
    features: StyleFilterFlag[];
  };
  doLiveEffect: (
    params: T,
    input: DoLiveEffectPayload
  ) => Promise<DoLiveEffectPayload>;
  editLiveEffectParameters: (nextParams: T) => string;
  renderUI: (params: T) => UINode;
};
