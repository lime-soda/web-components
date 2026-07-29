import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../columns/resolve-columns.js';
import type { ColumnDef } from '../../columns/types.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { TreeModule } from '../tree/tree-module.js';
import { SortModule, type SortModuleOptions, compareValues } from './sort-module.js';
import './index.js';

interface Quote {
  id: string;
  parentId: string | null;
  instrument: string;
  price: number | null;
  size?: number;
}

const quote = (id: string, instrument: string, price: number | null, parentId = null): Quote => ({
  id,
  parentId,
  instrument,
  price,
});

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', width: 200 },
  { field: 'price', width: 100 },
];

const setup = (
  data: Quote[],
  defs = columns,
  extraModules: never[] = [],
  options: SortModuleOptions = {},
) => {
  const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);
  const sort = new SortModule<Quote>(options);
  const dispatch = vi.fn();
  const registry = new ModuleRegistry<Quote>({
    pipeline,
    getColumns: () => resolveColumns<Quote>(defs),
    dispatch,
  });
  for (const module of extraModules) registry.register(module);
  registry.register(sort);
  registry.start();
  return { pipeline, sort, dispatch, registry };
};

const order = (pipeline: GridPipeline<Quote>) =>
  pipeline.projector.rows.get().map((row) => row.rowId);

