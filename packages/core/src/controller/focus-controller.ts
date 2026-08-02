import type { LayoutResult } from '../layout/types.js';
import { type ReadableSignal, type WritableSignal, signal } from '../reactive/index.js';

/** Which band of an instance focus is in. */
export type FocusSection = 'header' | 'body';

/** Which cell has focus. Identified by instance because repeated rows share a rowId. */
export interface CellPosition {
  readonly instanceId: string;
  /** The DisplayRow's unique id, not its rowId. Empty for a header. */
  readonly rowKey: string;
  readonly colId: string;
  readonly section: FocusSection;
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
 *
 * Headers are reachable, but only by moving backwards. Going down or forwards
 * lands on data every time: a header is a thing you go *up* to when you want it,
 * and stepping through one on the way to the next instance's rows would put a
 * stop in the path of the common movement for the sake of the rare one.
 */
export class FocusController {
  private readonly position: WritableSignal<CellPosition | null> = signal<CellPosition | null>(
    null,
  );

  private readonly inside: WritableSignal<boolean> = signal(false);

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
   * Whether focus is inside the grid at all.
   *
   * Separate from the position, because they answer different questions. The
   * position is remembered when focus leaves — that is what lets Tab return to
   * the cell you left rather than to the first one — but a remembered position
   * is not a focused grid, and painting a ring on it claims focus that
   * something else holds.
   */
  get withinGrid(): ReadableSignal<boolean> {
    return this.inside;
  }

  setWithinGrid(inside: boolean): void {
    this.inside.set(inside);
  }

  /**
   * Whether this cell is the grid's tab stop.
   *
   * Exactly one cell is tabbable at a time. Before anything has focus that is
   * the first body cell, which is how a user reaches the grid at all — without
   * it the grid had no tab stop, so no key press ever arrived and navigation
   * appeared not to exist.
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
      current.section === 'body' &&
      current.instanceId === instanceId &&
      current.rowKey === rowKey &&
      current.colId === colId
    );
  }

  /** Whether the header cell of this column, in this instance, has focus. */
  isHeaderFocused(instanceId: string, colId: string): boolean {
    const current = this.position.get();
    return (
      current !== null &&
      current.section === 'header' &&
      current.instanceId === instanceId &&
      current.colId === colId
    );
  }

  focus(position: CellPosition | null): void {
    this.position.set(position);
  }

  /** Focuses a header cell, the way clicking one would. */
  focusHeader(instanceId: string, colId: string): void {
    this.position.set({ instanceId, rowKey: '', colId, section: 'header' });
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
    this.position.set({
      instanceId: instance.id,
      rowKey: row.id,
      colId: column.colId,
      section: 'body',
    });
  }

  /**
   * Moves by whole rows, continuing into the next instance at either end.
   *
   * Upwards out of the first row enters this instance's header rather than the
   * previous instance, because the header is what sits above these rows.
   * Downwards never lands on a header at all.
   */
  moveRow(delta: number): boolean {
    const located = this.locate();
    if (!located) return false;

    const { instances, instanceIndex, colId } = located;

    if (located.section === 'header') {
      // Down out of a header is into its own rows; up is out of the instance
      // entirely, to the end of the one before it.
      if (delta > 0) return this.commit(instanceIndex, 0, colId);

      const previous = instanceIndex - 1;
      const target = instances[previous];
      if (!target) return false;
      return this.commit(previous, target.rows.length - 1, colId);
    }

    let nextInstance = instanceIndex;
    let nextRow = located.rowIndex + delta;

    while (nextRow < 0 || nextRow >= (instances[nextInstance]?.rows.length ?? 0)) {
      if (nextRow < 0) return this.commitHeader(nextInstance, colId);

      const length = instances[nextInstance]!.rows.length;
      if (nextInstance === instances.length - 1) return false;
      nextInstance += 1;
      nextRow -= length;
    }

    return this.commit(nextInstance, nextRow, colId);
  }

  /** Moves by columns, continuing into the adjacent instance at either edge. */
  moveColumn(delta: number): boolean {
    const located = this.locate();
    if (!located) return false;

    const columns = this.getColumns();
    const { instances, instanceIndex, rowIndex, colIndex, section } = located;
    const next = colIndex + delta;

    if (next >= 0 && next < columns.length) {
      const colId = columns[next]!.colId;
      return section === 'header'
        ? this.commitHeader(instanceIndex, colId)
        : this.commit(instanceIndex, rowIndex, colId);
    }

    // Off the edge: carry into the neighbouring instance at the opposite edge,
    // keeping the same row so the eye follows the value across.
    const nextInstance = instanceIndex + (next < 0 ? -1 : 1);
    const target = instances[nextInstance];
    if (!target) return false;

    const wrappedColumn = next < 0 ? columns[columns.length - 1] : columns[0];
    if (!wrappedColumn) return false;

    // A header stays a header across the join: moving sideways is not a way
    // into or out of the data.
    if (section === 'header') return this.commitHeader(nextInstance, wrappedColumn.colId);

    const wrappedRow = Math.min(rowIndex, target.rows.length - 1);
    if (wrappedRow < 0) return false;
    return this.commit(nextInstance, wrappedRow, wrappedColumn.colId);
  }

