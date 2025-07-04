import { fn } from "storybook/test";
import { html } from "lit";

import "../packages/button/src/button";

export default {
  title: "Components/Button",
  tags: ["autodocs"],
  render: (args) => html`<ls-button @click=${args.onClick}>Hola!</ls-button>`,
  argTypes: {
    backgroundColor: { control: "color" },
    size: {
      control: { type: "select" },
      options: ["small", "medium", "large"],
    },
  },
  args: { onClick: fn() },
};

export const Primary = {};
