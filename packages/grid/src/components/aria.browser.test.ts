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

const repeating: Bond[] = [
  { id: 'g', parentId: null, name: 'Gilts', price: 0 },
  ...Array.from({ length: 40 }, (_, i) => ({
    id: `g-${i}`,
    parentId: 'g',
    name: `Bond ${i}`,
    price: i,
  })),
];

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

  it('gives every instance a real header, indexed only once', async () => {
    // A continuation's header used to be aria-hidden while staying focusable,
    // which is a contradiction and the `aria-hidden-focus` finding. Focus goes
    // to each instance's own header deliberately, and once the reader has
    // scrolled right every header on screen is a continuation — hiding them put
    // sort and filter out of reach of both the mouse and the keyboard.
    //
    // Each instance is its own rowgroup, so a heading row is honest. Only the
    // first says it is row 1 of the grid.
    const grid = await mount(many);
    await waitFor(() => instances(grid).length > 1);

    const headers = instances(grid).map((panel) => panel.shadowRoot!.querySelector('.header')!);

    expect(headers.every((header) => header.getAttribute('aria-hidden') === null)).toBe(true);
    expect(headers[0]!.getAttribute('aria-rowindex')).toBe('1');
    expect(headers[1]!.getAttribute('aria-rowindex')).toBeNull();
  });

  it('hides a repeated ancestor, which is a row read once already', async () => {
    const grid = await mount(repeating, [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
    ]);
    await waitFor(() => instances(grid).length > 1);

    const repeated = rowsOf(instances(grid)[1]!)[0]!;

    expect(repeated.getAttribute('aria-hidden')).toBe('true');
    expect(repeated.hasAttribute('aria-rowindex')).toBe(false);
  });

  it('puts a repeated ancestor out of reach as well as out of the reading order', async () => {
    // Hidden but still operable is the contradiction that `aria-hidden-focus`
    // reports: an expander is a button and a checkbox is an input, so a copy of
    // a row could be clicked and tabbed into while claiming not to exist.
    const grid = await mount(repeating, [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
    ]);
    await waitFor(() => instances(grid).length > 1);

    const repeated = rowsOf(instances(grid)[1]!)[0]! as HTMLElement;

    expect(repeated.inert).toBe(true);
    // Nothing inside can take focus, which is what axe is asserting.
    const cells = [...repeated.shadowRoot!.querySelectorAll('ls-grid-cell')] as HTMLElement[];
    for (const cell of cells) {
      cell.focus();
      expect(document.activeElement === cell).toBe(false);
    }
  });

  it('steps over a repeated ancestor when arrowing between instances', async () => {
    // It is the same row already visited in the instance before, so stopping on
    // it would walk one row of data twice — and there would be nothing to
    // operate once we arrived.
    const grid = await mount(repeating, [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
    ]);
    await waitFor(() => instances(grid).length > 1);

    const focus = grid.controller!.focus;
    const layout = grid.controller!.layout.get();
    const repeatKey = layout.instances[1]!.rows[0]!.id;
    expect(layout.instances[1]!.rows[0]!.meta?.['isRepeat']).toBe(true);

    // Walk down from the top; the repeat must never be a resting place.
    focus.focusFirst();
    const visited: string[] = [];
    for (let i = 0; i < 80 && focus.moveRow(1); i += 1) {
      visited.push(focus.focused.get()?.rowKey ?? '');
    }

    expect(visited).not.toContain(repeatKey);
    // ...and the walk did reach the second instance, or this proves nothing.
    expect(visited).toContain(layout.instances[1]!.rows[1]!.id);
  });
});
