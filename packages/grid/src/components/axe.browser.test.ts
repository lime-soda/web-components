import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../layouts.js';
import { SelectionModule } from '../modules/selection/index.js';
import { SortModule } from '../modules/sort/index.js';
import { TreeModule } from '../modules/tree/index.js';
import { TreeSelectionModule } from '../modules/selection/tree/index.js';
import type { GridOptions } from '../controller/grid-controller.js';
import type { FlowGrid } from './grid.js';

/**
 * Accessibility, measured rather than asserted.
 *
 * The ARIA work here was written by reading specifications and checking
 * attributes — which finds what you thought to look for. axe checks the rules
 * that actually exist, including the ones about how roles must nest.
 */

interface Bond {
  id: string;
  parentId: string | null;
  name: string;
  price: number;
}

const flat: Bond[] = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  parentId: null,
  name: `Instrument ${i}`,
  price: 100 + i,
}));

const tree: Bond[] = [
  { id: 'g', parentId: null, name: 'Gilts', price: 0 },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `g-${i}`,
    parentId: 'g',
    name: `Bond ${i}`,
    price: 100 + i,
  })),
];

let host: HTMLDivElement | undefined;

async function waitFor(condition: () => boolean, timeout = 3000): Promise<void> {
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
  host.style.width = '700px';
  document.body.append(host);

  const grid = document.createElement('flow-grid') as FlowGrid<Bond>;
  grid.style.height = '100%';
  grid.gridOptions = {
    columns: [
      { field: 'name', headerName: 'Instrument', width: 240 },
      { field: 'price', headerName: 'Price', width: 120 },
    ],
    getRowId: (row) => row.id,
    modules,
  } satisfies GridOptions<Bond>;
  grid.rowData = rows;
  host.append(grid);

  await waitFor(() => grid.shadowRoot?.querySelector('flow-instance') !== null);
  await waitFor(
    () =>
      (grid.shadowRoot!.querySelector('flow-instance') as HTMLElement).shadowRoot!.querySelector(
        'flow-row',
      ) !== null,
  );
  return grid;
}

/** Runs axe over the grid and returns violations, described for a failure message. */
async function violationsIn(grid: FlowGrid<Bond>): Promise<string[]> {
  const results = await axe.run(grid, {
    // Contrast depends on the page's theme rather than on the component, and
    // the harness has none.
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact}): ` +
        `${(node.failureSummary ?? violation.help).replaceAll('\n', ' ')}`,
    ),
  );
}

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('axe', () => {
  it('finds nothing wrong with a plain grid', async () => {
    const grid = await mount(flat);

    expect(await violationsIn(grid)).toEqual([]);
  });

  it('finds nothing wrong with a treegrid', async () => {
    const grid = await mount(tree, [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
    ]);

    expect(await violationsIn(grid)).toEqual([]);
  });

  it('finds nothing wrong with sorting and selection installed', async () => {
    const grid = await mount(tree, [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
      new SortModule<Bond>(),
      new SelectionModule<Bond>({ mode: 'multi' }),
      new TreeSelectionModule<Bond>({ getParentId: (bond) => bond.parentId }),
    ]);

    expect(await violationsIn(grid)).toEqual([]);
  });

  it('finds nothing wrong once a group is collapsed', async () => {
    const grid = await mount(tree, [
      new TreeModule<Bond>({ getParentId: (bond) => bond.parentId, defaultExpanded: true }),
    ]);
    grid.api.collapseAll();
    await waitFor(() => true);

    expect(await violationsIn(grid)).toEqual([]);
  });
});
