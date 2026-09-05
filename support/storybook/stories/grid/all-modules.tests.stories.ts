import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { SortModule } from '@lime-soda/grid/sort';
import { FilterModule } from '@lime-soda/grid/filter';
import { SelectionModule } from '@lime-soda/grid/selection';
import { TreeSelectionModule } from '@lime-soda/grid/selection/tree';
import { CellFlashModule } from '@lime-soda/grid/cell-flash';
import { KeyboardModule } from '@lime-soda/grid/keyboard';
import { RangeModule } from '@lime-soda/grid/range';
import { EditModule } from '@lime-soda/grid/edit';
import { ClipboardModule } from '@lime-soda/grid/clipboard';
import type { Grid } from '@lime-soda/grid';
import {
  cellText,
  activeElement,
  cellsOf,
  dataRows,
  getAllByRole,
  getByRole,
  gridReady,
  pressKey,
  queryAllByRole,
  tabInto,
} from './shadow-queries.js';
import { type Instrument, grouped, mountGrid, testStoryParameters } from './fixtures.js';

/**
 * Every module installed at once.
 *
 * Each has its own stories, but those run one module at a time and so say
 * nothing about collisions. The two real bugs found by hand needed exactly this
 * combination to appear: the tree expander landing in the selection module's
 * checkbox column, because it defaulted to the first column and selection had
 * just prepended one; and group rows being unselectable.
 *
 * This is the only file here that owns no single feature. What it owns is what
 * happens where they meet.
 */

const data = grouped(2, 4);

const everything = () => [
  new TreeModule<Instrument>({ getParentId: (row) => row.parentId, defaultExpanded: true }),
  new SortModule<Instrument>(),
  new FilterModule<Instrument>({ headerUi: true }),
  new SelectionModule<Instrument>({ mode: 'multi', checkboxColumn: true }),
  new TreeSelectionModule<Instrument>({ getParentId: (row) => row.parentId }),
  new CellFlashModule<Instrument>(),
  new KeyboardModule<Instrument>(),
  new RangeModule<Instrument>(),
  // Editing and the clipboard were missing from "every module at once", which
  // is the one fixture whose job is to find collisions. Both bind keys.
  // Editable, or there is nothing for Ctrl-D to write and the key is correctly
  // declined — which would make the collision test below pass for the wrong
  // reason.
  new EditModule<Instrument>({ editable: true }),
  new ClipboardModule<Instrument>({ pasteOnKeyboard: true }),
];

const meta: Meta = {
  title: 'Grid/Tests/All modules',
  parameters: testStoryParameters,
  render: () =>
    mountGrid({
      data,
      height: 400,
      width: 620,
      options: { layout: 'stack', modules: everything() },
    }),
};

export default meta;
type Story = StoryObj;

/** The instrument column, row by row, without the controls beside the values. */
const rowNames = (canvas: HTMLElement) => dataRows(canvas).map((row) => cellText(cellsOf(row)[1]!));

// --- who owns which column --------------------------------------------------

export const TheExpanderAvoidsTheCheckboxColumn: Story = {
  play: async ({ canvasElement }) => {
    // The collision that shipped once: the expander defaulted to the first
    // column, which selection had just prepended a checkbox into.
    await gridReady(canvasElement);
    const [selectionCell, nameCell] = cellsOf(dataRows(canvasElement)[0]!);

    await expect(queryAllByRole(selectionCell!, 'checkbox')).toHaveLength(1);
    await expect(
      queryAllByRole(selectionCell!, 'button', { name: /Collapse|Expand/ }),
    ).toHaveLength(0);
    await expect(queryAllByRole(nameCell!, 'button', { name: /Collapse|Expand/ })).toHaveLength(1);
  },
};

export const EveryRowHasAUsableCheckbox: Story = {
  play: async ({ canvasElement }) => {
    // Present, and inside its cell rather than clipped out of it.
    await gridReady(canvasElement);

    for (const row of dataRows(canvasElement)) {
      const cell = cellsOf(row)[0]!;
      const [box] = queryAllByRole(cell, 'checkbox');
      await expect(box).toBeTruthy();

      const cellBox = cell.getBoundingClientRect();
      const inputBox = box!.getBoundingClientRect();
      await expect(inputBox.left).toBeGreaterThanOrEqual(cellBox.left - 1);
      await expect(inputBox.right).toBeLessThanOrEqual(cellBox.right + 1);
    }
  },
};

export const TheCheckboxColumnOffersNoSortOrFilter: Story = {
  play: async ({ canvasElement }) => {
    // It holds controls, not values, so sorting or filtering by it means
    // nothing — and an affordance that does nothing is worse than none.
    await gridReady(canvasElement);
    const [selectionHeading] = getAllByRole(canvasElement, 'columnheader');

    await expect(queryAllByRole(selectionHeading!, 'searchbox')).toHaveLength(0);
    await expect(
      queryAllByRole(selectionHeading!, 'button', { name: 'Row selection' }),
    ).toHaveLength(0);
  },
};

// --- modules cooperating ----------------------------------------------------

export const SortingOrdersSiblingsWithoutFlatteningTheTree: Story = {
  play: async ({ canvasElement }) => {
    // Groups stay where they are; their children reorder within them.
    await gridReady(canvasElement);

    await userEvent.click(getByRole(canvasElement, 'button', { name: 'Price' }));
    await userEvent.click(getByRole(canvasElement, 'button', { name: 'Price' }));
    await gridReady(canvasElement);

    const names = rowNames(canvasElement);
    await expect(names[0]).toBe('Group 0');
    await expect(names.slice(1, 5)).toEqual(['INS 0.3', 'INS 0.2', 'INS 0.1', 'INS 0.0']);
  },
};

