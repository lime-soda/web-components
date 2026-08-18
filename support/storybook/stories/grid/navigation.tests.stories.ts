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

/**
 * Enough rows to break across instances.
 *
 * Eight fit an instance at this height, so thirty fills four of them. The
 * previous six filled one, which made every story here a test of the stack
 * layout wearing the flow layout's name: nothing ever crossed a boundary, and
 * crossing boundaries is the only thing the flow layout does differently.
 */
const data: Row[] = Array.from({ length: 30 }, (_, i) => ({
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

/** The instances the layout drew, which is what makes flow flow. */
const instances = (canvas: HTMLElement): Element[] => [
  ...canvas.querySelector('ls-grid')!.shadowRoot!.querySelectorAll('ls-grid-instance'),
];

/**
 * Which instance a cell belongs to.
 *
 * Asserting on the row's position in the whole grid is not enough: row nine is
 * row nine whether the layout drew one instance or four, so a story claiming a
 * boundary was crossed would pass without one existing.
 */
function instanceHolding(canvas: HTMLElement, cell: Element | null): number {
  // Climbed rather than `contains`: a cell sits in the row's shadow root, which
  // sits in the instance's, and containment does not cross either boundary.
  for (let node = cell; node; node = parentOf(node)) {
    if (node.tagName === 'LS-GRID-INSTANCE') return instances(canvas).indexOf(node);
  }
  return -1;
}

const parentOf = (element: Element): Element | null =>
  element.parentElement ?? (element.getRootNode() as ShadowRoot).host ?? null;

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

export const FlowDrawsSeveralInstances: Story = {
  play: async ({ canvasElement }) => {
    // The premise every other story here rests on. Without it they would all
    // pass against a single instance and prove nothing about this layout.
    await settled(canvasElement);

    await expect(instances(canvasElement).length).toBeGreaterThan(1);
  },
};

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

    for (let i = 0; i < 200; i += 1) {
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

/** Where the row index sits in the whole grid, counting across instances. */
function positionOf(canvas: HTMLElement) {
  const cell = activeElement();
  const rows = dataRows(canvas);
  for (const [index, row] of rows.entries()) {
    const column = cellsOf(row).indexOf(cell as HTMLElement);
    if (column !== -1) return { index, column, name: accessibleName(cell!) };
  }
  return null;
}

export const ArrowingDownCarriesIntoTheNextInstance: Story = {
  play: async ({ canvasElement }) => {
    // The rows are one list drawn in columns, so walking off the bottom of one
    // instance continues at the top of the next rather than stopping.
    await settled(canvasElement);
    await tabIn(canvasElement);

    await expect(instanceHolding(canvasElement, activeElement())).toBe(0);

    // Eight rows fit, so nine presses must have left the first instance.
    for (let i = 0; i < 9; i += 1) await pressKey('ArrowDown');

    await expect(positionOf(canvasElement)!.name).toBe('Row 9');
    await expect(instanceHolding(canvasElement, activeElement())).toBe(1);
  },
};

export const ArrowingRightAtTheLastColumnCrossesInstances: Story = {
  play: async ({ canvasElement }) => {
    // Off the right edge is the neighbouring instance at its left edge, on the
    // same row — the eye follows the value across.
    await settled(canvasElement);
    await tabIn(canvasElement);
    const start = positionOf(canvasElement)!;

    await expect(instanceHolding(canvasElement, activeElement())).toBe(0);

    await pressKey('ArrowRight'); // to Price, the last column
    await pressKey('ArrowRight'); // off the edge

    const landed = positionOf(canvasElement)!;
    await expect(landed.column).toBe(0);
    await expect(instanceHolding(canvasElement, activeElement())).toBe(1);
    // The same row across the join, so the eye follows the value.
    await expect(landed.index - start.index).toBe(8);
  },
};
