import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../layouts.js';
import { TreeModule } from '../modules/tree/index.js';
import type { GridOptions } from '../controller/grid-controller.js';
import type { Grid } from './grid.js';

/**
 * What assistive technology is told.
 *
 * The rows are one list however they are arranged, so the grid is the element
 * holding all of them and its totals describe the data. An instance is a group
 * of rows within it, labelled with which rows — otherwise a reader landing in
 * the middle of a wide grid learns only that there are more rows somewhere.
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
): Promise<Grid<Bond>> {
  host = document.createElement('div');
  host.style.height = '400px';
  host.style.width = '600px';
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Bond>;
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

  await waitFor(() => grid.shadowRoot?.querySelector('ls-grid-instance') !== null);
  await waitFor(() => instance(grid).shadowRoot!.querySelector('ls-grid-row') !== null);
  return grid;
}

const instance = (grid: Grid<Bond>) =>
  grid.shadowRoot!.querySelector('ls-grid-instance') as HTMLElement;
const rows = (grid: Grid<Bond>) => [...instance(grid).shadowRoot!.querySelectorAll('ls-grid-row')];

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('the grid announces its shape', () => {
  it('counts the whole data set, not the markup', async () => {
    const grid = await mount(flat);

    expect(grid.getAttribute('aria-colcount')).toBe('2');
    // Six rows plus the header, whatever is currently drawn.
    expect(grid.getAttribute('aria-rowcount')).toBe('7');
  });

  it('makes an instance a group of rows, saying which', async () => {
    const grid = await mount(flat);
    const panel = instance(grid);

    expect(panel.getAttribute('role')).toBe('rowgroup');
    expect(panel.getAttribute('aria-label')).toMatch(/^Rows 1 to \d+$/);
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
    const cells = [...rows(grid)[0]!.shadowRoot!.querySelectorAll('ls-grid-cell')];
    const headers = [...instance(grid).shadowRoot!.querySelectorAll('ls-grid-header-cell')];

    expect(cells.map((c) => c.getAttribute('aria-colindex'))).toEqual(['1', '2']);
    expect(headers.map((h) => h.getAttribute('aria-colindex'))).toEqual(['1', '2']);
  });

  it('is a plain grid with no hierarchy', async () => {
    const grid = await mount(flat);

    expect(grid.getAttribute('role')).toBe('grid');
  });
});

describe('with tree data', () => {
  const withTree = () => [
    new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
  ];

  it('becomes a treegrid, because rows sit inside rows', async () => {
    const grid = await mount(tree, withTree());

    expect(grid.getAttribute('role')).toBe('treegrid');
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

describe('across instances', () => {
  /**
   * The point of the aggregate model: a row's number means its place in the
   * data, not its place in the panel it happens to be drawn in.
   */
  const many: Bond[] = Array.from({ length: 40 }, (_, i) => ({
    id: `r${i}`,
    parentId: null,
    name: `Row ${i}`,
    price: i,
  }));

  const instances = (grid: Grid<Bond>) => [
    ...grid.shadowRoot!.querySelectorAll('ls-grid-instance'),
  ];
  const rowsOf = (panel: Element) => [...panel.shadowRoot!.querySelectorAll('ls-grid-row')];

  it('numbers rows continuously from one instance to the next', async () => {
    const grid = await mount(many);
    await waitFor(() => instances(grid).length > 1);

    const [first, second] = instances(grid);
    const lastOfFirst = rowsOf(first!).at(-1)!;
    const firstOfSecond = rowsOf(second!)[0]!;

    expect(Number(firstOfSecond.getAttribute('aria-rowindex'))).toBe(
      Number(lastOfFirst.getAttribute('aria-rowindex')) + 1,
    );
  });

  it('labels each instance with the rows it holds', async () => {
    const grid = await mount(many);
    await waitFor(() => instances(grid).length > 1);

    const labels = instances(grid).map((panel) => panel.getAttribute('aria-label'));

    expect(labels[0]).toMatch(/^Rows 1 to /);
    expect(labels[1]).not.toBe(labels[0]);
  });

  it('shows the header once, not once per instance', async () => {
    const grid = await mount(many);
    await waitFor(() => instances(grid).length > 1);

    const headers = instances(grid).map((panel) =>
      panel.shadowRoot!.querySelector('.header')?.getAttribute('aria-hidden'),
    );

    expect(headers[0]).toBeNull();
    expect(headers[1]).toBe('true');
  });

  it('hides a repeated ancestor, which is a row read once already', async () => {
    const deep: Bond[] = [
      { id: 'g', parentId: null, name: 'Gilts', price: 0 },
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `g-${i}`,
        parentId: 'g',
        name: `Bond ${i}`,
        price: i,
      })),
    ];
    const grid = await mount(deep, [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
    ]);
    await waitFor(() => instances(grid).length > 1);

    const repeated = rowsOf(instances(grid)[1]!)[0]!;

    expect(repeated.getAttribute('aria-hidden')).toBe('true');
    expect(repeated.hasAttribute('aria-rowindex')).toBe(false);
  });
});
