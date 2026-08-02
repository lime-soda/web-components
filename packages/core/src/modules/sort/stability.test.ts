import { describe, expect, it, vi } from 'vite-plus/test';
import { resolveColumns } from '../../columns/resolve-columns.js';
import type { ColumnDef } from '../../columns/types.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { SortModule, type SortModuleOptions } from './sort-module.js';
import './index.js';

/**
 * What a sorted grid does while its values tick.
 *
 * Re-sorting on every tick is correct and unusable: sort by price on a live
 * feed and rows stream past the pointer, so the row being reached for has moved
 * by the time the click lands. The order therefore holds while values change,
 * and is recomputed at the points where a reorder is not a surprise.
 */

interface Quote {
  id: string;
  instrument: string;
  price: number;
}

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', width: 200 },
  { field: 'price', width: 100 },
];

const setup = (options: SortModuleOptions = {}) => {
  const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
  pipeline.store.setRowData([
    { id: 'a', instrument: 'A', price: 1 },
    { id: 'b', instrument: 'B', price: 2 },
    { id: 'c', instrument: 'C', price: 3 },
  ]);
  const sort = new SortModule<Quote>(options);
  const registry = new ModuleRegistry<Quote>({
    pipeline,
    getColumns: () => resolveColumns<Quote>(columns),
    dispatch: vi.fn(),
  });
  registry.register(sort);
  registry.start();
  sort.setSortModel([{ colId: 'price', direction: 'asc' }]);
  return { pipeline, sort };
};

const order = (pipeline: GridPipeline<Quote>) =>
  pipeline.projector.rows.get().map((row) => row.rowId);

/** Moves 'a' to the top of a descending price sort — a reorder if one happens. */
const tickAToTheTop = (pipeline: GridPipeline<Quote>) => {
  pipeline.store.applyTransaction({ update: [{ id: 'a', instrument: 'A', price: 99 }] });
  pipeline.store.flushSync();
};

describe('sort under a live feed', () => {
  it('holds its order when a sorted value changes', () => {
    const { pipeline } = setup();
    expect(order(pipeline)).toEqual(['a', 'b', 'c']);

    tickAToTheTop(pipeline);

    expect(order(pipeline)).toEqual(['a', 'b', 'c']);
  });

  it('does not re-project at all, so the layout survives a tick', () => {
    const { pipeline } = setup();
    const before = pipeline.projector.rows.get();

    tickAToTheTop(pipeline);

    // Object identity: the tick reached the cells without touching the rows
    // above them.
    expect(pipeline.projector.rows.get()).toBe(before);
  });

  it('re-sorts when a row is added, against current values', () => {
    const { pipeline } = setup();
    tickAToTheTop(pipeline);

    pipeline.store.applyTransaction({ add: [{ id: 'd', instrument: 'D', price: 2.5 }] });
    pipeline.store.flushSync();

    // 'a' ticked to 99 while the order was held, and takes its real place now.
    expect(order(pipeline)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('re-sorts when a row is removed', () => {
    const { pipeline } = setup();
    tickAToTheTop(pipeline);

    pipeline.store.applyTransaction({ remove: ['c'] });
    pipeline.store.flushSync();

    expect(order(pipeline)).toEqual(['b', 'a']);
  });

  it('sorts on a header click, which is not a value change', () => {
    // The point of the default is that ticks are ignored, not that the sort
    // stops working — a click has to re-order against current values.
    const { pipeline, sort } = setup();
    expect(order(pipeline)).toEqual(['a', 'b', 'c']);

    tickAToTheTop(pipeline);
    expect(order(pipeline)).toEqual(['a', 'b', 'c']);

    const column = resolveColumns<Quote>(columns).find((c) => c.colId === 'price')!;
    sort.headerDecorator({ column } as never)?.onActivate?.(new Event('click'));

    // Cycles asc → desc, and 'a' leads only if the click sorted on the value it
    // ticked to rather than the one it had when the order was last computed.
    expect(order(pipeline)).toEqual(['a', 'c', 'b']);
    expect(sort.getSortModel()).toEqual([{ colId: 'price', direction: 'desc' }]);
  });

  it('keeps cycling direction on repeated header clicks', () => {
    const { pipeline, sort } = setup();
    const column = resolveColumns<Quote>(columns).find((c) => c.colId === 'price')!;
    const click = () => sort.headerDecorator({ column } as never)?.onActivate?.(new Event('click'));

    click(); // asc was already set by setup, so this moves on to desc
    expect(order(pipeline)).toEqual(['c', 'b', 'a']);

    click();
    expect(sort.getSortModel()).toEqual([]);
  });

  it('re-sorts when the sort model changes', () => {
    const { pipeline, sort } = setup();
    tickAToTheTop(pipeline);

    sort.setSortModel([{ colId: 'price', direction: 'asc' }]);

    expect(order(pipeline)).toEqual(['b', 'c', 'a']);
  });

  it('re-sorts on demand, without changing the model', () => {
    const { pipeline, sort } = setup();
    tickAToTheTop(pipeline);

    sort.refreshSort();

    expect(order(pipeline)).toEqual(['b', 'c', 'a']);
    expect(sort.getSortModel()).toEqual([{ colId: 'price', direction: 'asc' }]);
  });

  it('does nothing on refresh when nothing is sorted', () => {
    const { pipeline, sort } = setup();
    sort.clearSort();
    const before = pipeline.projector.rows.get();

    sort.refreshSort();

    expect(pipeline.projector.rows.get()).toBe(before);
  });

  describe('with resortOnValueChange', () => {
    it('re-sorts as values change', () => {
      const { pipeline } = setup({ resortOnValueChange: true });

      tickAToTheTop(pipeline);

      expect(order(pipeline)).toEqual(['b', 'c', 'a']);
    });

    it('ignores a change to a column that is not sorted', () => {
      const { pipeline } = setup({ resortOnValueChange: true });
      const before = pipeline.projector.rows.get();

      pipeline.store.applyTransaction({ update: [{ id: 'a', instrument: 'Z', price: 1 }] });
      pipeline.store.flushSync();

      expect(pipeline.projector.rows.get()).toBe(before);
    });

    it('can be turned on and off at runtime', () => {
      const { pipeline, sort } = setup();
      expect(order(pipeline)).toEqual(['a', 'b', 'c']);

      tickAToTheTop(pipeline);
      expect(order(pipeline)).toEqual(['a', 'b', 'c']);

      sort.setOptions({ resortOnValueChange: true });
      expect(order(pipeline)).toEqual(['b', 'c', 'a']);

      // Changing an option invalidates the projection, so read once to settle
      // it: a tick arriving before that read would be folded into the pending
      // recompute and look like a re-sort that the option no longer asks for.
      sort.setOptions({ resortOnValueChange: false });
      expect(order(pipeline)).toEqual(['b', 'c', 'a']);

      pipeline.store.applyTransaction({ update: [{ id: 'c', instrument: 'C', price: 0 }] });
      pipeline.store.flushSync();
      expect(order(pipeline)).toEqual(['b', 'c', 'a']);
    });
  });
});
