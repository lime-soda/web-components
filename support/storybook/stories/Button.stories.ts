import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { html } from 'lit';

import '@lime-soda/button';

const meta: Meta = {
  component: 'ls-button',
  title: 'Components/Button',
  tags: ['autodocs'],
  render: ({ label, onClick, size, variant }) =>
    html`<ls-button size=${size} variant=${variant} @click=${onClick}>${label}</ls-button>`,
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'ghost'],
    },
  },
  args: {
    label: 'Button',
    onClick: fn(),
    size: 'md',
    variant: 'primary',
  },
  parameters: {
    // Back to a gate rather than a report: the palette pivot put white label
    // text on a teal and a taupe dark enough to clear AA, which the bright green
    // and pink never did.
    a11y: { test: 'error' },
  },
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('ls-button');
    const button = el!.shadowRoot!.querySelector('button')!;
    const handler = fn();
    button.addEventListener('click', handler, { once: true });

    await userEvent.click(button);

    await expect(handler).toHaveBeenCalled();

    // Clicking leaves the button focused, and the snapshot is taken after this
    // runs — so the ring ended up in every Chromatic capture of this story,
    // drawn outside the button by its offset and against the crop edge. Whether
    // :focus-visible matches a synthetic click is a heuristic, so it came and
    // went between runs and flagged a diff each time. The story is about the
    // click handler firing; the ring belongs in a story that means to show it.
    button.blur();
  },
};

export const Focused: Story = {
  name: 'Focus ring',
  args: { variant: 'primary' },
  // The ring sits outside the button by its offset, so the story gives it room
  // rather than letting it run into the crop edge.
  render: ({ label, size, variant }) =>
    html`<div style="padding: 1.5rem">
      <ls-button size=${size} variant=${variant}>${label}</ls-button>
    </div>`,
  play: async ({ canvasElement }) => {
    // Tab rather than click: :focus-visible is a modality heuristic, and only
    // keyboard focus matches it reliably. A click may or may not, which is what
    // made the ring flicker between snapshots.
    canvasElement.querySelector('ls-button')!.focus();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center;">
      <ls-button size="sm" variant="primary">Small</ls-button>
      <ls-button size="md" variant="primary">Medium</ls-button>
      <ls-button size="lg" variant="primary">Large</ls-button>
    </div>
  `,
};

export const Variants: Story = {
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
      <ls-button variant="primary">Primary</ls-button>
      <ls-button variant="secondary">Secondary</ls-button>
      <ls-button variant="outline">Outline</ls-button>
      <ls-button variant="ghost">Ghost</ls-button>
    </div>
  `,
};

export const AllCombinations: Story = {
  render: () => html`
    <div
      style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));"
    >
      <!-- Primary variants -->
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <h4>Primary</h4>
        <ls-button size="sm" variant="primary">Small Primary</ls-button>
        <ls-button size="md" variant="primary">Medium Primary</ls-button>
        <ls-button size="lg" variant="primary">Large Primary</ls-button>
      </div>

      <!-- Secondary variants -->
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <h4>Secondary</h4>
        <ls-button size="sm" variant="secondary">Small Secondary</ls-button>
        <ls-button size="md" variant="secondary">Medium Secondary</ls-button>
        <ls-button size="lg" variant="secondary">Large Secondary</ls-button>
      </div>

      <!-- Outline variants -->
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <h4>Outline</h4>
        <ls-button size="sm" variant="outline">Small Outline</ls-button>
        <ls-button size="md" variant="outline">Medium Outline</ls-button>
        <ls-button size="lg" variant="outline">Large Outline</ls-button>
      </div>

      <!-- Ghost variants -->
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <h4>Ghost</h4>
        <ls-button size="sm" variant="ghost">Small Ghost</ls-button>
        <ls-button size="md" variant="ghost">Medium Ghost</ls-button>
        <ls-button size="lg" variant="ghost">Large Ghost</ls-button>
      </div>
    </div>
  `,
};
