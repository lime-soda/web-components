import { css, html } from 'lit';
import type { DisplayRow } from '../../layout/types.js';
import type { ProjectionStage } from '../../projection/types.js';
import type { CellContext, CellDecoration, GridModule, ModuleContext } from '../types.js';
import { TreeIndex, type TreeIndexOptions } from './tree-index.js';

export interface TreeModuleOptions<TData = unknown> extends TreeIndexOptions<TData> {
  /** colId of the column carrying the expander. Defaults to the first column. */
  treeColumn?: string;
  defaultExpanded?: boolean | ((data: TData) => boolean);
  /**
   * Keep ancestors of surviving rows even when a filter dropped them, so a match
   * deep in the tree stays reachable. On by default.
   */
  retainAncestors?: boolean;
  /** Indent per depth level, in px. Defaults to 16 via --flow-tree-indent. */
  indentSize?: number;
}

/**
 * Hierarchical data: grouping, expansion, and the sticky ancestors that let the
 * horizontal layout split a group across instances without losing its heading.
 *
 * Everything hierarchy-shaped lives here. Core has no notion of a parent, a depth
 * or an expanded state; this module flattens its tree into ordered display rows
 * and hangs each row's ancestor chain off `repeatOnBreak`, which is the only thing
 * the layout engine needs in order to reproduce the behaviour in layouts.md.
 */
export class TreeModule<TData = unknown> implements GridModule<TData, string[]> {
  readonly id = 'tree';

  private context?: ModuleContext<TData>;
  private index?: TreeIndex<TData>;
  private readonly expanded = new Set<string>();
  private readonly seeded = new Set<string>();

  constructor(private options: TreeModuleOptions<TData>) {}

  /**
   * Replaces some or all of this module's options.
   *
   * Options given to the constructor are otherwise fixed for the life of the
   * grid: the grid's own options are reactive, but a module's are not reachable
   * through them, and reassigning `modules` does not re-register anything. This
   * is how a preference toggle reaches a module without rebuilding the grid.
   */
  setOptions(next: Partial<TreeModuleOptions<TData>>): void {
    this.options = { ...this.options, ...next };
    this.context?.invalidate();
  }

  init(context: ModuleContext<TData>): void {
    this.context = context;
    const store = context.pipeline.store;
    this.index = new TreeIndex(store, this.options);
    this.seedExpansion();
    context.addStage(this.createStage());
  }

  private createStage(): ProjectionStage<TData> {
    return {
      id: 'tree',
      phase: 'expand',
      run: (rows) => this.flatten(rows),
    };
  }

  // -- Public API, exposed on GridApi via apiExtension ------------------------

  isExpanded(id: string): boolean {
    return this.expanded.has(id);
  }

  setExpanded(id: string, expanded: boolean): void {
    if (this.expanded.has(id) === expanded) return;
    if (expanded) this.expanded.add(id);
    else this.expanded.delete(id);
    this.onExpansionChanged([id]);
  }

  toggleExpanded(id: string): void {
    this.setExpanded(id, !this.expanded.has(id));
  }

  expandAll(): void {
    const ids = this.index?.allIds() ?? [];
    for (const id of ids) {
      if (this.index?.hasChildren(id)) this.expanded.add(id);
    }
    this.onExpansionChanged(ids);
  }

  collapseAll(): void {
    const ids = [...this.expanded];
    this.expanded.clear();
    this.onExpansionChanged(ids);
  }

  /** Ancestor ids from root down to the row's parent. */
  getPath(id: string): readonly string[] {
    return this.index?.ancestorsOf(id) ?? [];
  }

  getState(): string[] {
    return [...this.expanded];
  }

  setState(state: string[]): void {
    this.expanded.clear();
    for (const id of state) this.expanded.add(id);
    this.onExpansionChanged(state);
  }

  apiExtension(): Record<string, unknown> {
    return {
      isExpanded: (id: string) => this.isExpanded(id),
      setExpanded: (id: string, expanded: boolean) => this.setExpanded(id, expanded),
      toggleExpanded: (id: string) => this.toggleExpanded(id),
      expandAll: () => this.expandAll(),
      collapseAll: () => this.collapseAll(),
      getPath: (id: string) => this.getPath(id),
    };
  }