describe('SortModule', () => {
  describe('ordering', () => {
    it('leaves rows alone with an empty model', () => {
      const { pipeline } = setup([quote('b', 'B', 2), quote('a', 'A', 1)]);

      expect(order(pipeline)).toEqual(['b', 'a']);
    });

    it('sorts ascending', () => {
      const { pipeline, sort } = setup([quote('b', 'B', 2), quote('a', 'A', 1)]);

      sort.setSortModel([{ colId: 'price', direction: 'asc' }]);

      expect(order(pipeline)).toEqual(['a', 'b']);
    });

    it('sorts descending', () => {
      const { pipeline, sort } = setup([quote('a', 'A', 1), quote('b', 'B', 2)]);

      sort.setSortModel([{ colId: 'price', direction: 'desc' }]);

      expect(order(pipeline)).toEqual(['b', 'a']);
    });

    it('sorts numbers numerically, not lexically', () => {
      const { pipeline, sort } = setup([quote('a', 'A', 9), quote('b', 'B', 10)]);

      sort.setSortModel([{ colId: 'price', direction: 'asc' }]);

      expect(order(pipeline)).toEqual(['a', 'b']);
    });

    it('is stable for rows equal on the sort key', () => {
      const { pipeline, sort } = setup([
        quote('first', 'same', 1),
        quote('second', 'same', 1),
        quote('third', 'same', 1),
      ]);

      sort.setSortModel([{ colId: 'instrument', direction: 'asc' }]);

      expect(order(pipeline)).toEqual(['first', 'second', 'third']);
    });

    it('sorts on several columns in model order', () => {
      const { pipeline, sort } = setup([
        quote('a', 'X', 2),
        quote('b', 'X', 1),
        quote('c', 'A', 5),
      ]);

      sort.setSortModel([
        { colId: 'instrument', direction: 'asc' },
        { colId: 'price', direction: 'asc' },
      ]);

      expect(order(pipeline)).toEqual(['c', 'b', 'a']);
    });

    it('ignores a model entry naming a column that does not exist', () => {
      const { pipeline, sort } = setup([quote('b', 'B', 2), quote('a', 'A', 1)]);

      sort.setSortModel([{ colId: 'ghost', direction: 'asc' }]);

      expect(order(pipeline)).toEqual(['b', 'a']);
    });

    it('sorts on the resolved value, so a computed column sorts on what it displays', () => {
      const { pipeline, sort } = setup(
        [quote('a', 'A', 1), quote('b', 'B', 2)],
        [{ colId: 'inverse', valueGetter: ({ data }) => -(data.price ?? 0) }],
      );

      sort.setSortModel([{ colId: 'inverse', direction: 'asc' }]);

      expect(order(pipeline)).toEqual(['b', 'a']);
    });

    it('uses a column comparator when given', () => {
      const { pipeline, sort } = setup(
        [quote('a', 'zz', 1), quote('b', 'aa', 2)],
        [{ field: 'instrument', comparator: (a, b) => String(a).length - String(b).length }],
      );

      sort.setSortModel([{ colId: 'instrument', direction: 'asc' }]);

      expect(order(pipeline)).toEqual(['a', 'b']);
    });
  });

  describe('blanks', () => {
    it('sorts blanks last ascending', () => {
      const { pipeline, sort } = setup([quote('blank', 'B', null), quote('a', 'A', 1)]);

      sort.setSortModel([{ colId: 'price', direction: 'asc' }]);

      expect(order(pipeline)).toEqual(['a', 'blank']);
    });

    it('sorts blanks last descending too, rather than flipping them to the top', () => {
      // A trader scanning a sorted book wants real prices at the top in both
      // directions, not a wall of empty cells.
      const { pipeline, sort } = setup([quote('blank', 'B', null), quote('a', 'A', 1)]);

      sort.setSortModel([{ colId: 'price', direction: 'desc' }]);

      expect(order(pipeline)).toEqual(['a', 'blank']);
    });
  });

  describe('toggleSort', () => {
    it('cycles ascending, descending, off', () => {
      const { sort } = setup([quote('a', 'A', 1)]);

      sort.toggleSort('price');
      expect(sort.getSortDirection('price')).toBe('asc');

      sort.toggleSort('price');
      expect(sort.getSortDirection('price')).toBe('desc');

      sort.toggleSort('price');
      expect(sort.getSortDirection('price')).toBeNull();
    });

    it('replaces the model by default, so a plain click sorts by one column', () => {
      const { sort } = setup([quote('a', 'A', 1)]);
      sort.toggleSort('instrument');

      sort.toggleSort('price');

      expect(sort.getSortModel().map((e) => e.colId)).toEqual(['price']);
    });

    it('adds to the model when additive', () => {
      const { sort } = setup([quote('a', 'A', 1)]);
      sort.toggleSort('instrument');

      sort.toggleSort('price', true);

      expect(sort.getSortModel().map((e) => e.colId)).toEqual(['instrument', 'price']);
    });

    it('does not add when multiSort is off', () => {
      const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
      const sort = new SortModule<Quote>({ multiSort: false });
      const registry = new ModuleRegistry<Quote>({
        pipeline,
        getColumns: () => resolveColumns<Quote>(columns),
        dispatch: () => {},
      });
      registry.register(sort);
      registry.start();
      sort.toggleSort('instrument');

      sort.toggleSort('price', true);

      expect(sort.getSortModel().map((e) => e.colId)).toEqual(['price']);
    });
  });

  describe('dependsOn', () => {
    // These describe what the stage declares once it has been asked to follow
    // values. Off by default, it deliberately declares nothing — see
    // stability.test.ts.
    const tracking = { resortOnValueChange: true };

    const dependencies = (sort: SortModule<Quote>, pipeline: GridPipeline<Quote>) => {
      const stage = (
        pipeline.projector as unknown as { stages: { id: string; dependsOn: unknown }[] }
      ).stages;
      return stage.find((s) => s.id === 'sort')!.dependsOn;
    };

    it('declares nothing when no sort is active', () => {
      const { sort, pipeline } = setup([quote('a', 'A', 1)]);

      expect(dependencies(sort, pipeline)).toBeUndefined();
    });

    it('declares only the active sort field', () => {
      const { sort, pipeline } = setup([quote('a', 'A', 1)], columns, [], tracking);

      sort.setSortModel([{ colId: 'price', direction: 'asc' }]);

      expect([...(dependencies(sort, pipeline) as Set<string>)]).toEqual(['price']);
    });

    it("declares '*' when a sort column has a value getter it cannot see into", () => {
      const { sort, pipeline } = setup(
        [quote('a', 'A', 1)],
        [{ colId: 'derived', valueGetter: ({ data }) => data.price }],
        [],
        tracking,
      );

      sort.setSortModel([{ colId: 'derived', direction: 'asc' }]);

      expect(dependencies(sort, pipeline)).toBe('*');
    });

    it('does not re-sort when an unrelated field ticks', () => {
      // Sorting by instrument, a price tick must not re-run the sort.
      const { sort, pipeline } = setup([quote('a', 'A', 1), quote('b', 'B', 2)]);
      sort.setSortModel([{ colId: 'instrument', direction: 'asc' }]);
      pipeline.projector.rows.get();
      const before = pipeline.layout.get();

      pipeline.store.applyTransaction({ update: [quote('a', 'A', 999)] });
      pipeline.store.flushSync();

      expect(pipeline.layout.get()).toBe(before);
    });

    it('re-sorts when the sorted field ticks', () => {
      const { sort, pipeline } = setup(
        [quote('a', 'A', 1), quote('b', 'B', 2)],
        columns,
        [],
        tracking,
      );
      sort.setSortModel([{ colId: 'price', direction: 'asc' }]);
      expect(order(pipeline)).toEqual(['a', 'b']);

      pipeline.store.applyTransaction({ update: [quote('a', 'A', 999)] });
      pipeline.store.flushSync();

      expect(order(pipeline)).toEqual(['b', 'a']);
    });
  });

  describe('with the tree module', () => {
    it('sorts siblings without disturbing the hierarchy', () => {
      // Sort runs before the tree stage on the flat list; the tree preserves the
      // order it produced. Neither module knows the other exists.
      const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
      pipeline.store.setRowData([
        { id: 'g', parentId: null, instrument: 'Group', price: 0 },
        { id: 'c1', parentId: 'g', instrument: 'C', price: 3 },
        { id: 'c2', parentId: 'g', instrument: 'A', price: 1 },
        { id: 'c3', parentId: 'g', instrument: 'B', price: 2 },
      ]);
      const sort = new SortModule<Quote>();
      const tree = new TreeModule<Quote>({
        getParentId: (d) => d.parentId,
        defaultExpanded: true,
      });
      const registry = new ModuleRegistry<Quote>({
        pipeline,
        getColumns: () => resolveColumns<Quote>(columns),
        dispatch: () => {},
      });
      registry.register(tree);
      registry.register(sort);
      registry.start();

      sort.setSortModel([{ colId: 'price', direction: 'asc' }]);

      expect(order(pipeline)).toEqual(['g', 'c2', 'c3', 'c1']);
    });
  });

  describe('state and events', () => {
    it('round-trips the sort model', () => {
      const { sort } = setup([quote('a', 'A', 1)]);
      sort.setSortModel([{ colId: 'price', direction: 'desc' }]);
      const saved = sort.getState();

      sort.clearSort();
      sort.setState(saved);

      expect(sort.getSortDirection('price')).toBe('desc');
    });

    it('dispatches when the model changes', () => {
      const { sort, dispatch } = setup([quote('a', 'A', 1)]);

      sort.toggleSort('price');

      expect(dispatch).toHaveBeenCalledWith('flow-sort-changed', {
        model: [{ colId: 'price', direction: 'asc' }],
      });
    });

    it('seeds the model from initialSort on a column', () => {
      const { sort } = setup(
        [quote('a', 'A', 1)],
        [{ field: 'instrument' }, { field: 'price', initialSort: 'desc' }],
      );

      expect(sort.getSortDirection('price')).toBe('desc');
    });
  });

  describe('header', () => {
    it('marks a sortable header with aria-sort', () => {
      const { sort } = setup([quote('a', 'A', 1)]);
      const column = resolveColumns<Quote>(columns)[1]!;

      expect(sort.headerDecorator({ column })?.attributes?.['aria-sort']).toBe('none');

      sort.setSortModel([{ colId: 'price', direction: 'asc' }]);
      expect(sort.headerDecorator({ column })?.attributes?.['aria-sort']).toBe('ascending');
    });

    it('does not decorate a column marked unsortable', () => {
      const { sort } = setup([quote('a', 'A', 1)]);
      const column = resolveColumns<Quote>([{ field: 'price', sortable: false }])[0]!;

      expect(sort.headerDecorator({ column })).toBeNull();
    });

    it('does not decorate a column with nothing to sort by', () => {
      const { sort } = setup([quote('a', 'A', 1)]);
      const column = resolveColumns<Quote>([{ colId: 'actions', headerName: 'Actions' }])[0]!;

      expect(sort.headerDecorator({ column })).toBeNull();
    });

    it('shows no indicator until the column is sorted', () => {
      const { sort } = setup([quote('a', 'A', 1)]);
      const column = resolveColumns<Quote>(columns)[1]!;

      expect(sort.headerSlot({ column })).toBeNull();

      sort.setSortModel([{ colId: 'price', direction: 'asc' }]);
      expect(sort.headerSlot({ column })).not.toBeNull();
    });
  });
});

describe('compareValues', () => {
  it('orders numbers', () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
  });

  it('orders strings naturally, so INS9 precedes INS10', () => {
    expect(compareValues('INS9', 'INS10')).toBeLessThan(0);
  });

  it('orders dates', () => {
    expect(compareValues(new Date(2020, 0, 1), new Date(2021, 0, 1))).toBeLessThan(0);
  });

  it('orders booleans with false first', () => {
    expect(compareValues(false, true)).toBeLessThan(0);
  });

  it('puts NaN last rather than treating it as equal to everything', () => {
    expect(compareValues(Number.NaN, 1)).toBeGreaterThan(0);
  });

  it('treats two blanks as equal', () => {
    expect(compareValues(null, undefined)).toBe(0);
  });
});
