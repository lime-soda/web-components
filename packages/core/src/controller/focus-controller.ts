import type { LayoutResult } from '../layout/types.js';
import { type ReadableSignal, type WritableSignal, signal } from '../reactive/index.js';

/** Which cell has focus. Identified by instance because repeated rows share a rowId. */
export interface CellPosition {
  readonly instanceId: string;
  /** The DisplayRow's unique id, not its rowId. */
  readonly rowKey: string;
  readonly colId: string;
}

export type FocusEdge = 'rowStart' | 'rowEnd' | 'instanceStart' | 'instanceEnd';

/**
 * Where focus is, and how it moves.
 *
 * Core owns this rather than a module because it is layout mechanics: only core
 * knows how instances and rows are arranged. A keyboard module maps key presses
 * onto these calls and nothing more, which keeps key bindings replaceable without
 * anyone reimplementing traversal.
 *
 * Movement follows the flow layout's reading order. Running off the bottom of an
 * instance continues at the top of the next one, because that is where the data
 * actually continues — not at the top of the same column.
 */
export class FocusController {
  private readonly position: WritableSignal<CellPosition | null> = signal<CellPosition | null>(
    null,
  );

  constructor(
    private readonly getLayout: () => LayoutResult,
    // Only colId is ever read, so that is all this asks for. Taking the full
    // ResolvedColumn would drag TData variance in for no benefit.
    private readonly getColumns: () => readonly { readonly colId: string }[],
  ) {}

  get focused(): ReadableSignal<CellPosition | null> {
    return this.position;
  }

  /**
   * Whether this cell is the grid's tab stop.
   *
   * Exactly one cell is tabbable at a time. Before anything has focus that is
   * the first cell, which is how a user reaches the grid at all — without it the
   * grid had no tab stop, so no key press ever arrived and navigation appeared
   * not to exist.
   */
  isTabbable(instanceId: string, rowKey: string, colId: string): boolean {
    if (this.position.get() !== null) return this.isFocused(instanceId, rowKey, colId);

    const instance = this.getLayout().instances[0];
    const column = this.getColumns()[0];
    return (
      instance?.id === instanceId && instance.rows[0]?.id === rowKey && column?.colId === colId
    );
  }

  isFocused(instanceId: string, rowKey: string, colId: string): boolean {
    const current = this.position.get();
    return (
      current !== null &&
      current.instanceId === instanceId &&
      current.rowKey === rowKey &&
      current.colId === colId
    );
  }

  focus(position: CellPosition | null): void {
    this.position.set(position);
  }

  clear(): void {
    this.position.set(null);
  }

  /** Focuses the first cell of the first instance. Used when focus enters the grid. */
  focusFirst(): void {
    const instance = this.getLayout().instances[0];
    const column = this.getColumns()[0];
    const row = instance?.rows[0];
    if (!instance || !column || !row) return;
    this.position.set({ instanceId: instance.id, rowKey: row.id, colId: column.colId });
  }

  /** Moves by whole rows, continuing into the next instance at either end. */
  moveRow(delta: number): boolean {
    const located = this.locate();
    if (!located) return false;

    const { instances, instanceIndex, rowIndex, colId } = located;
    let nextInstance = instanceIndex;
    let nextRow = rowIndex + delta;

    while (nextRow < 0 || nextRow >= (instances[nextInstance]?.rows.length ?? 0)) {
      if (nextRow < 0) {
        if (nextInstance === 0) return false;
        nextInstance -= 1;
        nextRow += instances[nextInstance]!.rows.length;
      } else {
        const length = instances[nextInstance]!.rows.length;
        if (nextInstance === instances.length - 1) return false;
        nextInstance += 1;
        nextRow -= length;
      }
    }

    return this.commit(nextInstance, nextRow, colId);
  }

  /** Moves by columns, continuing into the adjacent instance at either edge. */
  moveColumn(delta: number): boolean {
    const located = this.locate();
    if (!located) return false;

    const columns = this.getColumns();
    const { instances, instanceIndex, rowIndex, colIndex } = located;
    const next = colIndex + delta;

    if (next >= 0 && next < columns.length) {
      return this.commit(instanceIndex, rowIndex, columns[next]!.colId);
    }

    // Off the edge: carry into the neighbouring instance at the opposite edge,
    // keeping the same row so the eye follows the value across.
    const nextInstance = instanceIndex + (next < 0 ? -1 : 1);
    const target = instances[nextInstance];
    if (!target) return false;

    const wrappedColumn = next < 0 ? columns[columns.length - 1] : columns[0];
    const wrappedRow = Math.min(rowIndex, target.rows.length - 1);
    if (!wrappedColumn || wrappedRow < 0) return false;

    return this.commit(nextInstance, wrappedRow, wrappedColumn.colId);
  }

  /** Jumps a whole instance, keeping the row and column. */
  moveInstance(delta: number): boolean {
    const located = this.locate();
    if (!located) return false;

    const target = located.instances[located.instanceIndex + delta];
    if (!target) return false;

    return this.commit(
      located.instanceIndex + delta,
      Math.min(located.rowIndex, target.rows.length - 1),
      located.colId,
    );
  }

  moveToEdge(edge: FocusEdge): boolean {
    const located = this.locate();
    if (!located) return false;

    const columns = this.getColumns();
    const { instances, instanceIndex, rowIndex, colId } = located;

    switch (edge) {
      case 'rowStart':
        return this.commit(instanceIndex, rowIndex, columns[0]?.colId ?? colId);
      case 'rowEnd':
        return this.commit(instanceIndex, rowIndex, columns[columns.length - 1]?.colId ?? colId);
      case 'instanceStart':
        return this.commit(0, 0, colId);
      case 'instanceEnd': {
        const last = instances.length - 1;
        return this.commit(last, (instances[last]?.rows.length ?? 1) - 1, colId);
      }
    }
  }

  private commit(instanceIndex: number, rowIndex: number, colId: string): boolean {
    const instance = this.getLayout().instances[instanceIndex];
    const row = instance?.rows[rowIndex];
    if (!instance || !row) return false;

    this.position.set({ instanceId: instance.id, rowKey: row.id, colId });
    return true;
  }

  private locate():
    | {
        instances: LayoutResult['instances'];
        instanceIndex: number;
        rowIndex: number;
        colIndex: number;
        colId: string;
      }
    | undefined {
    const current = this.position.get();
    const instances = this.getLayout().instances;
    if (current === null) return undefined;

    const instanceIndex = instances.findIndex((instance) => instance.id === current.instanceId);
    if (instanceIndex === -1) return undefined;

    const rowIndex = instances[instanceIndex]!.rows.findIndex((row) => row.id === current.rowKey);
    if (rowIndex === -1) return undefined;

    const colIndex = this.getColumns().findIndex((column) => column.colId === current.colId);
    if (colIndex === -1) return undefined;

    return { instances, instanceIndex, rowIndex, colIndex, colId: current.colId };
  }
}
