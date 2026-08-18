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
