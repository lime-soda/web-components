import { getCellValue } from '../../columns/resolve-columns.js';
import type { CellContext, CellDecoration, GridModule, ModuleContext } from '../types.js';

export type FlashDirection = 'up' | 'down' | 'neutral';

export interface CellFlashModuleOptions {
  /** Milliseconds. Defaults to the --grid-flash-duration theme value, 600ms. */
  duration?: number;
  /**
   * Colour a rise green and a fall red, rather than flashing one colour.
   * On by default: direction is the point of a flash on a trading desk.
   */
  directional?: boolean;
  /** Decide the direction yourself, for values that are not numbers. */
  getDirection?: (next: unknown, previous: unknown) => FlashDirection | null;
}

const DEFAULT_DURATION = 600;

/**
 * Flashes a cell when its value changes.
 *
 * Fires on the *resolved* value, so a computed column flashes when what it shows
 * changes rather than when some field behind it does, and a formatter that rounds
 * away a movement correctly produces no flash.
 *
 * The animation is imperative — Web Animations rather than CSS — because a CSS
 * animation will not retrigger reliably when the same class is reapplied within a
 * frame, which on a fast feed is most of them.
 */
export class CellFlashModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'cell-flash';

  private context?: ModuleContext<TData>;
  private readonly previous = new Map<string, unknown>();
  private readonly running = new Map<string, Animation>();

  constructor(private options: CellFlashModuleOptions = {}) {}

  /**
   * Replaces some or all of this module's options.
   *
   * Options given to the constructor are otherwise fixed for the life of the
   * grid: the grid's own options are reactive, but a module's are not reachable
   * through them, and reassigning `modules` does not re-register anything. This
   * is how a preference toggle reaches a module without rebuilding the grid.
   */
  setOptions(next: Partial<CellFlashModuleOptions>): void {
    this.options = { ...this.options, ...next };
    this.context?.invalidate();
  }

  init(context: ModuleContext<TData>): void {
    this.context = context;

    // Values for departed rows would otherwise accumulate for the life of the
    // grid — 5,000 instruments by 6 columns is 30,000 entries before any churn.
    context.addTeardown(
      context.pipeline.store.subscribe((result) => {
        for (const rowId of result.removed) {
          // Copied: the loop deletes from the map it is walking.
          for (const key of [...this.previous.keys()]) {
            if (key.startsWith(`${rowId}\u0000`)) this.previous.delete(key);
          }
        }
      }),
    );
  }

  destroy(): void {
    for (const animation of this.running.values()) animation.cancel();
    this.running.clear();
    this.previous.clear();
  }

  cellDecorator(ctx: CellContext<TData>): CellDecoration | null {
    if (ctx.column.enableCellFlash === false) return null;
    if (!ctx.node) return null;

    const key = `${ctx.row.rowId}\u0000${ctx.column.colId}`;
    const value = getCellValue(ctx.column, ctx.node);
    // Read before writing. Whether the cell has been seen is what decides the
    // flash, and an undefined previous value is a real value, not an absent one.
    const seen = this.previous.has(key);
    const previous = this.previous.get(key);
    this.previous.set(key, value);

    // No flash on first sight: a cell scrolling into view has not changed, it has
    // simply never been rendered before.
    if (!seen || Object.is(previous, value)) return null;

    const direction = this.directionOf(value, previous);
    if (direction === null) return null;

    return { onRendered: (cell) => this.flash(cell, key, direction) };
  }

  private directionOf(next: unknown, previous: unknown): FlashDirection | null {
    if (this.options.getDirection) return this.options.getDirection(next, previous);
    if ((this.options.directional ?? true) === false) return 'neutral';

    if (typeof next === 'number' && typeof previous === 'number') {
      return next > previous ? 'up' : 'down';
    }
    return 'neutral';
  }

  private flash(cell: HTMLElement, key: string, direction: FlashDirection): void {
    this.running.get(key)?.cancel();

    const colour = this.colourFor(cell, direction);
    const duration =
      this.options.duration ?? readNumber(cell, '--grid-flash-duration') ?? DEFAULT_DURATION;

    const animation = cell.animate(
      [{ backgroundColor: colour }, { backgroundColor: 'transparent' }],
      { duration, easing: 'ease-out' },
    );

    animation.onfinish = () => this.running.delete(key);
    animation.oncancel = () => this.running.delete(key);
    this.running.set(key, animation);
  }

  private colourFor(cell: HTMLElement, direction: FlashDirection): string {
    const styles = getComputedStyle(cell);
    const variable =
      direction === 'up'
        ? '--grid-flash-up'
        : direction === 'down'
          ? '--grid-flash-down'
          : '--grid-flash-neutral';

    const value = styles.getPropertyValue(variable).trim();
    if (value !== '') return value;

    return direction === 'up'
      ? 'rgba(34, 197, 94, 0.35)'
      : direction === 'down'
        ? 'rgba(239, 68, 68, 0.35)'
        : 'rgba(148, 163, 184, 0.35)';
  }
}

/** Reads a CSS time custom property as milliseconds. */
function readNumber(element: HTMLElement, variable: string): number | undefined {
  const raw = getComputedStyle(element).getPropertyValue(variable).trim();
  if (raw === '') return undefined;

  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) return undefined;

  const isSeconds = raw.endsWith('s') && !raw.endsWith('ms');
  return isSeconds ? parsed * 1000 : parsed;
}
