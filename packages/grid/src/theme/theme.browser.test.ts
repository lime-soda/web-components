import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../index.js';
import '../layouts.js';
import type { ColumnDef } from '../columns/types.js';
import type { GridOptions } from '../controller/grid-controller.js';
import type { Grid } from '../components/grid.js';
import { TreeModule } from '../modules/tree/index.js';
import { SortModule } from '../modules/sort/index.js';
import { SelectionModule } from '../modules/selection/index.js';
import type {} from './tokens.js';

/**
 * Waits for a condition, polling by frame.
 *
 * Mounting depends on ResizeObserver measuring the container and then an
 * IntersectionObserver reporting which instances are near the viewport. Both are
 * delivered asynchronously and neither guarantees a frame count, so waiting a
 * fixed number of frames is a race that a loaded CI box loses.
 */
async function waitFor(
  condition: () => boolean,
  { timeout = 4000, description = 'condition' } = {},
): Promise<void> {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${description}.`);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/**
 * Proves the theme reaches rendered pixels.
 *
 * Token-level tests confirm the mapping; these confirm that the resulting
 * custom properties actually inherit through every shadow root and win over the
 * component defaults, including for markup a module contributed.
 */

interface Row {
  id: string;
  parentId: string | null;
  name: string;
  price: number;
}

const columns: ColumnDef<Row>[] = [
  { field: 'name', width: 200 },
  { field: 'price', width: 100 },
];

const data: Row[] = [
  { id: 'g', parentId: null, name: 'Group', price: 0 },
  { id: 'g-a', parentId: 'g', name: 'A', price: 1 },
  { id: 'g-b', parentId: 'g', name: 'B', price: 2 },
];

let host: HTMLDivElement | undefined;

async function mount(overrides: Partial<GridOptions<Row>> = {}): Promise<Grid<Row>> {
  host = document.createElement('div');
  host.style.cssText = 'width:800px;height:400px';
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Row>;
  grid.gridOptions = {
    columns,
    rowHeight: 32,
    headerHeight: 32,
    modules: [
      new TreeModule<Row>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
      new SortModule<Row>(),
      new SelectionModule<Row>({ mode: 'multi' }),
    ],
    ...overrides,
  };
  grid.rowData = data;
  host.append(grid);

  await grid.updateComplete;
  // Settled means an instance has actually mounted, not merely that the layout
  // produced slots — an empty grid would otherwise let tests pass vacuously.
  await waitFor(() => grid.shadowRoot?.querySelector('ls-grid-instance') !== null, {
    description: 'the first instance to mount',
  });
  await grid.updateComplete;
  return grid;
}

const instance = (grid: Grid<Row>) => grid.shadowRoot!.querySelector('ls-grid-instance')!;
const rows = (grid: Grid<Row>) => [...instance(grid).shadowRoot!.querySelectorAll('ls-grid-row')];
const cellsOf = (row: Element) => [...row.shadowRoot!.querySelectorAll('ls-grid-cell')];

/**
 * A cell by column id rather than position. The selection module prepends its
 * checkbox column, so an index would depend on which modules are installed.
 */
const cellFor = (row: Element, colId: string) =>
  cellsOf(row).find(
    (cell) => (cell as unknown as { column?: { colId: string } }).column?.colId === colId,
  )!;

const headerFor = (grid: Grid<Row>, colId: string) =>
  [...instance(grid).shadowRoot!.querySelectorAll('ls-grid-header-cell')].find(
    (header) => (header as unknown as { column?: { colId: string } }).column?.colId === colId,
  )!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

afterEach(() => {
  host?.remove();
  host = undefined;
});

/**
 * The design system's rule, checked on what actually rendered.
 *
 * Not a picture and not an interaction: an inline declaration looks identical
 * to a themed one until someone tries to override it, at which point nothing
 * they write has any effect. Chromatic cannot see the difference, and node has
 * no DOM to look at, so it is a unit test that needs a browser.
 */
describe('what the grid must never put in a style attribute', () => {
  it('leaves cells with no style attribute of their own', async () => {
    const grid = await mount();

    for (const row of rows(grid)) {
      for (const cell of cellsOf(row)) {
        const style = cell.getAttribute('style') ?? '';
        // Only custom properties are permitted, and only from decorations.
        const declarations = style.split(';').filter((d) => d.trim() !== '');
        for (const declaration of declarations) {
          expect(declaration.trim().startsWith('--'), `unexpected: ${declaration}`).toBe(true);
        }
      }
    }
  });

  it('leaves module-contributed markup with no style attribute', async () => {
    const grid = await mount();
    const treeCell = cellFor(rows(grid)[0]!, 'name');

    for (const element of treeCell.shadowRoot!.querySelectorAll('*')) {
      expect(element.getAttribute('style'), element.tagName).toBeNull();
    }
  });

  it('styles the sort indicator by class, not inline', async () => {
    const grid = await mount();
    grid.api.setSortModel([{ colId: 'price', direction: 'asc' }]);
    await settle();

    const indicator = headerFor(grid, 'price').shadowRoot!.querySelector(
      '[part="sort-indicator"]',
    )!;

    expect(indicator.getAttribute('style')).toBeNull();
    expect(indicator.classList.contains('ls-grid-sort-indicator')).toBe(true);
  });

  it('styles the selection checkbox by class, not inline', async () => {
    const grid = await mount();
    const checkbox = cellFor(rows(grid)[0]!, 'ls-grid-selection').shadowRoot!.querySelector(
      'ls-grid-selection-checkbox',
    )!;
    const input = checkbox.shadowRoot!.querySelector('input')!;

    expect(input.getAttribute('style')).toBeNull();
    expect(input.classList.contains('ls-grid-checkbox')).toBe(true);
  });

  it('takes the checkbox accent from the design system, not from the focus colour', async () => {
    // A ticked checkbox is painted by `accent-color`, which no token can reach
    // on its own — it is the one place a real declaration has to carry a
    // token through. This used to borrow `--grid-focus`, so a checked box was
    // the focus-ring colour: a ring says "the keyboard is here", an accent
    // says "this is on".
    const grid = await mount();
    const checkbox = cellFor(rows(grid)[0]!, 'ls-grid-selection').shadowRoot!.querySelector(
      'ls-grid-selection-checkbox',
    )!;
    const input = checkbox.shadowRoot!.querySelector('input')!;

    const accent = getComputedStyle(input).accentColor;
    const themeAccent = getComputedStyle(document.documentElement)
      .getPropertyValue('--theme-color-accent')
      .trim();

    expect(accent).not.toBe('auto');
    expect(accent).not.toBe(getComputedStyle(grid).getPropertyValue('--grid-focus').trim());
    expect(themeAccent).not.toBe('');
  });
});
