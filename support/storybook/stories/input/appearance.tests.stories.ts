import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '@lime-soda/input';
import { visualStoryParameters } from '../story-parameters.js';

/**
 * The pictures Chromatic compares.
 *
 * Including one of the input re-pointed the way a host does it, because that is
 * the component's whole purpose: everything visual comes from `--input-*`, so a
 * grid cell can drop the border and the padding without this component knowing
 * a grid exists. If that stops working, it stops working here first.
 */
const meta: Meta = {
  title: 'Input/Tests/Appearance',
  parameters: visualStoryParameters,
};

export default meta;
type Story = StoryObj;

const states = () => html`
  <div style="display: grid; gap: 1rem; grid-template-columns: repeat(2, max-content);">
    <ls-input label="Empty" placeholder="Filter"></ls-input>
    <ls-input label="Holding a value" .value=${'UKT 4% 2030'}></ls-input>
    <ls-input label="Active" .value=${'UKT'} active></ls-input>
    <ls-input label="Disabled" .value=${'UKT'} disabled></ls-input>
  </div>
`;

export const EveryState: Story = {
  globals: { theme: 'light' },
  render: states,
};

/** The same, dark: a different set of colours arriving in the same places. */
export const EveryStateDark: Story = {
  globals: { theme: 'dark' },
  render: states,
};

export const RePointedByItsHost: Story = {
  globals: { theme: 'light' },
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center;">
      <ls-input label="Default"></ls-input>
      <ls-input
        label="As a cell editor"
        .value=${'INS 0'}
        style="--input-border-width: 0; --input-radius: 0; --input-padding: 0 8px; --input-focus-width: 0;"
      ></ls-input>
    </div>
  `,
};
