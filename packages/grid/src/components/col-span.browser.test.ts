import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../layouts.js';
import type { Grid } from './grid.js';
import type { GridOptions } from '../controller/grid-controller.js';

/**
 * A spanning cell, and the two things that have to agree with it.
 *
 * The row draws one cell where a span covers three columns. If focus still
 * walked the column list it would stop twice inside a cell that was never
 * rendered — no ring, and the next key moving from a position that does not
 * exist. So the renderer and the focus controller resolve spans through the
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
  host.style.width = '700px';
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Row>;
  grid.style.height = '100%';
  grid.gridOptions = {
    columns: [
      // The heading covers the grid on a group row and nothing on the others.
      { field: 'name', width: 220, colSpan: ({ data }) => (data.isGroup ? 3 : 1) },
      { field: 'bid', width: 120 },
      { field: 'ask', width: 120 },
    ],
    getRowId: (row) => row.id,
    modules: [],
  } satisfies GridOptions<Row>;
  grid.rowData = data;
  host.append(grid);

  await waitFor(() => rows(grid).length > 0);
  return grid;
}

const rows = (grid: Grid<Row>) => [
  ...(grid.shadowRoot
    ?.querySelector('ls-grid-instance[part="instance"]')
    ?.shadowRoot?.querySelectorAll('ls-grid-row') ?? []),
];

const cellsIn = (row: Element) => [...row.shadowRoot!.querySelectorAll('ls-grid-cell')];

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('colSpan', () => {
  it('draws one cell for the span and three for an ordinary row', async () => {
    const grid = await mount();
    const [group, child] = rows(grid);

    expect(cellsIn(group!)).toHaveLength(1);
    expect(cellsIn(child!)).toHaveLength(3);
  });

  it('tells assistive technology how far the cell reaches', async () => {
    const grid = await mount();
    const [group, child] = rows(grid);

    expect(cellsIn(group!)[0]!.getAttribute('aria-colspan')).toBe('3');
    // Not set at all on a single-column cell, rather than set to 1.
    expect(cellsIn(child!)[0]!.getAttribute('aria-colspan')).toBeNull();
  });

  it('gives the cell the grid tracks to match', async () => {
    const grid = await mount();
    const cell = cellsIn(rows(grid)[0]!)[0] as HTMLElement;

    expect(getComputedStyle(cell).gridColumn).toContain('span 3');
  });

  it('steps over the span instead of stopping inside it', async () => {
    const grid = await mount();
    const focus = grid.controller!.focus;

    focus.focusFirst();
    expect(focus.focused.get()?.rowKey).toBe('g');
    expect(focus.focused.get()?.colId).toBe('name');

    // One press leaves the span entirely: there is nothing to its right in
    // this row, so the move is refused rather than landing mid-cell.
    expect(focus.moveColumn(1)).toBe(false);
    expect(focus.focused.get()?.colId).toBe('name');
  });

  it('snaps onto the covering cell when arriving from a normal row', async () => {
    const grid = await mount();
    const focus = grid.controller!.focus;

    focus.focusFirst();
    focus.moveRow(1); // onto the first instrument
    focus.moveColumn(1); // its bid
    expect(focus.focused.get()?.colId).toBe('bid');

    focus.moveRow(-1); // back up into the group heading

    // 'bid' has no cell in that row; focus belongs on the cell covering it.
    expect(focus.focused.get()?.colId).toBe('name');
  });
});
