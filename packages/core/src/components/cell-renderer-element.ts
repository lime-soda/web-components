import { consume } from '@lit/context';
import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { getCellValue } from '../columns/resolve-columns.js';
import type { ResolvedColumn } from '../columns/types.js';
import { type RowContextValue, columnContext, gridContext, rowContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import { SignalWatcher } from '../reactive/index.js';
import type { RowNode } from '../store/types.js';

/**
 * Base class for a custom cell renderer.
 *
 * A renderer declares `cellRenderer: 'my-depth-bar'` on its column and reads
 * everything it needs from context — no params are drilled down, and the element
 * can hold its own state, run its own animations and be tested on its own.
 *
 * Extending SignalWatcher means reading `this.value` during render subscribes to
 * the row, so the renderer repaints on a tick and nothing above it does.
 *
 * @example
 * ```ts
 * @customElement('depth-bar')
 * class DepthBar extends CellRendererElement<Quote, number> {
 *   render() {
 *     return html`<div style="width: ${(this.value ?? 0) / 100}%"></div>`;
 *   }
 * }
 * ```
 */
export abstract class CellRendererElement<TData = unknown, TValue = unknown> extends SignalWatcher(
  LitElement,
) {
  /** Whatever `cellRendererParams` was set to on the column definition. */
  @property({ attribute: false })
  accessor params: Record<string, unknown> = {};

  @consume({ context: gridContext, subscribe: true })
  accessor grid: GridController<TData> | undefined;

  @consume({ context: rowContext, subscribe: true })
  accessor row: RowContextValue<TData> | undefined;

  // Consumed at the context's own (loose) type, then narrowed by `column` below:
  // a generic subclass cannot vary the context type, but its callers should still
  // see their own TData/TValue.
  @consume({ context: columnContext, subscribe: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches columnContext
  accessor contextColumn: ResolvedColumn<any, any> | undefined;

  protected get column(): ResolvedColumn<TData, TValue> | undefined {
    return this.contextColumn as ResolvedColumn<TData, TValue> | undefined;
  }

  protected get node(): RowNode<TData> | undefined {
    return this.row?.node;
  }

  protected get data(): TData | undefined {
    return this.row?.data;
  }

  /** The resolved value for this cell, after `valueGetter` but before formatting. */
  protected get value(): TValue | undefined {
    const node = this.node;
    const column = this.column;
    if (!node || !column) return undefined;
    return getCellValue(column, node);
  }

  protected get api() {
    return this.grid?.api;
  }
}
