import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { fn } from 'storybook/test';
import { html } from 'lit';
import '@lime-soda/button';

interface Args {
  label: string;
  size: 'sm' | 'md' | 'lg';
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  onClick: () => void;
}

/**
 * The one story with controls.
 *
 * Every property the button has is a control, so the way to see a secondary
 * large button is to ask for one rather than to find the story someone wrote
 * for it. The file used to hold nine stories, four of which differed only in
 * which variant they hard-coded — a gallery that had to be extended by hand
 * every time the component gained an option, and which said nothing a control
 * could not.
 *
 * What is left of that gallery is next door, under Tests, where the pictures
 * Chromatic compares are grouped and where nobody is invited to change the
 * arguments they were captured with.
 */
const meta: Meta<Args> = {
  component: 'ls-button',
  title: 'Button/Demo',
  tags: ['autodocs'],
  parameters: {
    controls: { expanded: true },
    // Back to a gate rather than a report: the palette pivot put white label
    // text on a teal and a taupe dark enough to clear AA, which the bright green
    // and pink never did.
    a11y: { test: 'error' },
  },
  render: ({ label, onClick, size, variant }) =>
    html`<ls-button size=${size} variant=${variant} @click=${onClick}>${label}</ls-button>`,
  argTypes: {
    label: {
      control: 'text',
      description: 'The button’s content. Slotted, so it can be markup rather than text.',
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
      description:
        'Sits one step below a typical UI at every size — this is a trading surface, and the currency is rows on screen.',
    },
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'outline', 'ghost'],
      description:
        'Every variant has the same box for the same label and size, so swapping one for another never reflows what is around it.',
    },
  },
  args: {
    label: 'Button',
    onClick: fn(),
    size: 'md',
    variant: 'primary',
  },
};

export default meta;

export const Demo: StoryObj<Args> = {};
