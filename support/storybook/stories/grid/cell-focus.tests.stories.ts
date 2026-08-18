import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { SelectionModule } from '@lime-soda/grid/selection';
import { KeyboardModule } from '@lime-soda/grid/keyboard';
import {
  activeElement,
  cellsOf,
  dataRows,
  getAllByRole,
  gridReady,
  pressKey,
  tabInto,
} from './shadow-queries.js';
import { type Instrument, instruments, mountGrid, testStoryParameters } from './fixtures.js';

/**
 * Where focus is, and where it goes back to.
 *
 * Core's, not a module's: a grid with nothing installed still has to say which
 * cell is current and hold a way back in. Selection used to be tested here too,
 * on the grounds that both involve a focused cell — which meant this file owned
 * half of another module's behaviour and neither could say what it covered.
 * That half is next door now.
 *
 * The ring itself was once `:focus-visible`, which by design never matches a
 * mouse click, so a clicked cell was genuinely focused and looked exactly like
 * an unfocused one. Chromatic judges whether it is drawn; these fix where it
 * belongs.
 */

const data = instruments(5);

const meta: Meta = {
  title: 'Grid/Tests/Cell focus',
  parameters: testStoryParameters,
  // A checkbox column is kept: a cell with a control in it is the harder case
  // for focus, and the one that used to be wrong.
  render: () =>
    mountGrid({
      data,
      options: {
        layout: 'stack',
        modules: [
          new SelectionModule<Instrument>({ mode: 'multi', checkboxColumn: true }),
          new KeyboardModule<Instrument>(),
        ],
      },
      width: 500,
      height: 236,
      after: html`<button id="elsewhere">Elsewhere</button>`,
    }),
};

export default meta;
type Story = StoryObj;

const rowAt = (canvas: HTMLElement, index: number) => dataRows(canvas)[index]!;
const cellAt = (canvas: HTMLElement, row: number, column: number) =>
  cellsOf(rowAt(canvas, row))[column]!;

/**
 * The cell the grid would hand focus to on Tab.
 *
 * The roving tabindex is the ARIA grid pattern: exactly one cell is the tab
 * stop and the rest are -1, which is how a browser and a screen reader both
 * find their way back in. It is the grid's remembered position, stated in the
 * DOM rather than in an attribute of the grid's own invention.
 */
const tabStops = (canvas: HTMLElement) =>
  getAllByRole(canvas, 'gridcell').filter((cell) => cell.getAttribute('tabindex') === '0');

// --- the mouse -------------------------------------------------------------

export const ClickingACellFocusesIt: Story = {
  play: async ({ canvasElement }) => {
    // `:focus-visible` never matches a click, so this looked identical to an
    // unfocused cell while genuinely holding focus.
    await gridReady(canvasElement);
    const cell = cellAt(canvasElement, 1, 1);

    await userEvent.click(cell);

    // Focus itself, and the tab stop moving with it. Whether a ring is drawn is
    // Chromatic's to judge; this story is the interaction that puts the grid in
    // the state worth photographing.
    await expect(activeElement()).toBe(cell);
    await expect(tabStops(canvasElement)).toEqual([cell]);
  },
};

export const ClickingElsewhereMovesFocus: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const first = cellAt(canvasElement, 1, 1);
    const second = cellAt(canvasElement, 2, 1);

    await userEvent.click(first);
    await userEvent.click(second);

    await expect(activeElement()).toBe(second);
    await expect(tabStops(canvasElement)).toEqual([second]);
  },
};

// --- focus leaving and coming back -----------------------------------------

export const FocusCanLeaveTheGrid: Story = {
  play: async ({ canvasElement }) => {
    // A remembered position is where Tab would return to, not somewhere that is
    // focused now — so the grid stops drawing on it.
    await gridReady(canvasElement);
    const cell = cellAt(canvasElement, 1, 1);
    await userEvent.click(cell);

    await userEvent.click(document.querySelector('#elsewhere') as HTMLElement);

    // Focus really left, and the grid kept the cell as its way back in.
    await expect(activeElement()).not.toBe(cell);
    await expect(tabStops(canvasElement)).toEqual([cell]);
  },
};

