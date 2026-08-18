import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { cellsOf, dataRows, getAllByRole, gridReady } from './shadow-queries.js';
import { COLUMN_WIDTHS, instruments, mountGrid, testStoryParameters } from './fixtures.js';

/**
 * What the grid tells assistive technology about its own shape.
 *
 * A grid that draws its rows in columns across a monitor still has to describe
 * one table: row nine is row nine of the data, not the ninth thing in the panel
 * it happens to be drawn in. Get that wrong and a screen reader reports a
 * different table from the one on the screen.
 *
 * Core's announcements only. What a hierarchy says about itself belongs to the
 * tree stories, and what happens when the arrow keys reach a repeat belongs to
 * navigation.
 */

const data = instruments(6);

const meta: Meta = {
  title: 'Grid/Tests/ARIA',
  parameters: testStoryParameters,
  render: () => mountGrid({ data, height: 300 }),
};

export default meta;
type Story = StoryObj;

const gridOf = (canvas: HTMLElement) => canvas.querySelector('ls-grid')!;

const instancesOf = (canvas: HTMLElement) => [
  ...gridOf(canvas).shadowRoot!.querySelectorAll('ls-grid-instance'),
];

export const TheGridCountsTheWholeDataSet: Story = {
  play: async ({ canvasElement }) => {
    // The count describes the data, not the markup: most of it is not drawn.
    await gridReady(canvasElement);

    await expect(gridOf(canvasElement).getAttribute('aria-colcount')).toBe('3');
    // Six rows plus the header.
    await expect(gridOf(canvasElement).getAttribute('aria-rowcount')).toBe('7');
  },
};

export const TheGridIsAGridUntilItHasAHierarchy: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    await expect(gridOf(canvasElement).getAttribute('role')).toBe('grid');
  },
};

export const AnInstanceIsAGroupOfRowsThatSaysWhich: Story = {
  play: async ({ canvasElement }) => {
    // A reader landing in the middle of a wide grid needs to know where in the
    // data they are, not merely that there is more of it somewhere.
    await gridReady(canvasElement);
    const panel = instancesOf(canvasElement)[0]!;

    await expect(panel.getAttribute('role')).toBe('rowgroup');
    await expect(panel.getAttribute('aria-label')).toMatch(/^Rows 1 to \d+$/);
  },
};

export const RowsAreNumberedFromTheHeaderDown: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const header = instancesOf(canvasElement)[0]!.shadowRoot!.querySelector('.header');

    await expect(header?.getAttribute('aria-rowindex')).toBe('1');
    await expect(dataRows(canvasElement)[0]!.getAttribute('aria-rowindex')).toBe('2');
    await expect(dataRows(canvasElement)[1]!.getAttribute('aria-rowindex')).toBe('3');
  },
};

export const ColumnsAreNumberedOnCellsAndHeadingsAlike: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const cells = cellsOf(dataRows(canvasElement)[0]!);
    const headings = getAllByRole(canvasElement, 'columnheader');

    await expect(cells.map((c) => c.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
    await expect(headings.map((h) => h.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
  },
};

// --- across instances -------------------------------------------------------

/** Forty rows at 300px fill several instances, which is the case that matters. */
const many = mountGrid({ data: instruments(40), height: 300, width: COLUMN_WIDTHS.name * 3 });

export const RowNumbersRunOnFromOneInstanceToTheNext: Story = {
  render: () => many,
  play: async ({ canvasElement }) => {
    // The point of the aggregate model: a row's number is its place in the
    // data, not its place in the panel it happens to be drawn in.
    await gridReady(canvasElement);
    await expect(instancesOf(canvasElement).length).toBeGreaterThan(1);

    const numbers = dataRows(canvasElement).map((row) => Number(row.getAttribute('aria-rowindex')));

    // Continuous and ascending across the join, with no restart.
    for (const [i, number] of numbers.entries()) {
      if (i > 0) await expect(number).toBe(numbers[i - 1]! + 1);
    }
  },
};

export const EveryInstanceSaysWhichRowsItHolds: Story = {
  render: () => many,
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);
    const labels = instancesOf(canvasElement).map((panel) => panel.getAttribute('aria-label'));

    await expect(labels[0]).toMatch(/^Rows 1 to /);
    await expect(labels[1]).not.toBe(labels[0]);
  },
};

export const EveryInstanceHasARealHeadingIndexedOnlyOnce: Story = {
  render: () => many,
  play: async ({ canvasElement }) => {
    // A continuation's heading used to be aria-hidden while staying focusable,
    // which is a contradiction. Focus goes to each instance's own heading on
    // purpose, and once the reader has scrolled right every heading on screen
    // is a continuation — hiding them put sort and filter beyond reach.
    await gridReady(canvasElement);
    const headings = instancesOf(canvasElement).map((panel) =>
      panel.shadowRoot!.querySelector('.header')!,
    );

    await expect(headings.every((h) => h.getAttribute('aria-hidden') === null)).toBe(true);
    await expect(headings[0]!.getAttribute('aria-rowindex')).toBe('1');
    // Only one element claims to be row one of the grid.
    await expect(headings[1]!.getAttribute('aria-rowindex')).toBeNull();
  },
};
