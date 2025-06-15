import { z } from "npm:zod@3.24.2";

export const ui = {
  group: (
    { direction = "row" }: Omit<UINodeGroup, "type" | "children">,
    children: UINode[]
  ): UINode =>
    fillByNull({
      type: "group" as const,
      direction,
      children: children.filter((child) => !!child),
    }),
  button: (props: Omit<UINodeButton, "type">): UINodeButton =>
    fillByNull({
      text: props.text,
      onClick: props.onClick,
      disabled: props.disabled,
      type: "button" as const,
    }),
  slider: (props: Omit<UINodeSlider, "type">): UINodeSlider =>
    fillByNull({
      key: props.key,
      dataType: props.dataType,
      min: props.min,
      max: props.max,
      value: props.value,
      onChange: props.onChange,
      type: "slider" as const,
    }),
  checkbox: (props: Omit<UINodeCheckbox, "type">): UINodeCheckbox =>
    fillByNull({
      key: props.key,
      label: props.label,
      value: props.value,
      onChange: props.onChange,
      type: "checkbox" as const,
    }),
  textInput: (props: Omit<UINodeTextInput, "type">): UINodeTextInput =>
    fillByNull({
      key: props.key,
      value: props.value,
      onChange: props.onChange,
      type: "textInput" as const,
    }),
  numberInput: (props: Omit<UINodeNumberInput, "type">): UINodeNumberInput =>
    fillByNull({
      key: props.key,
      dataType: props.dataType,
      min: props.min,
      max: props.max,
      step: props.step,
      value: props.value,
      onChange: props.onChange,
      type: "numberInput" as const,
    }),
  colorInput: (props: Omit<UINodeColorInput, "type">): UINodeColorInput =>
    fillByNull({
      key: props.key,
      value: props.value,
      onChange: props.onChange,
      type: "colorInput" as const,
    }),
  text: (props: MakeOptional<Omit<UINodeText, "type">, "size">): UINodeText =>
    fillByNull({
      text: props.text,
      size: props.size || "normal",
      type: "text" as const,
    }),
  select: (props: Omit<UISelect, "type" | "selectedIndex">): UISelect =>
    fillByNull({
      key: props.key,
      options: props.options,
      value: props.value,
      onChange: props.onChange,
      selectedIndex: props.options.findIndex(
        (option) => option.value === props.value
      ),
      type: "select" as const,
    }),
  separator: (): UISeparator =>
    fillByNull({
      type: "separator" as const,
    }),
};

/** For improve debuggability in ImGui */
function fillByNull<T extends object>(obj: T): T {
  Object.keys(obj).forEach((key) => {
    const _k = key as keyof T;
    if (obj[_k] === null) {
      obj[_k] = obj[_k] ?? (null as any);
    }
  });
  return obj;
}

type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: T[P];
};

const ChangeEventSchema = z.object({
  type: z.literal("change"),
  value: z.any(),
});

type ChangeEvent<T = any> = {
  type: "change";
  value: T;
};

const ChangeEventHandlerSchema = z
  .function()
  .args(ChangeEventSchema)
  .returns(z.union([z.void(), z.promise(z.void())]));

const ChangeEventHandlerSchemaWith = <T extends z.ZodType>(type: T) => {
  return z
    .function()
    .args(
      ChangeEventSchema.extend({
        value: type,
      })
    )
    .returns(z.union([z.void(), z.promise(z.void())]));
};

export type ChangeEventHandler<T = any> = (
  event: ChangeEvent<T>
) => void | Promise<void>;

const ClickEventSchema = z.object({
  type: z.literal("click"),
});

const ClickEventHandlerSchema = z
  .function()
  .args(ClickEventSchema)
  .returns(z.union([z.void(), z.promise(z.void())]));
export type ClickEventHandler = z.infer<typeof ClickEventHandlerSchema>;

