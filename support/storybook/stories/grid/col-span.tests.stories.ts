import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { html } from 'lit';
import type { GridOptions } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import {
  accessibleName,
  activeElement,
  cellsOf,
  dataRows,
  findAllByRole,
  getAllByRole,
  pressKey,
  tabInto,
} from './shadow-queries.js';

/**
 * A spanning cell, and the two things that have to agree with it.
 *
 * The row draws one cell where a span covers three columns. If focus still
 * walked the column list it would stop twice inside a cell that was never
 * rendered — nothing to see, and the next key moving from a position that does
 * not exist. So the renderer and the focus controller resolve spans through the
 * same function, and these check the result from both sides.
 */

interface Row {
  id: string;
  name: string;
  bid: number;
  ask: number;
  isGroup: boolean;
}

const data: Row[] = [
  { id: 'g', name: 'Gilts', bid: 0, ask: 0, isGroup: true },
  { id: 'r0', name: 'UKT 4% 2030', bid: 101, ask: 102, isGroup: false },
  { id: 'r1', name: 'UKT 1% 2041', bid: 98, ask: 99, isGroup: false },
];

const meta: Meta = {
  title: 'Grid/Tests/Column span',
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
    docs: { disable: true },
    a11y: { test: 'error' },
  },
  render: () => {
    const options: GridOptions<Row> = {
      columns: [
        // The heading covers the grid on a group row and nothing on the others.
        {
          field: 'name',
          headerName: 'Name',
          width: 220,
          colSpan: ({ data }) => (data.isGroup ? 3 : 1),
        },
        { field: 'bid', headerName: 'Bid', width: 120 },
        { field: 'ask', headerName: 'Ask', width: 120 },
      ],
      getRowId: (row) => row.id,
      rowHeight: 32,
      headerHeight: 40,
      modules: [],
    };
    return html`
      <div style="width:700px;height:300px">
        <ls-grid .gridOptions=${options} .rowData=${data} style="height:100%"></ls-grid>
      </div>
    `;
  },
};

export default meta;
type Story = StoryObj;

const settled = (canvas: HTMLElement) => findAllByRole(canvas, 'gridcell');

const groupRow = (canvas: HTMLElement) => dataRows(canvas)[0]!;
const childRow = (canvas: HTMLElement) => dataRows(canvas)[1]!;

export const ASpanIsDrawnAsOneCell: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);

    await expect(cellsOf(groupRow(canvasElement))).toHaveLength(1);
    await expect(cellsOf(childRow(canvasElement))).toHaveLength(3);
  },
};

export const ASpanSaysHowFarItReaches: Story = {
  play: async ({ canvasElement }) => {
    // Without this a screen reader counts three columns in a row that draws one
    // cell, and the table it describes stops matching the one on screen.
    await settled(canvasElement);

    await expect(cellsOf(groupRow(canvasElement))[0]!.getAttribute('aria-colspan')).toBe('3');
    // Absent on an ordinary cell rather than set to 1, which is the default.
    await expect(cellsOf(childRow(canvasElement))[0]!.getAttribute('aria-colspan')).toBeNull();
  },
};

export const ASpanCoversTheColumnsItClaims: Story = {
  play: async ({ canvasElement }) => {
    // Measured rather than read off the style: what matters is that the cell
    // ends where the third column ends, however that is arranged.
    await settled(canvasElement);
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
    await settled(canvasElement);
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
    await settled(canvasElement);
    tabInto(canvasElement);

    await pressKey('ArrowDown');
    await pressKey('ArrowRight');
    await expect(accessibleName(activeElement()!)).toBe('101');

    await pressKey('ArrowUp');

    await expect(activeElement()).toBe(cellsOf(groupRow(canvasElement))[0]!);
    await expect(accessibleName(activeElement()!)).toBe('Gilts');
  },
};
