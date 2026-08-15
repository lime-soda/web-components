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
  pressKey,
  tabInto,
} from './shadow-queries.js';

/**
 * The keyboard floor a grid has with no modules at all.
 *
 * `role="grid"` tells assistive technology the arrows move around it. While
 * navigation was an optional module a default grid made that announcement and
 * then ignored every arrow, which is worse than claiming no role.
 *
 * Every story here mounts `modules: []` on purpose: anything asserted has to
 * hold with nothing imported, or the role is a lie again.
 */

interface Row {
  id: string;
  name: string;
  price: number;
}

const data: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  price: i,
}));

interface Args {
  layout: 'flow' | 'stack';
}

const meta: Meta<Args> = {
  title: 'Grid/Tests/Navigation',
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
    docs: { disable: true },
    a11y: { test: 'error' },
  },
  args: { layout: 'flow' },
  render: (args) => {
    const options: GridOptions<Row> = {
      columns: [
        { field: 'name', headerName: 'Name', width: 200 },
        { field: 'price', headerName: 'Price', width: 120 },
      ],
      getRowId: (row) => row.id,
      layout: args.layout,
      rowHeight: 32,
      headerHeight: 40,
      modules: [],
    };
    // The trailing button is load-bearing: it is what Tab has to reach when the
    // grid lets go, and without something after it there is nowhere to land.
    return html`
      <div style="width:600px;height:300px">
        <ls-grid .gridOptions=${options} .rowData=${data} style="height:100%"></ls-grid>
      </div>
      <button id="after">After the grid</button>
    `;
  },
};

export default meta;
type Story = StoryObj<Args>;

const settled = (canvas: HTMLElement) => findAllByRole(canvas, 'gridcell');

/** Where focus is, described the way the grid presents it. */
function focusedCell(canvas: HTMLElement): { row: number; column: number; name: string } | null {
  const cell = activeElement();
  if (!cell || cell.tagName !== 'LS-GRID-CELL') return null;

  const rows = dataRows(canvas);
  for (const [row, element] of rows.entries()) {
    const column = cellsOf(element).indexOf(cell as HTMLElement);
    if (column !== -1) return { row, column, name: accessibleName(cell) };
  }
  return null;
}

/** Enters the grid the way Tab does, then reports where focus landed. */
async function tabIn(canvas: HTMLElement) {
  await settled(canvas);
  tabInto(canvas);
  return focusedCell(canvas);
}

export const TabEntersTheGrid: Story = {
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    await expect(focusedCell(canvasElement)).toBeNull();

    const landed = await tabIn(canvasElement);

    await expect(landed).not.toBeNull();
    await expect(landed!.name).toBe('Row 0');
  },
};

export const ArrowsMoveByRow: Story = {
  play: async ({ canvasElement }) => {
    const start = await tabIn(canvasElement);

    await pressKey('ArrowDown');
    const down = focusedCell(canvasElement);
    await expect(down!.row).toBe(start!.row + 1);

    await pressKey('ArrowUp');
    await expect(focusedCell(canvasElement)!.row).toBe(start!.row);
  },
};

export const ArrowsMoveByColumn: Story = {
  play: async ({ canvasElement }) => {
    const start = await tabIn(canvasElement);

    await pressKey('ArrowRight');
    const right = focusedCell(canvasElement);
    await expect(right!.column).toBe(start!.column + 1);

    await pressKey('ArrowLeft');
    await expect(focusedCell(canvasElement)!.column).toBe(start!.column);
  },
};

export const TabStepsOneCellAtATime: Story = {
  play: async ({ canvasElement }) => {
    // Reading order: along the row, then on to the next.
    const start = await tabIn(canvasElement);

    await pressKey('Tab');
    await expect(focusedCell(canvasElement)).toEqual({
      row: start!.row,
      column: start!.column + 1,
      name: '0',
    });
  },
};

export const TabLetsGoAtTheLastCell: Story = {
  play: async ({ canvasElement }) => {
    // Running out is the point. A grid that swallows Tab at its last cell is a
    // keyboard trap, which fails WCAG 2.1.2 whatever role it claims.
    //
    // What is checked is that the grid stops claiming the key: it cancels Tab
    // while it still has somewhere to go, and at the last cell it does not,
    // leaving the browser to move focus onward. The browser's own half cannot
    // be driven from a synthetic event, so this is the half that is ours.
    await tabIn(canvasElement);
    await expect(await pressKey('Tab')).toBe(true);

    for (let i = 0; i < 40; i += 1) {
      if (!(await pressKey('Tab'))) break;
    }

    await expect(await pressKey('Tab'), 'Tab was still being swallowed').toBe(false);
  },
};

export const NavigatesTheStackLayout: Story = {
  args: { layout: 'stack' },
  play: async ({ canvasElement }) => {
    // The stack renders its header outside the scroller, which is the sort of
    // asymmetry that leaves one layout navigable and the other not.
    const start = await tabIn(canvasElement);
    await expect(start).not.toBeNull();

    await pressKey('ArrowDown');
    await expect(focusedCell(canvasElement)!.row).toBe(start!.row + 1);

    await pressKey('ArrowRight');
    await expect(focusedCell(canvasElement)!.column).toBe(start!.column + 1);
  },
};