  /**
   * Moves one cell in reading order: along the row, then on to the next row.
   *
   * What Tab means in a grid. Unlike the arrows, it does not stop at the end of
   * a row or the end of an instance — it carries on to the next, taking in the
   * header at the top of each because that is where reading order puts it.
   *
   * Returns false at the two ends of the grid, which is what lets Tab leave:
   * refusing to move means the key is not handled, so the browser takes focus
   * onward to whatever follows the grid rather than trapping the user in it.
   */
  moveCell(delta: 1 | -1): boolean {
    const located = this.locate();
    if (!located) return false;

    const columns = this.getColumns();
    const { instances, instanceIndex, rowIndex, colIndex, section } = located;
    const next = colIndex + delta;

    // Still within the row.
    if (next >= 0 && next < columns.length) {
      const colId = columns[next]!.colId;
      return section === 'header'
        ? this.commitHeader(instanceIndex, colId)
        : this.commit(instanceIndex, rowIndex, colId);
    }

    const first = columns[0]?.colId;
    const last = columns[columns.length - 1]?.colId;
    if (first === undefined || last === undefined) return false;

    if (delta > 0) {
      // Off the end of a header: into the rows it heads.
      if (section === 'header') return this.commit(instanceIndex, 0, first);

      const rows = instances[instanceIndex]?.rows.length ?? 0;
      if (rowIndex + 1 < rows) return this.commit(instanceIndex, rowIndex + 1, first);
      // Off the end of an instance: the next one begins with its header.
      return this.commitHeader(instanceIndex + 1, first);
    }

    // Backwards out of a header: the end of the instance before it.
    if (section === 'header') {
      const previous = instances[instanceIndex - 1];
      if (!previous) return false;
      return this.commit(instanceIndex - 1, previous.rows.length - 1, last);
    }

    if (rowIndex > 0) return this.commit(instanceIndex, rowIndex - 1, last);
    return this.commitHeader(instanceIndex, last);
  }

  /** Jumps a whole instance, keeping the row and column. */
  moveInstance(delta: number): boolean {
    const located = this.locate();
    if (!located) return false;

    const target = located.instances[located.instanceIndex + delta];
    if (!target) return false;

    // Jumping never crosses between header and data: whichever band you set off
    // from is the one you arrive in.
    if (located.section === 'header') {
      return this.commitHeader(located.instanceIndex + delta, located.colId);
    }

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
    const { instances, instanceIndex, rowIndex, colId, section } = located;

    switch (edge) {
      case 'rowStart': {
        const target = columns[0]?.colId ?? colId;
        return section === 'header'
          ? this.commitHeader(instanceIndex, target)
          : this.commit(instanceIndex, rowIndex, target);
      }
      case 'rowEnd': {
        const target = columns[columns.length - 1]?.colId ?? colId;
        return section === 'header'
          ? this.commitHeader(instanceIndex, target)
          : this.commit(instanceIndex, rowIndex, target);
      }
      // Jumping to either end of the grid lands on data, like every other
      // forward movement.
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

    this.position.set({ instanceId: instance.id, rowKey: row.id, colId, section: 'body' });
    return true;
  }

  private commitHeader(instanceIndex: number, colId: string): boolean {
    const instance = this.getLayout().instances[instanceIndex];
    if (!instance) return false;

    this.position.set({ instanceId: instance.id, rowKey: '', colId, section: 'header' });
    return true;
  }

  private locate():
    | {
        instances: LayoutResult['instances'];
        instanceIndex: number;
        rowIndex: number;
        colIndex: number;
        colId: string;
        section: FocusSection;
      }
    | undefined {
    const current = this.position.get();
    const instances = this.getLayout().instances;
    if (current === null) return undefined;

    const instanceIndex = instances.findIndex((instance) => instance.id === current.instanceId);
    if (instanceIndex === -1) return undefined;

    const colIndex = this.getColumns().findIndex((column) => column.colId === current.colId);
    if (colIndex === -1) return undefined;

    if (current.section === 'header') {
      // A header has no row of its own; -1 records that and is never used to
      // index, because every header path commits through `commitHeader`.
      return {
        instances,
        instanceIndex,
        rowIndex: -1,
        colIndex,
        colId: current.colId,
        section: 'header',
      };
    }

    const rowIndex = instances[instanceIndex]!.rows.findIndex((row) => row.id === current.rowKey);
    if (rowIndex === -1) return undefined;

    return { instances, instanceIndex, rowIndex, colIndex, colId: current.colId, section: 'body' };
  }
}
