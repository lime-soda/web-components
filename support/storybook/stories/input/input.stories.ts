import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { fn } from 'storybook/test';
import { html } from 'lit';
import '@lime-soda/input';

interface Args {
  label: string;
  placeholder: string;
  value: string;
  type: 'text' | 'search';
  active: boolean;
  disabled: boolean;
  onInput: () => void;
}

/**
 * The one story with controls.
 *
 * The input is deliberately thin: it draws a box, holds a value and says what
 * it is. Keys belong to whoever places it — a cell editor wants Enter, Tab and
 * Escape, a filter wants its host never to see them — so there is nothing here
 * to configure about them.
 */
const meta: Meta<Args> = {
  component: 'ls-input',
  title: 'Input/Demo',
  tags: ['autodocs'],
  parameters: {
    controls: { expanded: true },
    a11y: { test: 'error' },
  },
  render: ({ label, placeholder, value, type, active, disabled, onInput }) =>
    html`<ls-input
      label=${label}
      placeholder=${placeholder}
      .value=${value}
      type=${type}
      ?active=${active}
      ?disabled=${disabled}
      @ls-input=${onInput}
    ></ls-input>`,
  argTypes: {
    label: {
      control: 'text',
      description:
        'The accessible name. There is no visible label, so without one a reader is told “edit text, blank”.',
    },
    type: {
      control: 'inline-radio',
      options: ['text', 'search'],
      description:
        'A search field is announced as a searchbox rather than a textbox — a real difference to a reader, so it is stated rather than fixed.',
    },
    active: {
      control: 'boolean',
      description:
        'Set when the input holds something worth noticing — a filter that is narrowing a list. Colours the outline.',
    },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
    value: { control: 'text' },
  },
  args: {
    label: 'Instrument',
    placeholder: 'Filter',
    value: '',
    type: 'text',
    active: false,
    disabled: false,
    onInput: fn(),
  },
};

export default meta;

export const Demo: StoryObj<Args> = {};