const UiNodeSliderSchema = z.object({
  type: z.literal("slider"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  dataType: z.enum(["int", "float"]),
  min: z.number(),
  max: z.number(),
  value: z.number(),
  onChange: ChangeEventHandlerSchemaWith(z.number()).optional(),
});

export type UINodeSlider = z.infer<typeof UiNodeSliderSchema>;

const UiNodeCheckboxSchema = z.object({
  type: z.literal("checkbox"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  label: z.string(),
  value: z.boolean(),
  onChange: ChangeEventHandlerSchemaWith(z.boolean()).optional(),
});

export type UINodeCheckbox = z.infer<typeof UiNodeCheckboxSchema>;

const UiNodeTextInputSchema = z.object({
  type: z.literal("textInput"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  value: z.string(),
  onChange: ChangeEventHandlerSchemaWith(z.string()).optional(),
});

export type UINodeTextInput = z.infer<typeof UiNodeTextInputSchema>;

const UiNodeNumberInputSchema = z.object({
  type: z.literal("numberInput"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  dataType: z.enum(["int", "float"]),
  value: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  onChange: ChangeEventHandlerSchemaWith(z.number()).optional(),
});

export type UINodeNumberInput = z.infer<typeof UiNodeNumberInputSchema>;

const UiNodeColorInput = z.object({
  type: z.literal("colorInput"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  value: z.object({
    r: z.number().min(0).max(1),
    g: z.number().min(0).max(1),
    b: z.number().min(0).max(1),
    a: z.number().min(0).max(1),
  }),
  onChange: ChangeEventHandlerSchemaWith(
    z.object({
      r: z.number().min(0).max(1),
      g: z.number().min(0).max(1),
      b: z.number().min(0).max(1),
      a: z.number().min(0).max(1),
    })
  ).optional(),
});

export type UINodeColorInput = z.infer<typeof UiNodeColorInput>;

const UiNodeTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  size: z.enum(["sm", "normal"]).optional(),
});

export type UINodeText = z.infer<typeof UiNodeTextSchema>;

const UiNodeButtonSchema = z.object({
  type: z.literal("button"),
  text: z.string(),
  disabled: z.boolean().optional(),
  onClick: ClickEventHandlerSchema.optional(),
});
export type UINodeButton = z.infer<typeof UiNodeButtonSchema>;

const UiSelectSchema = z.object({
  type: z.literal("select"),
  key: z.string().optional(),
  disabled: z.boolean().optional(),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    })
  ),
  value: z.string(),
  selectedIndex: z.number(),
  onChange: ChangeEventHandlerSchemaWith(z.string()).optional(),
});

export type UISelect = z.infer<typeof UiSelectSchema>;

const UiSeparatorSchema = z.object({
  type: z.literal("separator"),
});
export type UISeparator = z.infer<typeof UiSeparatorSchema>;

const UiNodeDummySchema = z.object({
  type: z.literal("dummy"),
  width: z.number().optional(),
  height: z.number().optional(),
});
export type UINodeDummy = z.infer<typeof UiNodeDummySchema>;

const UiNodeGroupSchema: z.ZodType<UINodeGroup> = z.lazy(() =>
  z.object({
    type: z.literal("group"),
    direction: z.enum(["col", "row"]),
    disabled: z.boolean().optional(),
    children: z.array(UI_NODE_SCHEMA),
  })
);

export type UINodeGroup = {
  type: "group";
  direction: "col" | "row";
  disabled?: boolean;
  children: UINode[];
};

export type UINode =
  | UINodeGroup
  | UINodeSlider
  | UINodeCheckbox
  | UINodeTextInput
  | UINodeNumberInput
  | UINodeColorInput
  | UINodeText
  | UINodeButton
  | UISelect
  | UISeparator
  | UINodeDummy
  | null;

export const UI_NODE_SCHEMA = z.union([
  UiNodeGroupSchema,
  UiNodeSliderSchema,
  UiNodeCheckboxSchema,
  UiNodeTextInputSchema,
  UiNodeNumberInputSchema,
  UiNodeColorInput,
  UiNodeTextSchema,
  UiNodeButtonSchema,
  UiSelectSchema,
  UiNodeDummySchema,
  UiSeparatorSchema,
]);
