import { UINodeText } from "./types.ts";
import { UINodeButton } from "./types.ts";
import { UINodeTextInput } from "./types.ts";
import { UINodeCheckbox } from "./types.ts";
import { UINode, UINodeSlider } from "./types.ts";

export const ui = {
  group: (
    { direction = "horizontal" }: { direction?: "horizontal" | "vertical" },
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
};