  // -- Rendering --------------------------------------------------------------

  /**
   * The column carrying the expander and indentation.
   *
   * Defaults to the first column the *application* declared, skipping any a
   * module contributed. Taking `columns[0]` blindly put the expander in the
   * selection module's 36px checkbox column, where the indent and spacer pushed
   * the checkbox out of the cell entirely.
   */
  private treeColumnId(): string | undefined {
    if (this.options.treeColumn !== undefined) return this.options.treeColumn;

    const columns = this.context?.getColumns() ?? [];
    return (columns.find((column) => column.providedBy === undefined) ?? columns[0])?.colId;
  }

  /**
   * Styles for the expander and indent.
   *
   * Indent depth is the one genuinely per-cell value here, so it travels as a
   * custom property on the element and the width is computed in CSS. Everything
   * else is static and lives in this stylesheet, themeable through the same
   * `--flow-*` properties as the rest of the grid.
   */
  static readonly styles = css`
    .flow-tree-indent {
      display: inline-block;
      flex: 0 0 auto;
      /* Set per cell by the decoration; falls back to no indent. */
      width: calc(var(--flow-tree-depth, 0) * var(--flow-tree-indent, 16px));
    }

    .flow-tree-spacer {
      display: inline-block;
      flex: 0 0 auto;
      width: var(--flow-tree-expander-size, 18px);
    }

    .flow-expander {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: var(--flow-tree-expander-size, 18px);
      padding: 0;
      background: none;
      border: none;
      cursor: pointer;
      font-size: var(--flow-tree-expander-font-size, 10px);
      line-height: 1;
      color: var(--flow-text-muted, #666);
      transition: transform 150ms ease-out;
      transform: rotate(0deg);
    }

    .flow-expander[aria-expanded='true'] {
      transform: rotate(90deg);
    }

    @media (prefers-reduced-motion: reduce) {
      .flow-expander {
        transition: none;
      }
    }
  `;

  readonly styles = TreeModule.styles;

  cellDecorator(ctx: CellContext<TData>): CellDecoration | null {
    if (ctx.column.colId !== this.treeColumnId()) return null;

    const depth = (ctx.row.meta?.['depth'] as number | undefined) ?? 0;
    const hasChildren = (ctx.row.meta?.['hasChildren'] as boolean | undefined) ?? false;
    const isExpanded = this.expanded.has(ctx.row.rowId);

    return {
      classes: ['flow-tree-cell'],
      attributes: { 'data-flow-depth': String(depth) },
      // Depth drives the indent width through CSS rather than a computed pixel
      // value, so a consumer can change --flow-tree-indent and every level follows.
      customProperties: {
        '--flow-tree-depth': String(depth),
        ...(this.options.indentSize === undefined
          ? {}
          : { '--flow-tree-indent': `${this.options.indentSize}px` }),
      },
      prefix: html`
        <span class="flow-tree-indent"></span>
        ${
          hasChildren
            ? html`<button
                part="tree-expander"
                class="flow-expander"
                aria-label=${isExpanded ? 'Collapse' : 'Expand'}
                aria-expanded=${isExpanded}
                tabindex="-1"
                @click=${(event: Event) => {
                  event.stopPropagation();
                  this.toggleExpanded(ctx.row.rowId);
                }}
              >
                ▶
              </button>`
            : html`<span class="flow-tree-spacer"></span>`
        }
      `,
    };
  }

  // -- Flattening -------------------------------------------------------------

