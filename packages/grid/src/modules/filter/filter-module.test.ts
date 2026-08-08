import { describe, expect, it, vi } from 'vite-plus/test';
import { resolveColumns } from '../../columns/resolve-columns.js';
import type { ColumnDef } from '../../columns/types.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { TreeModule } from '../tree/tree-module.js';
import { FilterModule } from './filter-module.js';
import { matchesFilter } from './filter-model.js';
import './index.js';

interface Quote {
  id: string;
  parentId: string | null;
  instrument: string;
  price: number | null;
}

const quote = (id: string, instrument: string, price: number | null = 100): Quote => ({
  id,
  parentId: null,
  instrument,
  price,
});

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', width: 200 },
  { field: 'price', width: 100, filterType: 'number' },
];

const setup = (data: Quote[], defs = columns) => {
  const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);
  const filter = new FilterModule<Quote>();
  const dispatch = vi.fn();
  const registry = new ModuleRegistry<Quote>({
    pipeline,
    getColumns: () => resolveColumns<Quote>(defs),
    dispatch,
  });
  registry.register(filter);
  registry.start();
  return { pipeline, filter, dispatch };
};

const ids = (pipeline: GridPipeline<Quote>) =>
  pipeline.projector.rows.get().map((row) => row.rowId);

describe('FilterModule', () => {
  describe('inactive', () => {
    it('passes every row through when nothing is set', () => {
      const { pipeline } = setup([quote('a', 'A'), quote('b', 'B')]);

      expect(ids(pipeline)).toEqual(['a', 'b']);
    });

    it('reports itself inactive', () => {
      expect(setup([]).filter.isFilterActive()).toBe(false);
    });
  });

  describe('column filters', () => {
    it('filters by contains', () => {
      const { pipeline, filter } = setup([quote('a', 'UKT 2030'), quote('b', 'DBR 2029')]);

      filter.setColumnFilter('instrument', { type: 'text', operator: 'contains', value: 'ukt' });

      expect(ids(pipeline)).toEqual(['a']);
    });

    it('is case-insensitive by default', () => {
      const { pipeline, filter } = setup([quote('a', 'UKT 2030')]);

      filter.setColumnFilter('instrument', { type: 'text', operator: 'contains', value: 'ukt' });

      expect(ids(pipeline)).toEqual(['a']);
    });

    it('respects caseSensitive when asked', () => {
      const { pipeline, filter } = setup([quote('a', 'UKT 2030')]);

      filter.setColumnFilter('instrument', {
        type: 'text',
        operator: 'contains',
        value: 'ukt',
        caseSensitive: true,
      });

      expect(ids(pipeline)).toEqual([]);
    });

    it('filters numerically with a comparison', () => {
      const { pipeline, filter } = setup([quote('a', 'A', 99), quote('b', 'B', 101)]);

      filter.setColumnFilter('price', { type: 'number', operator: 'greaterThan', value: 100 });

      expect(ids(pipeline)).toEqual(['b']);
    });

    it('filters an inclusive range', () => {
      const { pipeline, filter } = setup([
        quote('a', 'A', 99),
        quote('b', 'B', 100),
        quote('c', 'C', 101),
      ]);

      filter.setColumnFilter('price', {
        type: 'number',
        operator: 'inRange',
        value: 100,
        to: 101,
      });

      expect(ids(pipeline)).toEqual(['b', 'c']);
    });

    it('filters by a set of values', () => {
      const { pipeline, filter } = setup([quote('a', 'A'), quote('b', 'B'), quote('c', 'C')]);

      filter.setColumnFilter('instrument', { type: 'set', values: ['A', 'C'] });

      expect(ids(pipeline)).toEqual(['a', 'c']);
    });

    it('combines several column filters with AND', () => {
      const { pipeline, filter } = setup([
        quote('a', 'UKT', 99),
        quote('b', 'UKT', 101),
        quote('c', 'DBR', 101),
      ]);

      filter.setFilterModel({
        instrument: { type: 'text', operator: 'contains', value: 'UKT' },
        price: { type: 'number', operator: 'greaterThan', value: 100 },
      });

      expect(ids(pipeline)).toEqual(['b']);
    });

    it('treats a text filter with no term as inactive, so a half-typed filter does not blank the grid', () => {
      const { pipeline, filter } = setup([quote('a', 'A'), quote('b', 'B')]);

      filter.setColumnFilter('instrument', { type: 'text', operator: 'contains', value: '' });

      expect(ids(pipeline)).toEqual(['a', 'b']);
    });

    it('filters on the resolved value, so a computed column filters on what it shows', () => {
      const { pipeline, filter } = setup(
        [quote('a', 'A', 1), quote('b', 'B', 2)],
        [{ colId: 'doubled', valueGetter: ({ data }) => (data.price ?? 0) * 2 }],
      );

      filter.setColumnFilter('doubled', { type: 'number', operator: 'equals', value: 4 });

      expect(ids(pipeline)).toEqual(['b']);
    });

    it('ignores a filter naming a column that does not exist', () => {
      const { pipeline, filter } = setup([quote('a', 'A')]);

      filter.setColumnFilter('ghost', { type: 'text', operator: 'contains', value: 'zzz' });

      expect(ids(pipeline)).toEqual(['a']);
    });

    it('removes a filter when set to null', () => {
      const { pipeline, filter } = setup([quote('a', 'A'), quote('b', 'B')]);
      filter.setColumnFilter('instrument', { type: 'text', operator: 'contains', value: 'A' });
      expect(ids(pipeline)).toEqual(['a']);

      filter.setColumnFilter('instrument', null);

      expect(ids(pipeline)).toEqual(['a', 'b']);
    });
  });

  describe('quick filter', () => {
    it('matches across every column', () => {
      const { pipeline, filter } = setup([quote('a', 'UKT', 99), quote('b', 'DBR', 101)]);

      filter.setQuickFilter('dbr');

      expect(ids(pipeline)).toEqual(['b']);
    });

    it('matches the formatted text, so what is typed matches what is visible', () => {
      // The raw value is 100.5; the cell shows "100.50".
      const { pipeline, filter } = setup(
        [quote('a', 'A', 100.5)],
        [{ field: 'price', valueFormatter: ({ value }) => (value as number).toFixed(2) }],
      );

      filter.setQuickFilter('100.50');

      expect(ids(pipeline)).toEqual(['a']);
    });

    it('combines with column filters', () => {
      const { pipeline, filter } = setup([quote('a', 'UKT', 99), quote('b', 'UKT', 101)]);
      filter.setColumnFilter('price', { type: 'number', operator: 'greaterThan', value: 100 });

      filter.setQuickFilter('ukt');

      expect(ids(pipeline)).toEqual(['b']);
    });

    it('clears', () => {
      const { pipeline, filter } = setup([quote('a', 'A'), quote('b', 'B')]);
      filter.setQuickFilter('a');

      filter.clearFilters();

      expect(ids(pipeline)).toEqual(['a', 'b']);
    });
  });

  describe('dependsOn', () => {
    const dependencies = (pipeline: GridPipeline<Quote>) =>
      (
        pipeline.projector as unknown as { stages: { id: string; dependsOn: unknown }[] }
      ).stages.find((s) => s.id === 'filter')!.dependsOn;

    it('declares nothing when inactive', () => {
      expect(dependencies(setup([]).pipeline)).toBeUndefined();
    });

    it('declares only the filtered field', () => {
      const { pipeline, filter } = setup([quote('a', 'A')]);

      filter.setColumnFilter('price', { type: 'number', operator: 'greaterThan', value: 1 });

      expect([...(dependencies(pipeline) as Set<string>)]).toEqual(['price']);
    });

    it("declares '*' for a quick filter, which reads every column", () => {
      const { pipeline, filter } = setup([quote('a', 'A')]);

      filter.setQuickFilter('x');

      expect(dependencies(pipeline)).toBe('*');
    });

    it('does not re-filter when an unrelated field ticks', () => {
      const { pipeline, filter } = setup([quote('a', 'AAA', 1)]);
      filter.setColumnFilter('instrument', { type: 'text', operator: 'contains', value: 'A' });
      pipeline.projector.rows.get();
      const before = pipeline.layout.get();

      pipeline.store.applyTransaction({ update: [quote('a', 'AAA', 999)] });
      pipeline.store.flushSync();

      expect(pipeline.layout.get()).toBe(before);
    });

    it('re-filters when the filtered field ticks', () => {
      const { pipeline, filter } = setup([quote('a', 'A', 1), quote('b', 'B', 2)]);
      filter.setColumnFilter('price', { type: 'number', operator: 'greaterThan', value: 100 });
      expect(ids(pipeline)).toEqual([]);

      pipeline.store.applyTransaction({ update: [quote('a', 'A', 999)] });
      pipeline.store.flushSync();

      expect(ids(pipeline)).toEqual(['a']);
    });
  });

  describe('with the tree module', () => {
    it('keeps the ancestors of a surviving descendant', () => {
      const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
      pipeline.store.setRowData([
        { id: 'g', parentId: null, instrument: 'Group', price: 0 },
        { id: 'c1', parentId: 'g', instrument: 'Match me', price: 1 },
        { id: 'c2', parentId: 'g', instrument: 'Other', price: 2 },
      ]);
      const filter = new FilterModule<Quote>();
      const tree = new TreeModule<Quote>({ getParentId: (d) => d.parentId, defaultExpanded: true });
      const registry = new ModuleRegistry<Quote>({
        pipeline,
        getColumns: () => resolveColumns<Quote>(columns),
        dispatch: () => {},
      });
      registry.register(tree);
      registry.register(filter);
      registry.start();

      filter.setColumnFilter('instrument', { type: 'text', operator: 'contains', value: 'Match' });

      expect(ids(pipeline)).toEqual(['g', 'c1']);
    });
  });

  describe('state and events', () => {
    it('round-trips', () => {
      const { filter } = setup([quote('a', 'A')]);
      filter.setColumnFilter('instrument', { type: 'text', operator: 'contains', value: 'A' });
      filter.setQuickFilter('q');
      const saved = filter.getState();

      filter.clearFilters();
      filter.setState(saved);

      expect(filter.getQuickFilter()).toBe('q');
      expect(filter.getColumnFilter('instrument')).toEqual({
        type: 'text',
        operator: 'contains',
        value: 'A',
      });
    });

    it('dispatches on change', () => {
      const { filter, dispatch } = setup([quote('a', 'A')]);

      filter.setQuickFilter('x');

      expect(dispatch).toHaveBeenCalledWith(
        'flow-filter-changed',
        expect.objectContaining({ quickFilter: 'x' }),
      );
    });
  });
});

