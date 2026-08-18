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
