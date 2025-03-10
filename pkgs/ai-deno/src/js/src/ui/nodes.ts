export const ui = {
  group: (
    { direction = "row" }: { direction?: "row" | "col" },
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
  text: (props: Omit<UINodeText, "type">): UINode => ({
    ...props,
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

export type UINodeGroup = {
  type: "group";
  direction: "col" | "row";
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
  value: boolean;
};

export type UINodeTextInput = {
  type: "textInput";
  key: string;
  label: string;
  value: string;
};

export type UINodeNumberInput = {
  type: "numberInput";
  dataType: "int" | "float";
  key: string;
  label: string;
  value: number;
  max?: number;
  min?: number;
  step?: number;
};

export type UINodeText = {
  type: "text";
  text: string;
};

export type UINodeButton = {
  type: "button";
  text: string;
  onClick?: (e: { type: "click" }) => void | Promise<void>;
};

export type UISelect = {
  type: "select";
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  selectedIndex: number;
};

export type UISeparator = {
  type: "separator";
};

export type UINode =
  | UINodeGroup
  | UINodeSlider
  | UINodeCheckbox
  | UINodeTextInput
  | UINodeText
  | UINodeButton
  | UISelect
  | UISeparator
  | null;
