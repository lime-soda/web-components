import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import {
  accessibleName,
  activeElement,
  cellsOf,
  dataRows,
  getAllByRole,
  gridReady,
  pressKey,
  tabInto,
} from './shadow-queries.js';
import { columns, grouped, mountGrid, testStoryParameters } from './fixtures.js';

/**
 * A spanning cell, and the two things that have to agree with it.
 *
 * The row draws one cell where a span covers three columns. If focus still
 * walked the column list it would stop twice inside a cell that was never
 * rendered — nothing to see, and the next key moving from a position that does
 * not exist. So the renderer and the focus controller resolve spans through the
 * same function, and these check the result from both sides.
 */

/** One group and two instruments beneath it. */
const data = grouped(1, 2);

const meta: Meta = {
  title: 'Grid/Tests/Column span',
  parameters: testStoryParameters,
  render: () =>
    mountGrid({
      data,
      options: {
        // The heading covers the grid on a group row and nothing on the others.
        columns: [
          { ...columns[0]!, colSpan: ({ data }) => (data.parentId === null ? 3 : 1) },
          ...columns.slice(1),
        ],
      },
      height: 260,
    }),
};

export default meta;
type Story = StoryObj;

const groupRow = (canvas: HTMLElement) => dataRows(canvas)[0]!;
const childRow = (canvas: HTMLElement) => dataRows(canvas)[1]!;

export const ASpanIsDrawnAsOneCell: Story = {
  play: async ({ canvasElement }) => {
    await gridReady(canvasElement);

    await expect(cellsOf(groupRow(canvasElement))).toHaveLength(1);
    await expect(cellsOf(childRow(canvasElement))).toHaveLength(3);
  },
};

export const ASpanSaysHowFarItReaches: Story = {
  play: async ({ canvasElement }) => {
    // Without this a screen reader counts three columns in a row that draws one
    // cell, and the table it describes stops matching the one on screen.
    await gridReady(canvasElement);

    await expect(cellsOf(groupRow(canvasElement))[0]!.getAttribute('aria-colspan')).toBe('3');
    // Absent on an ordinary cell rather than set to 1, which is the default.
    await expect(cellsOf(childRow(canvasElement))[0]!.getAttribute('aria-colspan')).toBeNull();
  },
};

export const ASpanCoversTheColumnsItClaims: Story = {
  play: async ({ canvasElement }) => {
    // Measured rather than read off the style: what matters is that the cell
    // ends where the third column ends, however that is arranged.
    await gridReady(canvasElement);
    const heading = getAllByRole(canvasElement, 'columnheader');
    const spanned = cellsOf(groupRow(canvasElement))[0]!;

    const declared = heading
      .slice(0, 3)
      .reduce((total, column) => total + column.getBoundingClientRect().width, 0);

    await expect(spanned.getBoundingClientRect().width).toBeCloseTo(declared, 0);
  },
};

export const ArrowingRightLeavesTheSpanRatherThanEnteringIt: Story = {
  play: async ({ canvasElement }) => {
    // There is nothing to the right of a span that reaches the last column, so
    // the move is refused rather than landing inside a cell that was never
    // drawn.
    await gridReady(canvasElement);
    tabInto(canvasElement);
    const spanned = cellsOf(groupRow(canvasElement))[0]!;
    await expect(activeElement()).toBe(spanned);

    await pressKey('ArrowRight');

    await expect(activeElement()).toBe(spanned);
  },
};

export const ArrowingUpSnapsOntoTheCoveringCell: Story = {
  play: async ({ canvasElement }) => {
    // The bid column has no cell of its own in the heading row, so focus
    // belongs on whatever covers it rather than nowhere at all.
    await gridReady(canvasElement);
    tabInto(canvasElement);

    await pressKey('ArrowDown');
    await pressKey('ArrowRight');
    await expect(accessibleName(activeElement()!)).toBe('100');

    await pressKey('ArrowUp');

    await expect(activeElement()).toBe(cellsOf(groupRow(canvasElement))[0]!);
    await expect(accessibleName(activeElement()!)).toBe('Group 0');
  },
};
