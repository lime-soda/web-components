import { afterEach, describe, expect, it } from 'vitest';
import './index.js';
import type { ColumnDef } from './columns/types.js';
import type { GridOptions } from './controller/grid-controller.js';
import type { TfGrid } from './components/tf-grid.js';
import { TreeModule } from './modules/tree/index.js';
import { SortModule } from './modules/sort/index.js';
import { FilterModule } from './modules/filter/index.js';
import { SelectionModule } from './modules/selection/index.js';
import { CellFlashModule } from './modules/cell-flash/index.js';
import { KeyboardModule } from './modules/keyboard/index.js';

/**
 * Every v1 module installed at once.
 *
 * Each module has its own suite, but those run one module at a time and so say
 * nothing about collisions. The two real bugs found by hand — the tree expander
 * landing in the selection module's checkbox column, and group rows being
 * unselectable — both needed exactly this combination to appear.
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
  new CellFlashModule<Bond>(),
  new KeyboardModule<Bond>(),
];

async function mount(overrides: Partial<GridOptions<Bond>> = {}): Promise<TfGrid<Bond>> {
  host = document.createElement('div');
  host.style.cssText = 'width:900px;height:400px';
  document.body.append(host);

  const grid = document.createElement('tf-grid') as TfGrid<Bond>;
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
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await grid.updateComplete;
  return grid;
}

const instances = (grid: TfGrid<Bond>) => [
  ...(grid.shadowRoot?.querySelectorAll('tf-instance') ?? []),
];
const rowsOf = (grid: TfGrid<Bond>) =>
  instances(grid).flatMap((instance) => [...instance.shadowRoot!.querySelectorAll('tf-row')]);
const cellsOf = (row: Element) => [...row.shadowRoot!.querySelectorAll('tf-cell')];
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

  describe('column ownership', () => {
    it('puts the selection checkbox first and the expander on the first data column', async () => {
      // The collision that shipped once: the expander defaulted to columns[0],
      // which selection had just prepended.
      const grid = await mount();
      const groupRow = rowsOf(grid)[0]!;
      const [selectionCell, instrumentCell] = cellsOf(groupRow);

      expect(grid.api.getColumns()[0]!.colId).toBe('tf-selection');
      expect(selectionCell!.shadowRoot!.querySelector('[part="tree-expander"]')).toBeNull();
      expect(instrumentCell!.shadowRoot!.querySelector('[part="tree-expander"]')).not.toBeNull();
    });

    it('renders a usable checkbox in every row', async () => {
      const grid = await mount();

      for (const row of rowsOf(grid)) {
        const cell = cellsOf(row)[0]!;
        const box = cell.shadowRoot!.querySelector('tf-selection-checkbox');
        const input = box?.shadowRoot?.querySelector('input');
        expect(input, row.getAttribute('role') ?? '').toBeTruthy();

        // Inside the cell's bounds, not clipped out of it.
        const cellRect = cell.getBoundingClientRect();
        const inputRect = input!.getBoundingClientRect();
        expect(inputRect.left).toBeGreaterThanOrEqual(cellRect.left - 1);
        expect(inputRect.right).toBeLessThanOrEqual(cellRect.right + 1);
      }
    });

    it('keeps the selection column out of sorting and filtering', async () => {
      const grid = await mount();
      const [selectionColumn] = grid.api.getColumns();

      expect(selectionColumn!.sortable).toBe(false);
      expect(selectionColumn!.filterable).toBe(false);
    });
  });

  describe('modules cooperating', () => {
    it('sorts siblings inside groups without flattening the tree', async () => {
      const grid = await mount();

      grid.api.setSortModel([{ colId: 'price', direction: 'desc' }]);
      await settle();

      const ids = grid.api.getLayout().instances.flatMap((i) => i.rows.map((r) => r.rowId));
      // Groups stay in place; children descend within each.
      expect(ids.slice(0, 5)).toEqual(['g0', 'g0-i3', 'g0-i2', 'g0-i1', 'g0-i0']);
    });

    it('keeps a group heading visible when only a descendant matches a filter', async () => {
      const grid = await mount();

      grid.api.setQuickFilter('B instrument 2');
      await settle();

      const ids = grid.api.getLayout().instances.flatMap((i) => i.rows.map((r) => r.rowId));
      expect(ids).toEqual(['g1', 'g1-i2']);
    });

    it('selects only filtered children when a group is ticked', async () => {
      const grid = await mount();
      grid.api.setQuickFilter('instrument 1');
      await settle();

      grid.api.setRowSelected('g0', true);
      await settle();

      expect(grid.api.getSelectedRows()).toEqual(['g0-i1']);
      expect(grid.api.getRowSelectionState('g0')).toBe('checked');
    });

    it('flashes a cell on a tick while every other module is installed', async () => {
      const grid = await mount();
      const priceCell = cellsOf(rowsOf(grid)[1]!)[2]!;

      grid.api.applyTransaction({
        update: [{ id: 'g0-i0', parentId: 'g0', instrument: 'A instrument 0', price: 999 }],
      });
      await settle();

      expect(priceCell.getAnimations().length).toBeGreaterThan(0);
      expect(priceCell.shadowRoot?.textContent).toContain('999.00');
    });

    it('leaves the layout untouched by a tick even with six modules installed', async () => {
      const grid = await mount();
      const before = grid.api.getLayout();

      grid.api.applyTransaction({
        update: [{ id: 'g0-i0', parentId: 'g0', instrument: 'A instrument 0', price: 555 }],
      });
      await settle();

      expect(grid.api.getLayout()).toBe(before);
    });

    it('navigates by keyboard without the checkbox or expander stealing focus', async () => {
      const grid = await mount();
      const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
      const send = (key: string) =>
        scroller.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
        );

      send('ArrowDown');
      send('ArrowDown');
      await settle();

      const focused = grid.controller!.focus.focused.get();
      expect(focused?.colId).toBe('tf-selection');
      expect(focused?.rowKey).toBe('g0-i0');
    });

    it('collapsing a group reflows the layout and drops its children', async () => {
      const grid = await mount();
      const before = grid.api.getLayout().instances.flatMap((i) => i.rows).length;

      grid.api.collapseAll();
      await settle();

      const after = grid.api.getLayout().instances.flatMap((i) => i.rows).length;
      expect(after).toBe(3);
      expect(after).toBeLessThan(before);
    });
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
