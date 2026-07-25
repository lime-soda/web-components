/**
 * A row as it appears in the rendered output.
 *
 * This is the seam that keeps core hierarchy-blind. A tree module flattens its
 * hierarchy into a list of these and hangs the ancestor chain off
 * `repeatOnBreak`; the layout engine's entire tree-awareness is then re-emitting
 * that array when an instance boundary falls mid-block.
 */
export interface DisplayRow {
  /** Unique within one projection. Used as the DOM key. */
  readonly id: string;
  /**
   * The underlying {@link RowNode} id. Repeated rows (the same parent shown atop
   * several instances) share this, so they share a row signal and a single update
   * repaints every copy.
   */
  readonly rowId: string;
  /** Overrides {@link ViewportMetrics.rowHeight} for this row. */
  readonly height?: number;
  /** Rows to re-emit at the top of the next instance when a break splits this block. */
  readonly repeatOnBreak?: readonly DisplayRow[];
  /** Module-owned annotations: depth, isGroup, isRepeat, groupKey, … */
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface ViewportMetrics {
  /** Scroll container width in px. */
  readonly width: number;
  /** Scroll container height in px. */
  readonly height: number;
  /** Default row height in px, used when a row does not specify its own. */
  readonly rowHeight: number;
  /** Header height in px, subtracted from the usable height of every instance. */
  readonly headerHeight: number;
  /** Width of a single instance in px (sum of column widths). */
  readonly instanceWidth: number;
  /** Gap between instances in px. */
  readonly instanceGap: number;
  /** Hard cap on instances produced. Rows beyond it are not laid out. */
  readonly maxInstances?: number;
  /**
   * Current scroll position along the engine's scroll axis, in px.
   *
   * The flow engine ignores this — it virtualises whole instances through an
   * IntersectionObserver, so it never needs to know where the scroller is. The
   * stack engine windows rows and does.
   */
  readonly scrollOffset?: number;
  /** Rows to render beyond each edge of the window. Stack layout only. */
  readonly overscan?: number;
}

export interface LayoutInstance {
  readonly id: string;
  readonly index: number;
  readonly rows: readonly DisplayRow[];
  readonly width: number;
  readonly height: number;
  /** Offset along the scroll axis in px. */
  readonly offset: number;
}

export interface LayoutResult {
  readonly instances: readonly LayoutInstance[];
  readonly totalWidth: number;
  readonly totalHeight: number;
  /** True when {@link ViewportMetrics.maxInstances} stopped layout early. */
  readonly truncated: boolean;
}

/**
 * Maps display rows onto positioned instances.
 *
 * Implementations must be pure functions of their arguments: no store access, no
 * subscriptions, no DOM reads. That is what makes layout exhaustively testable in
 * node, and it is the main structural difference from the prototype's
 * `SnakeLayoutStore`, which was a stateful, subscribing store.
 */
export interface LayoutEngine {
  readonly id: string;
  layout(rows: readonly DisplayRow[], viewport: ViewportMetrics): LayoutResult;
}
