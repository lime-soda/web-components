import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { html } from 'lit';
import type { ColumnDef, Grid, GridOptions } from '@lime-soda/grid';
import '@lime-soda/grid';
import '@lime-soda/grid/layouts';
import { ColumnsModule } from '@lime-soda/grid/columns';

/**
 * Behaviour, kept out of the demo stories.
 *
 * These exist to be run, not read: each one mounts the narrowest grid that can
 * show the thing it asserts, which makes for poor documentation and precise
 * tests. The demo stories next door are the opposite, and the two spoil each
 * other when mixed.
 */

interface Quote {
  id: string;
  instrument: string;
  price: number;
  size: number;
}

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', headerName: 'Instrument', width: 200 },
  { field: 'price', headerName: 'Price', width: 150 },
  { field: 'size', headerName: 'Size', width: 150 },
];

const rows: Quote[] = Array.from({ length: 6 }, (_, i) => ({
  id: `q${i}`,
  instrument: `INS${i}`,
  price: 100 + i,
  size: 1000 + i,
}));

interface Args {
  module: ColumnsModule<Quote>;
  columns: ColumnDef<Quote>[];
  width: number;
}

const meta: Meta<Args> = {
  title: 'Grid/Tests/Columns',
  parameters: {
    layout: 'fullscreen',
    // Behaviour, not appearance. Several of these end mid-interaction, where a
    // snapshot is a picture of a drag in progress rather than a baseline worth
    // diffing.
    chromatic: { disableSnapshot: true },
    docs: { disable: true },
    a11y: { test: 'error' },
  },
  render: (args) => {
    const options: GridOptions<Quote> = {
      columns: args.columns,
      layout: 'stack',
      rowHeight: 32,
      headerHeight: 40,
      modules: [args.module],
    };
    return html`
      <div style=${`width:${args.width}px;height:280px`}>
        <ls-grid .gridOptions=${options} .rowData=${rows} style="height:100%"></ls-grid>
      </div>
    `;
  },
};

export default meta;
type Story = StoryObj<Args>;

// --- helpers ---------------------------------------------------------------

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits for the grid to have mounted an instance with header cells. */
async function ready(canvasElement: HTMLElement): Promise<Grid<Quote>> {
  const grid = canvasElement.querySelector('ls-grid') as Grid<Quote>;
  await grid.updateComplete;
  for (let i = 0; i < 20 && headers(grid).length === 0; i += 1) await frame();
  await frame();
  return grid;
}

const headers = (grid: Grid<Quote>): HTMLElement[] =>
  [...grid.shadowRoot!.querySelectorAll('ls-grid-instance')].flatMap((instance) => [
    ...instance.shadowRoot!.querySelectorAll('ls-grid-header-cell'),
  ]) as HTMLElement[];

const cellsAt = (grid: Grid<Quote>, index: number): HTMLElement[] =>
  [...grid.shadowRoot!.querySelectorAll('ls-grid-instance')].flatMap((instance) =>
    [...instance.shadowRoot!.querySelectorAll('ls-grid-row')].map(
      (row) => [...row.shadowRoot!.querySelectorAll('ls-grid-cell')][index] as HTMLElement,
    ),
  );

const control = (header: HTMLElement, selector: string) =>
  header.shadowRoot!.querySelector(selector) as HTMLElement | null;

/**
 * A pointer drag.
 *
 * Capture is stubbed: `setPointerCapture` rejects a pointerId that never
 * belonged to a real pointer, and a synthetic PointerEvent cannot create one.
 * The events therefore reach the handle directly, so what is under test is what
 * the handlers do with the positions — not the capture call itself.
 */
async function drag(element: HTMLElement, fromX: number, toX: number, y: number): Promise<void> {
  const shared = { bubbles: true, composed: true, pointerId: 1, pointerType: 'mouse' };
  element.setPointerCapture = () => {};
  element.releasePointerCapture = () => {};

  element.dispatchEvent(new PointerEvent('pointerdown', { ...shared, clientX: fromX, clientY: y }));
  for (const x of [fromX + (toX - fromX) / 2, toX]) {
    element.dispatchEvent(new PointerEvent('pointermove', { ...shared, clientX: x, clientY: y }));
    await frame();
  }
  element.dispatchEvent(new PointerEvent('pointerup', { ...shared, clientX: toX, clientY: y }));
  await frame();
}

const press = (element: HTMLElement, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));

// --- resize ----------------------------------------------------------------

