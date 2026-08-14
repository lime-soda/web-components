import { describe, expect, it } from 'vite-plus/test';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { StackLayoutEngine } from '../../layout/stack-layout-engine.js';
import { resolveColumns } from '../../columns/resolve-columns.js';
import type { ResolvedColumn } from '../../columns/types.js';
import { ColumnsModule } from './columns-module.js';
import './index.js';

/**
 * Arranging columns: order, width, pinning.
 *
 * The module owns a rewrite of the resolved column list, which is the one place
 * every one of its features meets. Order of operations matters here in a way it
 * does not elsewhere — pinning gathers columns to the edges, which is itself a
 * reorder — so the interactions are what these fix.
 */

interface Quote {
  id: string;
  instrument: string;
  price: number;
  size: number;
}

const defs = [
  { field: 'instrument', width: 200 },
  { field: 'price', width: 100 },
  { field: 'size', width: 120 },
];

const setup = (options = {}, layout: 'flow' | 'stack' = 'stack') => {
  const pipeline = new GridPipeline<Quote>({
    getRowId: (d) => d.id,
    ...(layout === 'stack' ? { engine: new StackLayoutEngine() } : {}),
  });
  const columns = new ColumnsModule<Quote>(options);
  // Annotated because `getColumns` reaches back through `resolve` to the
  // registry it belongs to, which the inference cannot untangle on its own.
  const registry: ModuleRegistry<Quote> = new ModuleRegistry<Quote>({
    pipeline,
    getColumns: () => resolve(),
    dispatch: () => {},
  });
  const resolve = (): readonly ResolvedColumn<Quote>[] =>
    registry.transformColumns(resolveColumns<Quote>(defs));

  registry.register(columns);
  registry.start();

  return { columns, resolve };
};

const ids = (columns: readonly { colId: string }[]) => columns.map((c) => c.colId);

describe('ColumnsModule', () => {
  it('leaves the declared columns alone until something moves', () => {
    const { resolve } = setup();

    expect(ids(resolve())).toEqual(['instrument', 'price', 'size']);
  });

  it('applies an explicit order', () => {
    const { columns, resolve } = setup();

    columns.moveColumn('size', 0);

    expect(ids(resolve())).toEqual(['size', 'instrument', 'price']);
  });

  it('keeps a column that appeared after the order was recorded', () => {
    // A saved arrangement should not silently drop a column the grid gained
    // since — a module's checkbox column, or a new field.
    const { columns, resolve } = setup();

    columns.setColumnState([{ colId: 'size' }, { colId: 'price' }]);

    expect(ids(resolve())).toContain('instrument');
    expect(ids(resolve())).toHaveLength(3);
  });

  it('resizes a column and fixes it there', () => {
    // Fixed rather than flex: a column the user sized should survive the next
    // container resize rather than be redistributed away from what they chose.
    const { columns, resolve } = setup();

    columns.setColumnWidth('price', 250);
    const price = resolve().find((c) => c.colId === 'price')!;

    expect(price.width).toBe(250);
    expect(price.sizing).toBe('fixed');
  });

  it('refuses to resize below the floor', () => {
    // A column dragged to nothing cannot be dragged back — there is no handle
    // left to grab.
    const { columns, resolve } = setup({ minWidth: 60 });

    columns.setColumnWidth('price', 5);

    expect(resolve().find((c) => c.colId === 'price')!.width).toBe(60);
  });

  it('gathers pinned columns to their edges', () => {
    // The offsets that hold them there accumulate in column order, so a pinned
    // column left in the middle would stick over its own neighbours.
    const { columns, resolve } = setup();

    columns.setColumnPinned('size', 'left');
    columns.setColumnPinned('instrument', 'right');

    expect(ids(resolve())).toEqual(['size', 'price', 'instrument']);
  });

  it('applies the order before pinning rearranges it', () => {
    const { columns, resolve } = setup();

    columns.moveColumn('size', 0);
    columns.setColumnPinned('price', 'left');

    // price to the front because it is pinned; the rest keep the moved order.
    expect(ids(resolve())).toEqual(['price', 'size', 'instrument']);
  });

  it('ignores pinning when it is turned off', () => {
    const { columns, resolve } = setup({ pinnable: false });

    columns.setColumnPinned('size', 'left');

    expect(ids(resolve())).toEqual(['instrument', 'price', 'size']);
  });

  it('round-trips its state', () => {
    // What persistence needs: restoring a saved arrangement has to reproduce it
    // exactly, or a saved layout drifts every time it is loaded.
    const { columns, resolve } = setup();

    columns.moveColumn('size', 0);
    columns.setColumnWidth('price', 250);
    columns.setColumnPinned('instrument', 'left');
    const saved = columns.getColumnState();
    const arrangement = ids(resolve());

    columns.resetColumnState();
    expect(ids(resolve())).toEqual(['instrument', 'price', 'size']);

    columns.setColumnState(saved);

    expect(ids(resolve())).toEqual(arrangement);
    expect(resolve().find((c) => c.colId === 'price')!.width).toBe(250);
  });

  it('pins nothing in the flow layout', () => {
    const { columns, resolve } = setup({}, 'flow');

    columns.setColumnPinned('size', 'left');

    // The order is untouched, so the columns stay where they were declared.
    expect(ids(resolve())).toEqual(['instrument', 'price', 'size']);
  });
});
