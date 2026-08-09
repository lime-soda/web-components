import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import '../layouts.js';
import { SortModule } from '../modules/sort/index.js';
import { TreeModule } from '../modules/tree/index.js';
import type { Grid } from './grid.js';
import type { GridOptions } from '../controller/grid-controller.js';

/**
 * Whether an ordinary stylesheet can reach the grid's internals.
 *
 * `part` alone does not cross a shadow boundary — each host in between has to
 * forward it with `exportparts`. The grid is four boundaries deep
 * (grid → instance → row → cell), so a part on a cell needs forwarding at three
 * of them to be visible to the page. Without it `::part(cell)` silently matches
 * nothing, which is indistinguishable from a typo in the consumer's CSS.
 *
 * These style through the host, exactly as a consumer would, and read the
 * result off the element itself.
 */

interface Row {
  id: string;
  parentId: string | null;
  name: string;
  price: number;
}

// A parent and its children, so the tree module renders an expander to test a
// module-contributed part with.
const data: Row[] = [
  { id: 'g', parentId: null, name: 'Group', price: 0 },
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `r${i}`,
    parentId: 'g',
    name: `Row ${i}`,
    price: i,
  })),
];

/** Distinctive enough that nothing else could produce it. */
const MARK = 'rgb(1, 2, 3)';

let host: HTMLDivElement | undefined;
let sheet: HTMLStyleElement | undefined;

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
    modules: [
      new SortModule<Row>(),
      new TreeModule<Row>({ getParentId: (row) => row.parentId, defaultExpanded: true }),
    ],
  } satisfies GridOptions<Row>;
  grid.rowData = data;
  host.append(grid);

  await waitFor(() => grid.shadowRoot?.querySelector('ls-grid-instance') !== null);
  await waitFor(() => firstCell(grid) !== null);
  return grid;
}

const instanceOf = (grid: Grid<Row>) =>
  grid.shadowRoot!.querySelector('ls-grid-instance') as HTMLElement;
const rowOf = (grid: Grid<Row>) =>
  instanceOf(grid).shadowRoot!.querySelector('ls-grid-row') as HTMLElement | null;
const firstCell = (grid: Grid<Row>) =>
  rowOf(grid)?.shadowRoot?.querySelector('ls-grid-cell') as HTMLElement | null;
const headerCellOf = (grid: Grid<Row>) =>
  instanceOf(grid).shadowRoot!.querySelector('ls-grid-header-cell') as HTMLElement | null;

/** Adds page-level CSS targeting the grid through `::part`. */
function style(css: string): void {
  sheet = document.createElement('style');
  sheet.textContent = css;
  document.head.append(sheet);
}

beforeEach(() => {
  sheet = undefined;
});

afterEach(() => {
  host?.remove();
  host = undefined;
  sheet?.remove();
  sheet = undefined;
});

describe('::part reaches the grid from page CSS', () => {
  it('reaches the scroller, which is in the grid’s own shadow root', async () => {
    style(`ls-grid::part(scroller) { outline-color: ${MARK}; }`);
    const grid = await mount();

    const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
    expect(getComputedStyle(scroller).outlineColor).toBe(MARK);
  });

  it('reaches an instance, one boundary down', async () => {
    style(`ls-grid::part(instance) { outline-color: ${MARK}; }`);
    const grid = await mount();

    expect(getComputedStyle(instanceOf(grid)).outlineColor).toBe(MARK);
  });

  it('reaches a row, two boundaries down', async () => {
    style(`ls-grid::part(row) { outline-color: ${MARK}; }`);
    const grid = await mount();

    expect(getComputedStyle(rowOf(grid)!).outlineColor).toBe(MARK);
  });

  it('reaches a cell, three boundaries down', async () => {
    style(`ls-grid::part(cell) { outline-color: ${MARK}; }`);
    const grid = await mount();

    expect(getComputedStyle(firstCell(grid)!).outlineColor).toBe(MARK);
  });

  it('reaches a header cell', async () => {
    style(`ls-grid::part(header-cell) { outline-color: ${MARK}; }`);
    const grid = await mount();

    expect(getComputedStyle(headerCellOf(grid)!).outlineColor).toBe(MARK);
  });

  it('reaches inside a cell, four boundaries down', async () => {
    style(`ls-grid::part(cell-content) { outline-color: ${MARK}; }`);
    const grid = await mount();

    const content = firstCell(grid)!.shadowRoot!.querySelector(
      '[part="cell-content"]',
    ) as HTMLElement;
    expect(getComputedStyle(content).outlineColor).toBe(MARK);
  });

  it('reaches a part a module contributed', async () => {
    // The tree expander is rendered by the tree module into a cell, so it is as
    // deep as anything core owns and is named nowhere in core — it reaches page
    // CSS only through the module's own `parts` declaration.
    style(`ls-grid::part(tree-expander) { outline-color: ${MARK}; }`);
    const grid = await mount();

    const expander = firstCell(grid)!.shadowRoot!.querySelector(
      '[part="tree-expander"]',
    ) as HTMLElement | null;

    expect(expander, 'no tree expander rendered').not.toBeNull();
    expect(getComputedStyle(expander!).outlineColor).toBe(MARK);
  });
});
