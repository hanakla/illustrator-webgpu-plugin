export const ui = {
  group: (
    { direction = "row" }: Omit<UINodeGroup, "type" | "children">,
    children: UINode[]
  ): UINode => ({
    type: "group",
    direction,
    children,
  }),
  button: (props: Omit<UINodeButton, "type">): UINodeButton => ({
    ...props,
    type: "button",
  }),
  slider: (props: Omit<UINodeSlider, "type">): UINode => ({
    ...props,
    type: "slider",
  }),
  checkbox: (props: Omit<UINodeCheckbox, "type">): UINode => ({
    ...props,
    type: "checkbox",
  }),
  textInput: (props: Omit<UINodeTextInput, "type">): UINode => ({
    ...props,
    type: "textInput",
  }),
  numberInput: (props: Omit<UINodeNumberInput, "type">): UINode => ({
    ...props,
    type: "numberInput",
  }),
  colorInput: (props: Omit<UINodeColorInput, "type">): UINode => ({
    ...props,
    type: "colorInput",
  }),
  text: (props: MakeOptional<Omit<UINodeText, "type">, "size">): UINode => ({
    ...props,
    size: props.size || "normal",
    type: "text",
  }),
  select: (props: Omit<UISelect, "type" | "selectedIndex">): UISelect => ({
    ...props,
    selectedIndex: props.options.findIndex(
      (option) => option.value === props.value
    ),
    type: "select",
  }),
  separator: (): UISeparator => ({
    type: "separator",
  }),
};

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
