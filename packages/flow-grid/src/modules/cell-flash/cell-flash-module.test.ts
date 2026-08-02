import { describe, expect, it, vi } from 'vite-plus/test';
import { resolveColumns } from '../../columns/resolve-columns.js';
import type { ColumnDef, ResolvedColumn } from '../../columns/types.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import type { RowNode } from '../../store/types.js';
import { ModuleRegistry } from '../module-registry.js';
import type { CellContext } from '../types.js';
import { CellFlashModule, type CellFlashModuleOptions } from './cell-flash-module.js';
import './index.js';

interface Quote {
  id: string;
  price: number;
  label?: string;
}

const columns: ColumnDef<Quote>[] = [{ field: 'price' }, { field: 'label' }];

const setup = (options: CellFlashModuleOptions = {}, defs = columns) => {
  const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
  const flash = new CellFlashModule<Quote>(options);
  const registry = new ModuleRegistry<Quote>({
    pipeline,
    getColumns: () => resolveColumns<Quote>(defs),
    dispatch: () => {},
  });
  registry.register(flash);
  registry.start();
  return { pipeline, flash, resolved: resolveColumns<Quote>(defs) };
};

/** One cellDecorator call for a row at a given value. */
const decorateAt = (
  flash: CellFlashModule<Quote>,
  column: ResolvedColumn<Quote>,
  rowId: string,
  data: Quote,
) => {
  const node: RowNode<Quote> = { id: rowId, data };
  const ctx: CellContext<Quote> = {
    row: { id: rowId, rowId },
    node,
    column,
    value: undefined,
  };
  return flash.cellDecorator(ctx);
};

describe('CellFlashModule', () => {
  it('does not flash a cell it has never seen', () => {
    // A cell scrolling into view has not changed; it has never been rendered.
    const { flash, resolved } = setup();

    expect(decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100 })).toBeNull();
  });

  it('does not flash when the value is unchanged', () => {
    const { flash, resolved } = setup();
    decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100 });

    expect(decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100 })).toBeNull();
  });

  it('flashes when the value changes', () => {
    const { flash, resolved } = setup();
    decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100 });

    const decoration = decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 101 });

    expect(decoration?.onRendered).toBeTypeOf('function');
  });

  it('tracks each cell separately, so one column changing does not flash another', () => {
    const { flash, resolved } = setup();
    decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100, label: 'x' });
    decorateAt(flash, resolved[1]!, 'a', { id: 'a', price: 100, label: 'x' });

    const priceChanged = decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 101, label: 'x' });
    const labelSame = decorateAt(flash, resolved[1]!, 'a', { id: 'a', price: 101, label: 'x' });

    expect(priceChanged).not.toBeNull();
    expect(labelSame).toBeNull();
  });

  it('tracks each row separately', () => {
    const { flash, resolved } = setup();
    decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100 });

    expect(decorateAt(flash, resolved[0]!, 'b', { id: 'b', price: 999 })).toBeNull();
  });

  it('respects enableCellFlash: false, for a renderer that animates itself', () => {
    const { flash, resolved } = setup({}, [{ field: 'price', enableCellFlash: false }]);
    decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100 });

    expect(decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 101 })).toBeNull();
  });

  it('flashes on the resolved value, so a formatter that rounds a move away produces none', () => {
    const { flash } = setup();
    const rounded = resolveColumns<Quote>([
      { colId: 'rounded', valueGetter: ({ data }) => Math.round(data.price) },
    ])[0]!;

    decorateAt(flash, rounded, 'a', { id: 'a', price: 100.1 });

    expect(decorateAt(flash, rounded, 'a', { id: 'a', price: 100.2 })).toBeNull();
  });

  describe('direction', () => {
    const directionFor = (from: number, to: number, options: CellFlashModuleOptions = {}) => {
      const { flash, resolved } = setup(options);
      const column = resolved[0]!;
      decorateAt(flash, column, 'a', { id: 'a', price: from });
      decorateAt(flash, column, 'a', { id: 'a', price: to });

      // Capture the direction by intercepting the colour lookup through a stub cell.
      let captured: string | undefined;
      const cell = {
        animate: (frames: Keyframe[]) => {
          captured = (frames[0] as { backgroundColor?: string }).backgroundColor;
          return { cancel() {}, set onfinish(_: unknown) {}, set oncancel(_: unknown) {} };
        },
      } as unknown as HTMLElement;
      vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));

      const decoration = decorateAt(flash, column, 'a', { id: 'a', price: to + (to - from) });
      decoration?.onRendered?.(cell);
      vi.unstubAllGlobals();
      return captured;
    };

    it('flashes green on a rise', () => {
      expect(directionFor(100, 101)).toContain('34, 197, 94');
    });

    it('flashes red on a fall', () => {
      expect(directionFor(101, 100)).toContain('239, 68, 68');
    });

    it('flashes neutral when directional is off', () => {
      expect(directionFor(100, 101, { directional: false })).toContain('148, 163, 184');
    });

    it('honours a custom getDirection, for values that are not numbers', () => {
      const { flash, resolved } = setup({ getDirection: () => null });
      decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100 });

      expect(decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 101 })).toBeNull();
    });
  });

  it('forgets a removed row rather than growing forever', () => {
    // 5,000 instruments by 6 columns is 30,000 entries before any churn.
    const { flash, pipeline, resolved } = setup();
    pipeline.store.setRowData([{ id: 'a', price: 100 }]);
    decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 100 });

    pipeline.store.applyTransaction({ remove: ['a'] });
    pipeline.store.flushSync();

    // Seen afresh, so no flash — the entry is gone.
    expect(decorateAt(flash, resolved[0]!, 'a', { id: 'a', price: 999 })).toBeNull();
  });
});
