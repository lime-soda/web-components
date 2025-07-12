import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { html } from 'lit'

import '../src'

const meta: Meta = {
  component: 'ls-button',
  title: 'Components/Button',
  tags: ['autodocs'],
  render: ({ label, onClick, size }) =>
    html`<ls-button size=${size} @click=${onClick}>${label}</ls-button>`,
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
  args: {
    label: 'Button',
    onClick: fn(),
    size: 'md',
  },
}

export default meta
type Story = StoryObj

export const Primary: Story = {
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('ls-button')
    const button = el!.shadowRoot!.querySelector('button')!
    const handler = fn()
    button.addEventListener('click', handler, { once: true })

    await userEvent.click(button)

    await expect(handler).toHaveBeenCalled()
  },
}
