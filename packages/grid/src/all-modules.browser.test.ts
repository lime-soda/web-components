import { afterEach, describe, expect, it } from 'vite-plus/test';
import './layouts.js';
import './index.js';
import './layouts.js';
import type { ColumnDef } from './columns/types.js';
import type { GridOptions } from './controller/grid-controller.js';
import type { Grid } from './components/grid.js';
import { TreeModule } from './modules/tree/index.js';
import { SortModule } from './modules/sort/index.js';
import { FilterModule } from './modules/filter/index.js';
import { SelectionModule } from './modules/selection/index.js';
import { TreeSelectionModule } from './modules/selection/tree/index.js';
import { RowRangeModule } from './modules/selection/row-range/index.js';
import { CellFlashModule } from './modules/cell-flash/index.js';
import { KeyboardModule } from './modules/keyboard/index.js';

/**
 * What every module installed at once does that no user can see.
 *
 * How the modules behave together — which column owns the expander, what a
 * filter leaves a group to select, whether the keyboard walks into a control —
 * is driven through the interface in `Grid/Tests/All modules`. What is left
 * here is the part with no gesture behind it: that the registry holds them all,
 * that their state survives a round trip through save and restore, and that
 * pulling the grid out of the document with all of them installed tears down
 * without throwing.
 */

interface Bond {
  id: string;
  parentId: string | null;
  instrument: string;
  price: number;
}

const columns: ColumnDef<Bond>[] = [
  { field: 'instrument', width: 200 },
  { field: 'price', width: 100, valueFormatter: ({ value }) => (value as number).toFixed(2) },
];

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

/** Three categories of four instruments. */
const data: Bond[] = ['a', 'b', 'c'].flatMap((group, g) => [
  { id: `g${g}`, parentId: null, instrument: `Group ${group.toUpperCase()}`, price: 0 },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `g${g}-i${i}`,
    parentId: `g${g}`,
    instrument: `${group.toUpperCase()} instrument ${i}`,
    price: 100 + g * 10 + i,
  })),
]);

let host: HTMLDivElement | undefined;

const allModules = () => [
  new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
  new SortModule<Bond>(),
  new FilterModule<Bond>(),
  new SelectionModule<Bond>({ mode: 'multi' }),
  new TreeSelectionModule<Bond>({ getParentId: (bond) => bond.parentId }),
  new RowRangeModule<Bond>(),
  new CellFlashModule<Bond>(),
  new KeyboardModule<Bond>(),
];

async function mount(overrides: Partial<GridOptions<Bond>> = {}): Promise<Grid<Bond>> {
  host = document.createElement('div');
  host.style.cssText = 'width:900px;height:400px';
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Bond>;
  grid.gridOptions = {
    columns,
    rowHeight: 32,
    headerHeight: 32,
    modules: allModules(),
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('all v1 modules together', () => {
  it('registers every module', async () => {
    const grid = await mount();

    for (const id of ['tree', 'sort', 'filter', 'selection', 'cell-flash', 'keyboard']) {
      expect(grid.api.getModule(id), id).toBeDefined();
    }
  });

  describe('module state', () => {
    it('round-trips every module through getState and setState', async () => {
      const grid = await mount();
      grid.api.setSortModel([{ colId: 'price', direction: 'asc' }]);
      grid.api.setRowSelected('g0-i0', true);
      grid.api.collapseAll();
      await settle();

      const saved = JSON.parse(JSON.stringify(grid.api.getState()));

      grid.api.clearSort();
      grid.api.clearSelection();
      grid.api.expandAll();
      await settle();

      grid.api.setState(saved);
      await settle();

      expect(grid.api.getSortModel()).toEqual([{ colId: 'price', direction: 'asc' }]);
      expect(grid.api.getSelectedRows()).toEqual(['g0-i0']);
      expect(grid.api.isExpanded('g0')).toBe(false);
    });
  });

  describe('teardown', () => {
    it('destroys cleanly with every module installed', async () => {
      const grid = await mount();

      expect(() => host!.remove()).not.toThrow();
      await settle();

      expect(grid.controller).toBeUndefined();
    });
  });
});
