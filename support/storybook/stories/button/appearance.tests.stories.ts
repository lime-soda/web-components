import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { userEvent } from 'storybook/test';
import { html } from 'lit';
import '@lime-soda/button';
import { visualStoryParameters } from '../story-parameters.js';

/**
 * The pictures Chromatic compares.
 *
 * These assert nothing, and deliberately: what is worth checking about a
 * variant is how it looks, and an assertion about a colour is a copy of the
 * stylesheet that fails whenever the design changes on purpose. The package's
 * browser tests hold the things that are structural rather than visual — that
 * every variant has the same box, that the focus ring uses the design system's
 * focus colour and not the accent.
 *
 * One story per grid of options rather than one per option: four variants times
 * three sizes is twelve captures if each gets its own story, and a reviewer
 * comparing twelve near-identical images finds nothing. Together they are one
 * image where a change to any of them is obvious.
 */

const meta: Meta = {
  title: 'Button/Tests/Appearance',
  parameters: visualStoryParameters,
};

export default meta;
type Story = StoryObj;

const SIZES = ['sm', 'md', 'lg'] as const;
const VARIANTS = ['primary', 'secondary', 'outline', 'ghost'] as const;

/** One image holding every combination, so a change to any of them is obvious. */
const everyCombination = () => html`
  <div style="display: grid; gap: 1rem; grid-template-columns: repeat(3, max-content);">
    ${VARIANTS.map((variant) =>
      SIZES.map(
        (size) => html`<ls-button size=${size} variant=${variant}>${variant} ${size}</ls-button>`,
      ),
    )}
  </div>
`;

export const EveryVariantAtEverySize: Story = {
  globals: { theme: 'light' },
  render: everyCombination,
};

/**
 * The same, dark.
 *
 * Not a duplicate: the semantic tier resolves through `light-dark()`, so this is
 * a different set of colours arriving in the same places, and it is where a
 * hard-coded literal in a component shows up.
 */
export const EveryVariantAtEverySizeDark: Story = {
  globals: { theme: 'dark' },
  render: everyCombination,
};

export const TheFocusRing: Story = {
  globals: { theme: 'light' },
  // The ring sits outside the button by its offset, so the story gives it room
  // rather than letting it run into the crop edge.
  render: () => html`<div style="padding: 1.5rem"><ls-button>Buy</ls-button></div>`,
  play: async ({ canvasElement }) => {
    // Tabbed to, not clicked: `:focus-visible` is a modality heuristic and only
    // keyboard focus matches it reliably. Whether a synthetic click does is
    // undefined, which is what made the ring come and go between snapshots and
    // flag a diff each time.
    canvasElement.querySelector('ls-button')!.focus();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
  },
};