export const ResizeHandlePlacement: Story = {
  args: { module: new ColumnsModule<Quote>(), columns, width: 700 },
  play: async ({ canvasElement }) => {
    // Positioned against the header cell, not against whatever ancestor happens
    // to be positioned — the failure there is a handle floating elsewhere.
    const grid = await ready(canvasElement);
    const header = headers(grid)[0]!;
    const handle = control(header, '.ls-grid-resize-handle')!;

    const headerBox = header.getBoundingClientRect();
    const handleBox = handle.getBoundingClientRect();

    await expect(handleBox.height).toBeGreaterThan(0);
    await expect(Math.abs(handleBox.right - headerBox.right)).toBeLessThanOrEqual(4);
  },
};

export const ResizeByDrag: Story = {
  args: { module: new ColumnsModule<Quote>(), columns, width: 700 },
  play: async ({ canvasElement, args }) => {
    const grid = await ready(canvasElement);
    const handle = control(headers(grid)[0]!, '.ls-grid-resize-handle')!;
    const box = handle.getBoundingClientRect();

    await drag(handle, box.left + 3, box.left + 103, box.top + 5);
    await grid.updateComplete;

    const width = args.module.getColumnState().find((c) => c.colId === 'instrument')?.width;
    await expect(width).toBeCloseTo(300, -1);
  },
};

export const ResizeFollowsPointerBeyondTheHandle: Story = {
  args: { module: new ColumnsModule<Quote>(), columns, width: 700 },
  play: async ({ canvasElement, args }) => {
    // The width follows the pointer wherever it goes, well outside the 7px
    // handle — which is why the real thing captures the pointer.
    const grid = await ready(canvasElement);
    const handle = control(headers(grid)[0]!, '.ls-grid-resize-handle')!;
    const box = handle.getBoundingClientRect();

    await drag(handle, box.left + 3, box.left + 250, box.top + 5);

    const width = args.module.getColumnState().find((c) => c.colId === 'instrument')!.width!;
    await expect(width).toBeGreaterThan(400);
  },
};

export const ResizeByKeyboard: Story = {
  args: { module: new ColumnsModule<Quote>(), columns, width: 700 },
  play: async ({ canvasElement, args }) => {
    // A drag is not an affordance everyone can use, and a column of numbers
    // ellipsised to nothing is unreadable rather than merely inconvenient.
    const grid = await ready(canvasElement);
    press(control(headers(grid)[0]!, '.ls-grid-resize-handle')!, 'ArrowRight');
    await grid.updateComplete;

    await expect(args.module.getColumnState().find((c) => c.colId === 'instrument')?.width).toBe(
      210,
    );
  },
};

// --- reorder ---------------------------------------------------------------

export const ReorderByDrag: Story = {
  args: { module: new ColumnsModule<Quote>(), columns, width: 700 },
  play: async ({ canvasElement, args }) => {
    const grid = await ready(canvasElement);
    const grip = control(headers(grid)[0]!, '.ls-grid-column-grip')!;
    const third = headers(grid)[2]!.getBoundingClientRect();
    const gripBox = grip.getBoundingClientRect();

    await drag(grip, gripBox.left, third.left + third.width / 2, gripBox.top + 5);
    await grid.updateComplete;
    await frame();

    await expect(args.module.getColumnState().map((c) => c.colId)).toEqual([
      'price',
      'size',
      'instrument',
    ]);
  },
};

export const ReorderByKeyboard: Story = {
  args: { module: new ColumnsModule<Quote>(), columns, width: 700 },
  play: async ({ canvasElement, args }) => {
    const grid = await ready(canvasElement);
    press(control(headers(grid)[0]!, '.ls-grid-column-grip')!, 'ArrowRight');
    await grid.updateComplete;

    await expect(args.module.getColumnState().map((c) => c.colId)).toEqual([
      'price',
      'instrument',
      'size',
    ]);
  },
};

// --- opting out ------------------------------------------------------------

export const NoHandlesWhenDisabled: Story = {
  args: {
    module: new ColumnsModule<Quote>({ resizable: false, reorderable: false }),
    columns,
    width: 700,
  },
  play: async ({ canvasElement }) => {
    // The affordance has to actually disappear: a visible handle that does
    // nothing is worse than none.
    const grid = await ready(canvasElement);
    const header = headers(grid)[0]!;

    await expect(control(header, '.ls-grid-resize-handle')).toBeNull();
    await expect(control(header, '.ls-grid-column-grip')).toBeNull();
  },
};