describe('header UI', () => {
  it('renders no header input by default, so a narrow column keeps its label', () => {
    const { filter } = setup([quote('a', 'A')]);
    const column = resolveColumns<Quote>(columns)[0]!;

    expect(filter.headerSlot({ column })).toBeNull();
  });

  it('renders one when explicitly enabled', () => {
    const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
    const filter = new FilterModule<Quote>({ headerUi: true });
    const registry = new ModuleRegistry<Quote>({
      pipeline,
      getColumns: () => resolveColumns<Quote>(columns),
      dispatch: () => {},
    });
    registry.register(filter);
    registry.start();
    const column = resolveColumns<Quote>(columns)[0]!;

    expect(filter.headerSlot({ column })).not.toBeNull();
  });

  it('renders none for a column marked unfilterable', () => {
    const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
    const filter = new FilterModule<Quote>({ headerUi: true });
    const registry = new ModuleRegistry<Quote>({
      pipeline,
      getColumns: () => resolveColumns<Quote>(columns),
      dispatch: () => {},
    });
    registry.register(filter);
    registry.start();
    const column = resolveColumns<Quote>([{ field: 'price', filterable: false }])[0]!;

    expect(filter.headerSlot({ column })).toBeNull();
  });
});

describe('matchesFilter', () => {
  it('matches blanks', () => {
    expect(matchesFilter(null, { type: 'text', operator: 'blank' })).toBe(true);
    expect(matchesFilter('x', { type: 'text', operator: 'blank' })).toBe(false);
  });

  it('matches non-blanks', () => {
    expect(matchesFilter('x', { type: 'text', operator: 'notBlank' })).toBe(true);
  });

  it('rejects a non-numeric value against a number filter', () => {
    expect(matchesFilter('abc', { type: 'number', operator: 'greaterThan', value: 1 })).toBe(false);
  });

  it('matches nothing for an empty set filter', () => {
    expect(matchesFilter('a', { type: 'set', values: [] })).toBe(false);
  });

  it('supports startsWith and endsWith', () => {
    expect(matchesFilter('UKT 2030', { type: 'text', operator: 'startsWith', value: 'UKT' })).toBe(
      true,
    );
    expect(matchesFilter('UKT 2030', { type: 'text', operator: 'endsWith', value: '2030' })).toBe(
      true,
    );
  });
});
