import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { html } from 'lit';
import '@lime-soda/button';
import { getByRole } from '../shadow-queries.js';
import { testStoryParameters } from '../story-parameters.js';

/**
 * What the button promises an application, driven the way a person drives it.
 *
 * There is deliberately very little here, and the reason is worth stating so
 * nobody fills the file up later. The package's own browser tests already cover
 * what it renders, what it reflects, that every variant has the same box and
 * where the focus ring sits — none of which needs a person. What is left is
 * mostly not the button's to promise: it wraps a native `<button>`, so Enter
 * and Space activating it, and Tab reaching it inside the shadow tree, are the
 * platform's behaviour. Stories for those would assert that Chromium works,
 * and could not drive them faithfully in any case — a synthetic key press
 * cannot make the browser perform its own default action, which is exactly the
 * limitation `pressKey` documents.
 *
 * The two below are contracts rather than platform behaviour: an application
 * listens on the host and needs the event to arrive, and the button is named by
 * what it is given rather than by an attribute someone must remember to set.
 * Both would break silently if the component were reimplemented around a div,
 * or grew a wrapper that swallowed the event.
 *
 * The a11y gate runs on every story here regardless, which is the other half of
 * what these files are for.
 */

const meta: Meta = {
  title: 'Button/Tests/Interaction',
  parameters: testStoryParameters,
  render: () => html`<ls-button>Buy</ls-button>`,
};

export default meta;
type Story = StoryObj;

export const ClickingItReachesThePage: Story = {
  play: async ({ canvasElement }) => {
    // The listener goes on the host, where an application puts one, while the
    // click lands on the button inside the shadow root. What is being asked is
    // whether the event composes out of it.
    const host = canvasElement.querySelector('ls-button')!;
    const clicked = fn();
    host.addEventListener('click', clicked, { once: true });

    await userEvent.click(getByRole(canvasElement, 'button', { name: 'Buy' }));

    await expect(clicked).toHaveBeenCalled();
  },
};

export const ItIsNamedByWhatItIsGiven: Story = {
  play: async ({ canvasElement }) => {
    // Slotted content is the only name it has — there is no label attribute to
    // fall back on — so a reader finds it by that or not at all.
    await expect(getByRole(canvasElement, 'button', { name: 'Buy' })).toBeTruthy();
  },
};
