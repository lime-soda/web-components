import { createContext } from '@lit/context';
import type { ResolvedColumn } from '../columns/types.js';
import type { GridController } from '../controller/grid-controller.js';
import type { DisplayRow, LayoutInstance } from '../layout/types.js';
import type { RowStore } from '../store/row-store.js';
import type { RowNode } from '../store/types.js';

/**
 * A row, as seen by anything rendered inside it.
 *
 * The object identity is stable for the lifetime of the row element, but `node`
 * and `data` read through a signal. A cell renderer that extends
 * {@link CellRendererElement} therefore re-renders when its row ticks, without
 * subscribing to anything or receiving a single prop — which is the point of
 * putting this on a context rather than drilling params down.
 */
export class RowContextValue<TData = unknown> {
  constructor(
    private readonly store: RowStore<TData>,
    readonly displayRow: DisplayRow,
  ) {}

  get rowId(): string {
    return this.displayRow.rowId;
  }

  get node(): RowNode<TData> | undefined {
    return this.store.rowSignal(this.displayRow.rowId).get();
  }

  get data(): TData | undefined {
    return this.node?.data;
  }

  /** Module annotations for this row: depth, isGroup, isRepeat, … */
  get meta(): Readonly<Record<string, unknown>> {
    return this.displayRow.meta ?? {};
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- contexts are structurally typed at the consumer
export const gridContext = createContext<GridController<any> | undefined>(Symbol('tf-grid'));

export const instanceContext = createContext<LayoutInstance | undefined>(Symbol('tf-instance'));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see gridContext
export const rowContext = createContext<RowContextValue<any> | undefined>(Symbol('tf-row'));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see gridContext
export const columnContext = createContext<ResolvedColumn<any, any> | undefined>(
  Symbol('tf-column'),
);
