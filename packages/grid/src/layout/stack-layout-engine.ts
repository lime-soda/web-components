import type {
  DisplayRow,
  LayoutEngine,
  LayoutInstance,
  LayoutResult,
  ViewportMetrics,
} from './types.js';

const DEFAULT_OVERSCAN = 4;

/**
 * Conventional vertical layout: one instance, scrolled down, with only the rows
 * near the viewport realised.
 *
 * Shipped for the cases a desk still wants a classic table — a blotter, a dialog —
 * without reaching for a second grid library. `offset` is the pixel position of the
 * first rendered row, so the host renders a spacer of that height above the window
 * and the scrollbar stays honest.
 */
export class StackLayoutEngine implements LayoutEngine {
  readonly id = 'stack';

  layout(rows: readonly DisplayRow[], viewport: ViewportMetrics): LayoutResult {
    const usable = Math.max(viewport.rowHeight, viewport.height - viewport.headerHeight);
    const scrollOffset = Math.max(0, viewport.scrollOffset ?? 0);
    const overscan = viewport.overscan ?? DEFAULT_OVERSCAN;

    const offsets: number[] = [];
    let contentHeight = 0;
    for (const row of rows) {
      offsets.push(contentHeight);
      contentHeight += row.height ?? viewport.rowHeight;
    }

    // The row at the scroll position, before overscan pulls the window earlier.
    // Its ancestors are what should stay pinned.
    const topVisible = this.indexAt(offsets, scrollOffset);
    const first = this.withOverscan(topVisible, -overscan, rows.length);
    const lastVisible = this.indexAt(offsets, scrollOffset + usable);
    const last = this.withOverscan(lastVisible + 1, overscan, rows.length);

    const windowed = rows.slice(first, last);
    const instances: readonly LayoutInstance[] =
      windowed.length === 0
        ? []
        : [
            {
              id: 'instance-0',
              index: 0,
              rows: windowed,
              width: viewport.instanceWidth,
              height: contentHeight,
              offset: offsets[first] ?? 0,
              // The window's start is where these rows sit in the data.
              firstRowIndex: first,
            },
          ];

    // The chain applying at the top of the viewport.
    //
    // A heading is not in its own ancestor chain, so a heading arriving at the
    // top would pin nothing — and the band would blink out for exactly one row's
    // worth of scroll on every group boundary. Falling through to the next row
    // covers that: its chain ends in the heading that just arrived, so the band
    // switches from one group to the next with no gap between them.
    const stickyRows = rows[topVisible]?.repeatOnBreak ?? rows[topVisible + 1]?.repeatOnBreak ?? [];

    return {
      instances,
      totalWidth: rows.length === 0 ? 0 : viewport.instanceWidth,
      totalHeight: rows.length === 0 ? 0 : contentHeight + viewport.headerHeight,
      truncated: false,
      stickyRows,
    };
  }

  /** Index of the row occupying a pixel offset. Binary search: offsets ascend. */
  private indexAt(offsets: readonly number[], target: number): number {
    let low = 0;
    let high = offsets.length - 1;
    let found = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if ((offsets[mid] ?? 0) <= target) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return found;
  }

  private withOverscan(index: number, delta: number, length: number): number {
    return Math.min(length, Math.max(0, index + delta));
  }
}
