import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import { expect, userEvent, within } from '@storybook/test';
import '../../../packages/button/src/button.js';

const meta: Meta = {
  title: 'Components/Button',
  component: 'ls-button',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
  },
  render: (args) => html`
    <ls-button
      variant=${args.variant}
      size=${args.size}
      ?disabled=${args.disabled}
    >
      Button
    </ls-button>
  `,
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'md',
    disabled: false,
  },
  render: (args) => html`
    <ls-button
      variant=${args.variant}
      size=${args.size}
      ?disabled=${args.disabled}
    >
      Button
    </ls-button>
  `,
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    size: 'md',
    disabled: false,
  },
  render: (args) => html`
    <ls-button
      variant=${args.variant}
      size=${args.size}
      ?disabled=${args.disabled}
    >
      Button
    </ls-button>
  `,
};

export const AllSizes: Story = {
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center;">
      <ls-button variant="primary" size="sm">Small</ls-button>
      <ls-button variant="primary" size="md">Medium</ls-button>
      <ls-button variant="primary" size="lg">Large</ls-button>
    </div>
  `,
};

export const Disabled: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    disabled: true,
  },
  render: (args) => html`
    <ls-button
      variant=${args.variant}
      size=${args.size}
      ?disabled=${args.disabled}
    >
      Disabled Button
    </ls-button>
  `,
};

export const WithClickTest: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
  },
  render: (args) => html`
    <ls-button
      variant=${args.variant}
      size=${args.size}
      ?disabled=${args.disabled}
      @click=${() => window.console.log('Button clicked!')}
    >
      Click Me
    </ls-button>
  `,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    
    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};