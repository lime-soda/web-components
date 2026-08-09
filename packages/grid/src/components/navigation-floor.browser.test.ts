import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../layouts.js';
import type { Grid } from './grid.js';
import type { GridOptions } from '../controller/grid-controller.js';

/**
 * The keyboard floor a grid has with no modules at all.
 *
 * The grid announces `role="grid"`, and that role tells assistive technology
 * the arrows move around it. While navigation was an optional module, a default
 * grid made that announcement and then ignored every arrow — the announcement
 * was simply untrue, which is worse than having no role.
 *
 * So these mount with `modules: []` on purpose. Anything asserted here has to
 * keep working without a single module imported, or the role is a lie again.
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

let host: HTMLDivElement | undefined;

async function waitFor(condition: () => boolean, timeout = 2000): Promise<void> {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout) throw new Error('timed out');
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

async function mount(): Promise<Grid<Row>> {
  host = document.createElement('div');
  host.style.height = '300px';
  host.style.width = '600px';
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Row>;
  grid.style.height = '100%';
  grid.gridOptions = {
    columns: [
      { field: 'name', headerName: 'Name', width: 200 },
      { field: 'price', headerName: 'Price', width: 120 },
    ],
    getRowId: (row) => row.id,
    modules: [],
  } satisfies GridOptions<Row>;
  grid.rowData = data;
  host.append(grid);

  await waitFor(() => grid.shadowRoot?.querySelector('ls-grid-instance') !== null);
  await waitFor(() => focusOf(grid) !== undefined);
  return grid;
}

const focusOf = (grid: Grid<Row>) => grid.controller?.focus;

const press = (grid: Grid<Row>, key: string, init: KeyboardEventInit = {}) =>
  grid.shadowRoot!.querySelector('.scroller')!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
      ...init,
    }),
  );

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('the navigation floor, with no modules', () => {
  it('enters the grid on the first arrow', async () => {
    const grid = await mount();
    expect(focusOf(grid)!.focused.get()).toBeNull();

    press(grid, 'ArrowDown');

    expect(focusOf(grid)!.focused.get()).not.toBeNull();
  });

  it('moves down and up a row', async () => {
    const grid = await mount();
    press(grid, 'ArrowDown');
    const first = focusOf(grid)!.focused.get();

    press(grid, 'ArrowDown');
    const second = focusOf(grid)!.focused.get();
    expect(second?.rowKey).not.toBe(first?.rowKey);

    press(grid, 'ArrowUp');
    expect(focusOf(grid)!.focused.get()?.rowKey).toBe(first?.rowKey);
  });

  it('moves right and left a column', async () => {
    const grid = await mount();
    press(grid, 'ArrowDown');
    const first = focusOf(grid)!.focused.get();

    press(grid, 'ArrowRight');
    const second = focusOf(grid)!.focused.get();
    expect(second?.colId).not.toBe(first?.colId);

    press(grid, 'ArrowLeft');
    expect(focusOf(grid)!.focused.get()?.colId).toBe(first?.colId);
  });

  it('moves a cell at a time on Tab, and lets go at the end', async () => {
    // Running out is the point: a grid that swallows Tab at its last cell is a
    // keyboard trap, which fails WCAG 2.1.2 whatever role it claims.
    const grid = await mount();
    press(grid, 'ArrowDown');

    const moved = press(grid, 'Tab');
    expect(moved).toBe(false); // preventDefault called, so the grid handled it

    focusOf(grid)!.moveToEdge('rowEnd');
    while (focusOf(grid)!.moveCell(1)) {
      /* walk to the very last cell */
    }
    const atEnd = press(grid, 'Tab');
    expect(atEnd, 'Tab was swallowed at the last cell').toBe(true);
  });

  it('gives the grid back on Escape', async () => {
    const grid = await mount();
    press(grid, 'ArrowDown');
    expect(focusOf(grid)!.focused.get()).not.toBeNull();

    press(grid, 'Escape');

    expect(focusOf(grid)!.focused.get()).toBeNull();
  });
});