export const ColumnOptsOut: Story = {
  args: {
    module: new ColumnsModule<Quote>(),
    columns: [{ ...columns[0]!, resizable: false }, ...columns.slice(1)],
    width: 700,
  },
  play: async ({ canvasElement }) => {
    const grid = await ready(canvasElement);

    await expect(control(headers(grid)[0]!, '.ls-grid-resize-handle')).toBeNull();
    await expect(control(headers(grid)[1]!, '.ls-grid-resize-handle')).not.toBeNull();
  },
};

// --- pinning ---------------------------------------------------------------

const pinned: ColumnDef<Quote>[] = [
  { ...columns[0]!, pinned: 'left' },
  { ...columns[1]!, width: 300 },
  { ...columns[2]!, width: 300 },
];

const scroller = (grid: Grid<Quote>) => grid.shadowRoot!.querySelector('.scroller') as HTMLElement;

/** The deepest element painted at a point — `elementFromPoint` stops at each host. */
const deepestAt = (x: number, y: number): Element | null => {
  let element = document.elementFromPoint(x, y);
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
};

const belongsTo = (owner: Element, node: Element | null): boolean => {
  let current: Element | null = node;
  while (current) {
    if (current === owner) return true;
    current = current.parentElement ?? (current.getRootNode() as ShadowRoot).host ?? null;
  }
  return false;
};

export const PinnedColumnHoldsItsPlace: Story = {
  args: { module: new ColumnsModule<Quote>(), columns: pinned, width: 500 },
  play: async ({ canvasElement }) => {
    const grid = await ready(canvasElement);
    const held = cellsAt(grid, 0)[0]!;
    const free = cellsAt(grid, 1)[0]!;
    const before = {
      held: held.getBoundingClientRect().left,
      free: free.getBoundingClientRect().left,
    };

    scroller(grid).scrollLeft = 250;
    await frame();
    await frame();

    const after = {
      held: held.getBoundingClientRect().left,
      free: free.getBoundingClientRect().left,
    };

    await expect(Math.round(before.free - after.free)).toBe(250);
    await expect(Math.abs(after.held - before.held)).toBeLessThanOrEqual(1);
  },
};

export const PinnedHeaderTracksItsCells: Story = {
  args: { module: new ColumnsModule<Quote>(), columns: pinned, width: 500 },
  play: async ({ canvasElement }) => {
    // Separate elements in separate rows: a column that stops in two different
    // places reads as a rendering fault rather than as one pinned column.
    const grid = await ready(canvasElement);
    const header = headers(grid)[0]!;
    const cell = cellsAt(grid, 0)[0]!;

    scroller(grid).scrollLeft = 250;
    await frame();
    await frame();

    await expect(
      Math.abs(header.getBoundingClientRect().left - cell.getBoundingClientRect().left),
    ).toBeLessThanOrEqual(1);
  },
};

export const PinnedColumnPaintsOverTheRest: Story = {
  args: { module: new ColumnsModule<Quote>(), columns: pinned, width: 500 },
  play: async ({ canvasElement }) => {
    // A transparent sticky cell shows the rows sliding beneath it, which no
    // assertion about position would catch.
    const grid = await ready(canvasElement);
    const held = cellsAt(grid, 0)[0]!;

    scroller(grid).scrollLeft = 250;
    await frame();

    const style = getComputedStyle(held);
    await expect(style.position).toBe('sticky');
    await expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    const box = held.getBoundingClientRect();
    const painted = deepestAt(box.left + box.width / 2, box.top + box.height / 2);
    await expect(belongsTo(held, painted)).toBe(true);
  },
};

export const PinningIsInertInFlow: Story = {
  args: { module: new ColumnsModule<Quote>(), columns: pinned, width: 500 },
  render: (args) => {
    const options: GridOptions<Quote> = {
      columns: args.columns,
      layout: 'flow',
      rowHeight: 32,
      headerHeight: 40,
      modules: [args.module],
    };
    return html`
      <div style=${`width:${args.width}px;height:280px`}>
        <ls-grid .gridOptions=${options} .rowData=${rows} style="height:100%"></ls-grid>
      </div>
    `;
  },
  play: async ({ canvasElement }) => {
    // Nothing slides out from under the viewport there, so a sticky column would
    // only detach itself from the rows it belongs to.
    const grid = await ready(canvasElement);
    const first = cellsAt(grid, 0)[0]!;

    await expect(getComputedStyle(first).position).not.toBe('sticky');
    await expect(first.classList.contains('ls-grid-pinned')).toBe(false);
  },
};
