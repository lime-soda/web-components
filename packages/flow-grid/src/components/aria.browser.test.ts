import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../layouts.js';
import { TreeModule } from '../modules/tree/index.js';
import type { GridOptions } from '../controller/grid-controller.js';
import type { FlowGrid } from './grid.js';

/**
 * What assistive technology is told.
 *
 * The counts matter more here than in a conventional grid: rows are spread
 * across instances, so without them a reader is told only about the markup that
 * happens to exist rather than about the data.
 */

interface Bond {
  id: string;
  parentId: string | null;
  name: string;
  price: number;
}

const flat: Bond[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  parentId: null,
  name: `Row ${i}`,
  price: i,
}));

const tree: Bond[] = [
  { id: 'g', parentId: null, name: 'Gilts', price: 0 },
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `g-${i}`,
    parentId: 'g',
    name: `Bond ${i}`,
    price: i,
  })),
];

let host: HTMLDivElement | undefined;

async function waitFor(condition: () => boolean, timeout = 2000): Promise<void> {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout) throw new Error('timed out');
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

async function mount(
  rows: Bond[],
  modules: GridOptions<Bond>['modules'] = [],
): Promise<FlowGrid<Bond>> {
  host = document.createElement('div');
  host.style.height = '400px';
  host.style.width = '600px';
  document.body.append(host);

  const grid = document.createElement('flow-grid') as FlowGrid<Bond>;
  grid.style.height = '100%';
  grid.gridOptions = {
    columns: [
      { field: 'name', width: 200 },
      { field: 'price', width: 100 },
    ],
    getRowId: (row) => row.id,
    modules,
  } satisfies GridOptions<Bond>;
  grid.rowData = rows;
  host.append(grid);

  await waitFor(() => grid.shadowRoot?.querySelector('flow-instance') !== null);
  await waitFor(() => instance(grid).shadowRoot!.querySelector('flow-row') !== null);
  return grid;
}

const instance = (grid: FlowGrid<Bond>) =>
  grid.shadowRoot!.querySelector('flow-instance') as HTMLElement;
const rows = (grid: FlowGrid<Bond>) => [...instance(grid).shadowRoot!.querySelectorAll('flow-row')];

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('the grid announces its shape', () => {
  it('counts its rows and columns', async () => {
    const grid = await mount(flat);
    const panel = instance(grid);

    expect(panel.getAttribute('aria-colcount')).toBe('2');
    // Its own rows plus the header, which is what this panel actually holds.
    expect(panel.getAttribute('aria-rowcount')).toBe(String(rows(grid).length + 1));
  });

  it('numbers rows from the header down', async () => {
    const grid = await mount(flat);
    const header = instance(grid).shadowRoot!.querySelector('.header');

    expect(header?.getAttribute('aria-rowindex')).toBe('1');
    expect(rows(grid)[0]!.getAttribute('aria-rowindex')).toBe('2');
    expect(rows(grid)[1]!.getAttribute('aria-rowindex')).toBe('3');
  });

  it('numbers columns from one, on cells and headers alike', async () => {
    const grid = await mount(flat);
    const cells = [...rows(grid)[0]!.shadowRoot!.querySelectorAll('flow-cell')];
    const headers = [...instance(grid).shadowRoot!.querySelectorAll('flow-header-cell')];

    expect(cells.map((c) => c.getAttribute('aria-colindex'))).toEqual(['1', '2']);
    expect(headers.map((h) => h.getAttribute('aria-colindex'))).toEqual(['1', '2']);
  });

  it('is a plain grid with no hierarchy', async () => {
    const grid = await mount(flat);

    expect(instance(grid).getAttribute('role')).toBe('grid');
  });
});

describe('with tree data', () => {
  const withTree = () => [
    new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
  ];

  it('becomes a treegrid, because rows sit inside rows', async () => {
    const grid = await mount(tree, withTree());

    expect(instance(grid).getAttribute('role')).toBe('treegrid');
  });

  it('gives every row its level, counted from one', async () => {
    const grid = await mount(tree, withTree());
    const [parent, child] = rows(grid);

    expect(parent!.getAttribute('aria-level')).toBe('1');
    expect(child!.getAttribute('aria-level')).toBe('2');
  });

  it('puts aria-expanded on the row, where a treegrid looks for it', async () => {
    const grid = await mount(tree, withTree());

    expect(rows(grid)[0]!.getAttribute('aria-expanded')).toBe('true');
  });

  it('leaves aria-expanded off rows that cannot expand', async () => {
    const grid = await mount(tree, withTree());

    expect(rows(grid)[1]!.hasAttribute('aria-expanded')).toBe(false);
  });

  it('follows a collapse', async () => {
    const grid = await mount(tree, withTree());
    grid.api.collapseAll();
    await waitFor(() => rows(grid)[0]!.getAttribute('aria-expanded') === 'false');

    expect(rows(grid)[0]!.getAttribute('aria-expanded')).toBe('false');
  });
});
