import { expect, fn, userEvent } from "storybook/test";
import { html } from "lit";

import "../src/button";

export default {
  title: "Components/Button",
  tags: ["autodocs"],
  render: ({ label, onClick }) =>
    html`<ls-button @click=${onClick}>${label}</ls-button>`,
  argTypes: {
    backgroundColor: { control: "color" },
    size: {
      control: { type: "select" },
      options: ["small", "medium", "large"],
    },
  },
  args: {
    label: "Button",
    onClick: fn(),
  },
};

export const Primary = {
  play: async ({ args, canvasElement }) => {
    const el = canvasElement.querySelector("ls-button");
    const button = el.shadowRoot.querySelector("button");
    await userEvent.click(button);
    expect(args.onClick.mock.calls).toHaveLength(1);
  },
};
