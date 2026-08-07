import type {
  DisplayRow,
  LayoutEngine,
  LayoutInstance,
  LayoutResult,
  ViewportMetrics,
} from './types.js';

/**
 * Lays rows out left to right: fill an instance to the viewport height, start a
 * new one beside it, repeat. This is the package's differentiator — a trader uses
 * the full width of a wide monitor without the application building multi-pane UX.
 *
 * The engine knows nothing about hierarchy. When a break splits a block, it
 * re-emits whatever the row hung off `repeatOnBreak`; a tree module puts the
 * ancestor chain there, and grouped instruments stay readable across the break.
 *
 * Pure function of (rows, viewport). No store, no subscriptions, no DOM reads.
 */
export class FlowLayoutEngine implements LayoutEngine {
  readonly id = 'flow';

  layout(rows: readonly DisplayRow[], viewport: ViewportMetrics): LayoutResult {
    const usable = Math.max(viewport.rowHeight, viewport.height - viewport.headerHeight);
    const maxInstances = viewport.maxInstances ?? Number.POSITIVE_INFINITY;

    const instances: LayoutInstance[] = [];
    let current: DisplayRow[] = [];
    let used = 0;
    let truncated = false;
    let consumed = 0;

    const commit = (): boolean => {
      if (current.length === 0) return true;
      if (instances.length >= maxInstances) {
        truncated = true;
        return false;
      }
      const index = instances.length;
      instances.push({
        id: `instance-${index}`,
        index,
        rows: current,
        width: viewport.instanceWidth,
        height: viewport.height,
        offset: index * (viewport.instanceWidth + viewport.instanceGap),
        firstRowIndex: consumed,
      });
      // Repeats are the same row appearing again, so they do not advance the
      // position in the data.
      consumed += current.filter((row) => row.meta?.['isRepeat'] !== true).length;
      return true;
    };

    for (const row of rows) {
      const height = this.rowHeight(row, viewport);

      // Break when the row does not fit, unless the instance is empty — a row
      // taller than the viewport gets an instance of its own rather than looping.
      if (current.length > 0 && used + height > usable) {
        if (!commit()) break;

        const repeats = this.trimRepeats(row.repeatOnBreak ?? [], height, usable, viewport);
        current = repeats.map((ancestor) => this.asRepeat(ancestor, instances.length));
        used = repeats.reduce((sum, r) => sum + this.rowHeight(r, viewport), 0);
      }

      current.push(row);
      used += height;
    }

    if (instances.length < maxInstances) {
      commit();
    } else if (current.length > 0) {
      truncated = true;
    }

    const count = instances.length;
    return {
      instances,
      totalWidth:
        count === 0 ? 0 : count * viewport.instanceWidth + (count - 1) * viewport.instanceGap,
      totalHeight: count === 0 ? 0 : viewport.height,
      truncated,
    };
  }

  private rowHeight(row: DisplayRow, viewport: ViewportMetrics): number {
    return row.height ?? viewport.rowHeight;
  }

  /**
   * Drops ancestors from the front until the chain plus the row that triggered the
   * break fits. Trimming from the front keeps the nearest ancestors, which carry
   * the most context for the rows immediately below them.
   */
  private trimRepeats(
    repeats: readonly DisplayRow[],
    rowHeight: number,
    usable: number,
    viewport: ViewportMetrics,
  ): readonly DisplayRow[] {
    let start = 0;
    let total = repeats.reduce((sum, r) => sum + this.rowHeight(r, viewport), 0);

    while (start < repeats.length && total + rowHeight > usable) {
      total -= this.rowHeight(repeats[start]!, viewport);
      start += 1;
    }

    return start === 0 ? repeats : repeats.slice(start);
  }

  /**
   * A repeat needs a distinct DOM key but must keep its `rowId`, so both copies
   * read the same row signal and one update repaints every instance showing it.
   */
  private asRepeat(row: DisplayRow, instanceIndex: number): DisplayRow {
    return {
      ...row,
      id: `${row.id}@${instanceIndex}`,
      meta: { ...row.meta, isRepeat: true },
    };
  }
}