  /**
   * Turns the incoming flat, already-filtered and already-sorted list into tree
   * order.
   *
   * Sibling order is taken from the incoming list, which is precisely how the sort
   * module stays hierarchy-blind: it sorts a flat list, and the order it produced
   * survives here.
   */
  private flatten(rows: readonly DisplayRow[]): readonly DisplayRow[] {
    const index = this.index;
    if (!index) return rows;

    // Rows that arrived since the last projection need indexing, and any of them
    // matching defaultExpanded need seeding, before the first paint that shows
    // them — not a microtask later.
    if (index.ensureFresh()) this.seedExpansion();

    const byId = new Map<string, DisplayRow>();
    for (const row of rows) byId.set(row.rowId, row);

    // Ancestors a filter removed are added back so a deep match stays reachable.
    // Tracked separately rather than diffed against `rows`, which would be
    // quadratic on a large filtered set.
    const restored: DisplayRow[] = [];
    if (this.options.retainAncestors ?? true) {
      for (const row of rows) {
        for (const ancestorId of index.ancestorsOf(row.rowId)) {
          if (byId.has(ancestorId)) continue;
          const ancestor: DisplayRow = {
            id: ancestorId,
            rowId: ancestorId,
            meta: { isAncestorOnly: true },
          };
          byId.set(ancestorId, ancestor);
          restored.push(ancestor);
        }
      }
    }

    // Group by parent, preserving the order rows arrived in.
    const childrenOf = new Map<string | null, DisplayRow[]>();
    const parentInGraph = new Map<string, string | null>();
    for (const row of [...rows, ...restored]) {
      const declaredParent = index.parentOf(row.rowId);
      const parent = declaredParent !== null && byId.has(declaredParent) ? declaredParent : null;
      parentInGraph.set(row.rowId, parent);
      const bucket = childrenOf.get(parent);
      if (bucket) bucket.push(row);
      else childrenOf.set(parent, [row]);
    }

    /** Whether walking up from a row terminates at the root rather than in a cycle. */
    const isRooted = (id: string): boolean => {
      const guard = new Set<string>([id]);
      let current = parentInGraph.get(id) ?? null;
      while (current !== null) {
        if (guard.has(current)) return false;
        guard.add(current);
        current = parentInGraph.get(current) ?? null;
      }
      return true;
    };

    const out: DisplayRow[] = [];
    const seen = new Set<string>();

    const walk = (parentId: string | null, chain: readonly DisplayRow[]): void => {
      for (const row of childrenOf.get(parentId) ?? []) {
        if (seen.has(row.rowId)) continue;
        seen.add(row.rowId);

        const children = childrenOf.get(row.rowId) ?? [];
        const emitted: DisplayRow = {
          ...row,
          meta: {
            ...row.meta,
            depth: chain.length,
            hasChildren: children.length > 0,
            isExpanded: this.expanded.has(row.rowId),
          },
          ...(chain.length > 0 ? { repeatOnBreak: chain } : {}),
        };
        out.push(emitted);

        if (children.length > 0 && this.expanded.has(row.rowId)) {
          walk(row.rowId, [...chain, emitted]);
        }
      }
    };

    walk(null, []);

    // Rows unreachable from any root — which happens when parent references form
    // a cycle — are surfaced at root level. Bad hierarchy data should degrade to a
    // flat list, never to rows silently missing from a trader's blotter.
    //
    // Rows merely hidden by a collapsed ancestor are rooted, so they are correctly
    // left out here rather than reappearing.
    for (const row of [...rows, ...restored]) {
      if (seen.has(row.rowId) || isRooted(row.rowId)) continue;
      seen.add(row.rowId);
      out.push({
        ...row,
        meta: { ...row.meta, depth: 0, hasChildren: false, isExpanded: false, isOrphaned: true },
      });
    }

    return out;
  }

  private seedExpansion(): void {
    const defaultExpanded = this.options.defaultExpanded;
    if (defaultExpanded === undefined || defaultExpanded === false) return;

    const store = this.context?.pipeline.store;
    if (!store) return;

    for (const node of store.rows.get()) {
      // Seeded once per row so a user's later collapse is not undone by the next
      // structural change.
      if (this.seeded.has(node.id)) continue;
      this.seeded.add(node.id);

      const shouldExpand =
        typeof defaultExpanded === 'function' ? defaultExpanded(node.data) : defaultExpanded;
      if (shouldExpand) this.expanded.add(node.id);
    }
  }

  private onExpansionChanged(ids: readonly string[]): void {
    this.context?.invalidate();
    this.context?.dispatch('flow-expansion-changed', {
      ids,
      expanded: [...this.expanded],
    });
  }
}
