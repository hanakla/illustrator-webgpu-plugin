export const ui = {
  group: (
    { direction = "row" }: { direction?: "row" | "col" },
    children: UINode[]
  ): UINode => ({
    type: "group",
    direction,
    children,
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
  text: (props: Omit<UINodeText, "type">): UINode => ({
    ...props,
    type: "text",
  }),
  button: (props: Omit<UINodeButton, "type">): UINode => ({
    ...props,
    type: "button",
  }),
  select: (props: Omit<UISelect, "type" | "selectedIndex">): UISelect => ({
    ...props,
    selectedIndex: props.options.indexOf(props.value),
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

export type UINodeText = {
  type: "text";
  text: string;
};

export type UINodeButton = {
  type: "button";
};

export type UISelect = {
  type: "select";
  key: string;
  label: string;
  options: string[];
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