export const FilteringKeepsTheGroupAMatchLivesIn: Story = {
  play: async ({ canvasElement }) => {
    // A child without its heading is an orphan on screen: the reader cannot see
    // what it belongs to.
    await gridReady(canvasElement);
    const filter = getAllByRole(canvasElement, 'searchbox')[0]!;

    await userEvent.click(filter);
    await userEvent.type(filter, 'INS 1.2');
    await gridReady(canvasElement);

    await expect(rowNames(canvasElement)).toEqual(['Group 1', 'INS 1.2']);
  },
};

export const TickingAGroupTakesOnlyWhatTheFilterLeft: Story = {
  play: async ({ canvasElement }) => {
    // Selecting a group selects what the reader can see under it, not the rows
    // a filter has taken away.
    await gridReady(canvasElement);
    const filter = getAllByRole(canvasElement, 'searchbox')[0]!;
    await userEvent.click(filter);
    await userEvent.type(filter, 'INS 0.1');
    await gridReady(canvasElement);

    await userEvent.click(getAllByRole(canvasElement, 'checkbox')[1]!);

    const selected = dataRows(canvasElement).filter(
      (row) => row.getAttribute('aria-selected') === 'true',
    );
    await expect(selected.map((row) => cellText(cellsOf(row)[1]!))).toEqual(['Group 0', 'INS 0.1']);
  },
};

export const KeyboardWalksPastTheControlsRatherThanIntoThem: Story = {
  play: async ({ canvasElement }) => {
    // A checkbox and an expander are both focusable in their own right. The
    // grid's own focus has to step over them, or arrowing down a column lands
    // in a control the reader never asked for.
    await gridReady(canvasElement);
    tabInto(canvasElement);

    for (let i = 0; i < 4; i += 1) await pressKey('ArrowDown');

    await expect(activeElement()?.tagName).toBe('LS-GRID-CELL');
  },
};

export const ShiftArrowExtendsARangeRatherThanNavigating: Story = {
  play: async ({ canvasElement }) => {
    // The collision this file exists for, and one that shipped: the keyboard
    // module claimed every arrow key and reported it handled, so the range
    // module — registered after it — was never offered the press. Shift-arrow
    // moved the caret and drew nothing. The range stories could not see it,
    // because that fixture installs no keyboard module.
    //
    // Focus goes to a cell directly rather than by tabbing in: with every
    // module installed the first tab stop is a control a module contributed
    // and not a cell, so the first arrow would be spent entering the grid
    // instead of extending anything. The instrument column, since selection has
    // prepended a checkbox one ahead of it.
    await gridReady(canvasElement);
    cellsOf(dataRows(canvasElement)[1]!)[1]!.focus();

    await pressKey('ArrowDown', { shiftKey: true });

    const range = (canvasElement.querySelector('ls-grid') as Grid<Instrument>).api.getCellRange();
    await expect(range?.rowIds).toHaveLength(2);
    await expect(range?.colIds).toEqual(['name']);
  },
};

export const APlainArrowNavigatesAndDropsTheRange: Story = {
  play: async ({ canvasElement }) => {
    // The mirror of the bug above, and the reason the range no longer decides
    // this from a key press: the keyboard module handles an unshifted arrow, so
    // the range module is never offered it and cannot clear on it. It reads
    // where the caret ended up instead, which is state both agree on however it
    // got there.
    await gridReady(canvasElement);
    const grid = canvasElement.querySelector('ls-grid') as Grid<Instrument>;
    cellsOf(dataRows(canvasElement)[1]!)[1]!.focus();
    await pressKey('ArrowDown', { shiftKey: true });
    await expect(grid.api.getCellRange()?.rowIds).toHaveLength(2);

    // Out of the rectangle, so there is nothing left for it to describe.
    await pressKey('ArrowDown');
    await pressKey('ArrowDown');

    await expect(grid.api.getCellRange()).toBeNull();
    // ...and the arrow still did its own job.
    await expect(activeElement()?.tagName).toBe('LS-GRID-CELL');
  },
};

export const CtrlDReachesTheEditModule: Story = {
  play: async ({ canvasElement }) => {
    // Ctrl-D competes with the browser's bookmark binding and, more to the
    // point here, with every other module that claims a key first. The range
    // and keyboard collision that shipped was exactly this shape.
    await gridReady(canvasElement);
    const grid = canvasElement.querySelector('ls-grid') as Grid<Instrument>;
    cellsOf(dataRows(canvasElement)[1]!)[1]!.focus();
    await pressKey('ArrowDown', { shiftKey: true });

    const source = cellText(cellsOf(dataRows(canvasElement)[1]!)[1]!);
    await expect(await pressKey('d', { ctrlKey: true })).toBe(true);
    await gridReady(canvasElement);

    // The row below took the row above's value, so the press reached the module
    // rather than merely being swallowed by one.
    await expect(cellText(cellsOf(dataRows(canvasElement)[2]!)[1]!)).toBe(source);
    await expect(grid.api.getCellRange()).not.toBeNull();
  },
};

export const CtrlVReachesTheClipboardModule: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    cellsOf(dataRows(canvasElement)[1]!)[1]!.focus();

    await expect(await pressKey('v', { ctrlKey: true })).toBe(true);
  },
};

export const CollapsingAGroupDropsItsChildren: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const before = dataRows(canvasElement).length;

    await userEvent.click(getAllByRole(canvasElement, 'button', { name: /Collapse|Expand/ })[0]!);
    await gridReady(canvasElement);

    await expect(dataRows(canvasElement).length).toBeLessThan(before);
    await expect(rowNames(canvasElement)).toContain('Group 1');
  },
};
