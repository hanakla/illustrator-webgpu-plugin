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

type ChangeEvent<T = any> = {
  type: "change";
  value: T;
};

type ClickEvent = {
  type: "click";
};

type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: T[P];
};

export type ChangeEventHandler<T = any> = (
  event: ChangeEvent<T>
) => void | Promise<void>;

export type ClickEventHandler = (event: ClickEvent) => void | Promise<void>;

export type UINodeGroup = {
  type: "group";
  direction: "col" | "row";
  disabled?: boolean;
  children: UINode[];
};

export type UINodeSlider = {
  type: "slider";
  key?: string;
  dataType: "int" | "float";
  min: number;
  max: number;
  value: number;
  onChange?: ChangeEventHandler<number>;
};

export type UINodeCheckbox = {
  type: "checkbox";
  key?: string;
  label: string;
  value: boolean;
  onChange?: ChangeEventHandler<boolean>;
};

export type UINodeTextInput = {
  type: "textInput";
  key?: string;
  value: string;
  onChange?: ChangeEventHandler<string>;
};

export type UINodeNumberInput = {
  type: "numberInput";
  dataType: "int" | "float";
  key?: string;
  value: number;
  max?: number;
  min?: number;
  step?: number;
  onChange?: ChangeEventHandler<number>;
};

export type UINodeColorInput = {
  type: "colorInput";
  key?: string;
  // dataType: "rgb" | "rgba";
  value: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  onChange?: ChangeEventHandler<{
    r: number;
    g: number;
    b: number;
    a: number;
  }>;
};

export type UINodeText = {
  type: "text";
  text: string;
  size: "sm" | "normal";
};

export type UINodeButton = {
  type: "button";
  text: string;
  onClick?: ClickEventHandler;
};

export type UISelect = {
  type: "select";
  key: string;
  options: { value: string; label: string }[];
  value: string;
  selectedIndex: number;
  onChange?: ChangeEventHandler<string>;
};

export type UISeparator = {
  type: "separator";
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
  | null;