export const FocusComesBackToTheSameCell: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const cell = cellAt(canvasElement, 2, 1);
    await userEvent.click(cell);
    await userEvent.click(document.querySelector('#elsewhere') as HTMLElement);

    tabInto(canvasElement);

    // Focus itself, and the tab stop moving with it. Whether a ring is drawn is
    // Chromatic's to judge; this story is the interaction that puts the grid in
    // the state worth photographing.
    await expect(activeElement()).toBe(cell);
    await expect(tabStops(canvasElement)).toEqual([cell]);
  },
};

export const OneTabStopFollowsFocus: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const start = cellAt(canvasElement, 1, 1);
    await userEvent.click(start);

    await pressKey('ArrowDown');

    const now = activeElement()!;
    await expect(now).not.toBe(start);
    // One tab stop at a time. Two would leave a keyboard user re-entering the
    // grid somewhere they never were.
    await expect(tabStops(canvasElement)).toEqual([now]);
  },
};

// --- the way back in, after scrolling ---------------------------------------

/**
 * The flow layout releases instances as they leave the viewport, and the tab
 * stop is a single cell. Anchored to a released instance it names nothing that
 * is rendered, so the grid loses its only way in: axe reports the scroller as a
 * scrollable region with no focusable content, and a keyboard user who has
 * scrolled cannot reach what they are looking at.
 */
const scrolled = () => mountGrid({ data: instruments(400) });

const scrollerOf = (canvas: HTMLElement) =>
  canvas.querySelector('ls-grid')!.shadowRoot!.querySelector('.scroller') as HTMLElement;

const untilReleased = async (canvas: HTMLElement, gone: string) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const here = [
      ...canvas.querySelector('ls-grid')!.shadowRoot!.querySelectorAll('ls-grid-instance'),
    ].map((instance) => (instance.parentElement as HTMLElement).dataset['instanceId']);
    if (here.length > 0 && !here.includes(gone)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${gone} was never released`);
};

export const TabReachesTheGridAfterScrollingPastItsFirstInstance: Story = {
  render: scrolled,
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const slots = canvasElement
      .querySelector('ls-grid')!
      .shadowRoot!.querySelectorAll('.instance-slot');
    const first = (slots[0] as HTMLElement).dataset['instanceId']!;

    scrollerOf(canvasElement).scrollLeft = 4000;
    await untilReleased(canvasElement, first);
    await gridReady(canvasElement);

    // Throws if nothing holds the roving tabindex, which is the bug itself.
    const stop = tabInto(canvasElement);

    // And it is a cell the reader can actually see, not one off to the left.
    const view = scrollerOf(canvasElement).getBoundingClientRect();
    const cell = stop.getBoundingClientRect();
    await expect(stop.getAttribute('role')).toBe('gridcell');
    await expect(cell.right).toBeGreaterThan(view.left);
    await expect(cell.left).toBeLessThan(view.right);
  },
};

export const ScrollingBackRestoresTheCellFocusWasLeftIn: Story = {
  render: scrolled,
  play: async ({ canvasElement }) => {
    // The position is remembered, not discarded — only the tab stop moves while
    // the instance holding it is away.
    await gridReady(canvasElement);
    const left = tabInto(canvasElement);
    const name = cellsOf(dataRows(canvasElement)[0]!)[0]!;
    await expect(left).toBe(name);

    scrollerOf(canvasElement).scrollLeft = 4000;
    await untilReleased(
      canvasElement,
      (
        canvasElement
          .querySelector('ls-grid')!
          .shadowRoot!.querySelectorAll('.instance-slot')[0] as HTMLElement
      ).dataset['instanceId']!,
    );
    scrollerOf(canvasElement).scrollLeft = 0;
    await gridReady(canvasElement);

    await expect(tabInto(canvasElement)).toBe(cellsOf(dataRows(canvasElement)[0]!)[0]!);
  },
};
