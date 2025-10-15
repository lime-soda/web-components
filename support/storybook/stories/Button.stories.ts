import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { html } from 'lit'

import '@lime-soda/button'

const meta: Meta = {
  component: 'ls-button',
  title: 'Components/Button',
  tags: ['autodocs'],
  render: ({ label, onClick, size, variant }) =>
    html`<ls-button size=${size} variant=${variant} @click=${onClick}
      >${label}</ls-button
    >`,
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
}

export default meta
type Story = StoryObj

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('ls-button')
    const button = el!.shadowRoot!.querySelector('button')!
    const handler = fn()
    button.addEventListener('click', handler, { once: true })

    await userEvent.click(button)

    await expect(handler).toHaveBeenCalled()
  },
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
}

export const Outline: Story = {
  args: {
    variant: 'outline',
  },
}

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
}

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center;">
      <ls-button size="sm" variant="primary">Small</ls-button>
      <ls-button size="md" variant="primary">Medium</ls-button>
      <ls-button size="lg" variant="primary">Large</ls-button>
    </div>
  `,
}

export const Variants: Story = {
  render: () => html`
    <div
      style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
      <ls-button variant="primary">Primary</ls-button>
      <ls-button variant="secondary">Secondary</ls-button>
      <ls-button variant="outline">Outline</ls-button>
      <ls-button variant="ghost">Ghost</ls-button>
    </div>
  `,
}

export const AllCombinations: Story = {
  render: () => html`
    <div
      style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
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
}
