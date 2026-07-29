import type { CellPosition } from '../../controller/focus-controller.js';
import type { RowNode } from '../../store/types.js';
import type { GridModule, ModuleContext } from '../types.js';

/** A row keyboard navigation is deciding whether to land on. */
export interface SkipRowParams<TData = unknown> {
  /** The row's id in the store. Repeats of an ancestor share it. */
  readonly rowId: string;
  /** Whatever the projection stages put there — `depth`, `isGroup`, and so on. */
  readonly meta: Readonly<Record<string, unknown>>;
  /** The row's data, absent for a row with no record behind it. */
  readonly node: RowNode<TData> | undefined;
}

export interface KeyboardModuleOptions<TData = unknown> {
  /** Ctrl/Cmd + Left/Right jumps a whole instance. On by default. */
  instanceJump?: boolean;

  /**
   * Rows to pass over rather than land on — group headings, separators, or
   * whatever else a particular grid treats as scenery.
   *
   * There is deliberately no built-in notion of which rows those are. This
   * module does not know what a group row is, and giving it a `skipGroupRows`
   * flag would teach it: it would have to read `meta.depth` or `meta.isGroup`,
   * conventions that belong to whichever module produced the hierarchy. The
   * predicate comes from the consumer, who knows what their rows mean, and the
   * module stays a mapping from keys onto movement.
   *
   * Applies to movement between rows — arrows, page keys, instance jumps —
   * and not to movement along one, since that never changes row. Headers are
   * never offered to it: a header is not a row.
   *
   * With every candidate skipped, the movement is refused and focus stays put.
   *
   * Explicitly allows `undefined` so `setOptions({ skipRow: undefined })` puts
   * it back: an option that can be set at runtime should be one that can be
   * unset.
   */
  skipRow?: ((params: SkipRowParams<TData>) => boolean) | undefined;
}

/**
 * Keyboard navigation.
 *
 * Deliberately thin: it maps keys onto the focus controller and does nothing
 * else. Traversal is layout mechanics and lives in core, so replacing these
 * bindings — a desk that wants vim keys, say — means writing a module of about
 * this size rather than reimplementing how instances and rows are arranged.
 *
 * Rewritten from the prototype's 471-line GridKeyboardBase, which mixed key
 * handling, focus tracking, DOM queries and sort/filter invocation together in a
 * component base class.
 */
export class KeyboardModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'keyboard';

  private context?: ModuleContext<TData>;

  constructor(private options: KeyboardModuleOptions<TData> = {}) {}

  /**
   * Replaces some or all of this module's options.
   *
   * Options given to the constructor are otherwise fixed for the life of the
   * grid: the grid's own options are reactive, but a module's are not reachable
   * through them, and reassigning `modules` does not re-register anything. This
   * is how a preference toggle reaches a module without rebuilding the grid.
   */
  setOptions(next: Partial<KeyboardModuleOptions<TData>>): void {
    this.options = { ...this.options, ...next };
    this.context?.invalidate();
  }

  init(context: ModuleContext<TData>): void {
    this.context = context;
  }

  onKeyDown(event: KeyboardEvent): boolean {
    const focus = this.context?.focus;
    if (!focus) return false;

    // Nothing focused yet: the first navigation key enters the grid at its start.
    if (focus.focused.get() === null && NAVIGATION_KEYS.has(event.key)) {
      focus.focusFirst();
      // The landing spot is subject to the same rule as any other.
      if (this.shouldSkip(focus.focused.get())) this.settle(1);
      return true;
    }

    const jump = (this.options.instanceJump ?? true) && (event.ctrlKey || event.metaKey);

    switch (event.key) {
      case 'ArrowDown':
        return this.step(1);
      case 'ArrowUp':
        return this.step(-1);
      case 'ArrowRight':
        return jump ? this.jump(1) : focus.moveColumn(1);
      case 'ArrowLeft':
        return jump ? this.jump(-1) : focus.moveColumn(-1);
      case 'Home':
        // Along a row, nothing is skipped; to the grid's start, settle inwards.
        return jump ? this.edge('instanceStart', 1) : focus.moveToEdge('rowStart');
      case 'End':
        return jump ? this.edge('instanceEnd', -1) : focus.moveToEdge('rowEnd');
      // A page is an instance: an instance is exactly one viewport of rows, so
      // paging and jumping instances are the same movement here.
      case 'PageDown':
        return this.jump(1);
      case 'PageUp':
        return this.jump(-1);
      case 'Escape':
        focus.clear();
        return true;
      default:
        return false;
    }
  }

  /**
   * Moves by rows, passing over any the consumer skips.
   *
   * Restores the starting position if every candidate in that direction is
   * skipped, so a refused movement leaves focus where it was rather than
   * halfway through the rows it rejected.
   */
  private step(delta: 1 | -1): boolean {
    const focus = this.context?.focus;
    if (!focus) return false;
    if (!this.options.skipRow) return focus.moveRow(delta);

    const start = focus.focused.get();
    if (!focus.moveRow(delta)) return false;
    if (this.settle(delta)) return true;

    focus.focus(start);
    return false;
  }

  /** Jumps an instance, then settles onto a row that is not skipped. */
  private jump(delta: 1 | -1): boolean {
    const focus = this.context?.focus;
    if (!focus) return false;

    const start = focus.focused.get();
    if (!focus.moveInstance(delta)) return false;
    if (this.settle(delta)) return true;

    focus.focus(start);
    return false;
  }

  /** Moves to an edge of the grid, then settles inwards. */
  private edge(to: 'instanceStart' | 'instanceEnd', inwards: 1 | -1): boolean {
    const focus = this.context?.focus;
    if (!focus) return false;

    const start = focus.focused.get();
    if (!focus.moveToEdge(to)) return false;
    if (this.settle(inwards)) return true;

    focus.focus(start);
    return false;
  }

  /**
   * Steps in one direction until the current position is not skipped.
   *
   * Bounded by the number of rows laid out, which is the most steps that could
   * ever be needed — a predicate that skips everything therefore costs one pass
   * rather than looping.
   */
  private settle(delta: 1 | -1): boolean {
    const focus = this.context?.focus;
    if (!focus) return false;

    let remaining = this.rowCount();
    while (this.shouldSkip(focus.focused.get())) {
      if (remaining-- <= 0) return false;
      if (!focus.moveRow(delta)) return false;
    }
    return true;
  }

  private rowCount(): number {
    const layout = this.context?.pipeline.layout.get();
    return layout?.instances.reduce((total, instance) => total + instance.rows.length, 0) ?? 0;
  }

  private shouldSkip(position: CellPosition | null): boolean {
    const skip = this.options.skipRow;
    if (!skip || position === null) return false;
    // A header is not a row, so it is never a candidate.
    if (position.section === 'header') return false;

    const row = this.context?.pipeline.layout
      .get()
      .instances.find((instance) => instance.id === position.instanceId)
      ?.rows.find((candidate) => candidate.id === position.rowKey);
    if (!row) return false;

    return skip({
      rowId: row.rowId,
      meta: row.meta ?? {},
      node: this.context?.pipeline.store.getRowNode(row.rowId),
    });
  }
}

const NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageDown',
  'PageUp',
]);
