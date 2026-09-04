import type { CSSResultGroup, TemplateResult } from 'lit';
import type { ColumnDefs, ResolvedColumn } from '../columns/types.js';
import type { DisplayRow } from '../layout/types.js';
import type { GridPipeline } from '../pipeline/grid-pipeline.js';
import type { FocusController } from '../controller/focus-controller.js';
import type { ProjectionStage } from '../projection/types.js';
import type { RowNode } from '../store/types.js';

/**
 * How assistive technology should read the grid.
 *
 * `treegrid` when rows sit inside other rows, which only a module that builds a
 * hierarchy can know. Core cannot infer it without reading a convention it does
 * not own, which is the mistake every other seam here exists to avoid.
 */
export type GridRole = 'grid' | 'treegrid';

/** A module whose rows are hierarchical, and says so. */
export interface GridRoleProvider {
  provideGridRole(): GridRole;
}

export const providesGridRole = <T>(module: T): module is T & GridRoleProvider =>
  typeof (module as Partial<GridRoleProvider>).provideGridRole === 'function';

/**
 * A module through which more than one thing can be selected at a time.
 *
 * `aria-multiselectable` belongs on the grid, but only a module knows whether
 * anything can be multiply selected — rows in multi mode, or a rectangle of
 * cells. Declared rather than inferred, for the same reason the role is.
 */
export interface MultiSelectionProvider {
  provideMultiSelection(): boolean;
}

export const providesMultiSelection = <T>(module: T): module is T & MultiSelectionProvider =>
  typeof (module as Partial<MultiSelectionProvider>).provideMultiSelection === 'function';

/**
 * A module that adds a band of its own beneath the column headings.
 *
 * The height is declared rather than measured because the layout engine needs
 * it before anything is drawn: it decides how many rows fit an instance from
 * the viewport height less the header, so a band that appeared only in the DOM
 * would push the last row of every instance out of view.
 *
 * Returning 0 is how a module that can contribute a band says it is not
 * contributing one now.
 */
export interface HeaderBandProvider<TData = unknown> {
  provideHeaderBandHeight(): number;
  /** The band's content for one column. Null leaves the cell empty. */
  renderHeaderBand(ctx: HeaderSlotContext<TData>): TemplateResult | null;
}

export const providesHeaderBand = <T, TData>(module: T): module is T & HeaderBandProvider<TData> =>
  typeof (module as Partial<HeaderBandProvider<TData>>).provideHeaderBandHeight === 'function';

/** What a module is handed at init. Its whole view of the grid. */
export interface ModuleContext<TData = unknown> {
  readonly pipeline: GridPipeline<TData>;
  /** Registers a projection stage. Removed automatically when the module is destroyed. */
  addStage(stage: ProjectionStage<TData>): void;
  /** Re-runs the projection, and repaints. Call after the module's own config changes. */
  invalidate(): void;
  /**
   * Repaints module-contributed headers, cells and rows without re-running the
   * projection. For presentation-only state such as an open filter popover.
   */
  requestRender(): void;
  /** Focus position and traversal. Core owns the mechanics; modules bind keys to them. */
  readonly focus: FocusController;
  /** Resolved columns, including any contributed by modules. */
  getColumns(): readonly ResolvedColumn<TData>[];
  getModule<T extends GridModule<TData>>(id: string): T | undefined;
  /**
   * Every registered module, for finding the ones that provide a capability
   * rather than the one with a known id.
   *
   * A module declares what it can do; whoever needs that capability looks for
   * it. The alternative — modules reaching into each other to install
   * behaviour — makes the result depend on registration order and leaves no
   * single place to notice two modules claiming the same job.
   */
  getModules(): readonly GridModule<TData>[];
  dispatch(type: string, detail: unknown): void;
  addTeardown(fn: () => void): void;
}

export interface CellContext<TData = unknown> {
  readonly row: DisplayRow;
  readonly node: RowNode<TData> | undefined;
  readonly column: ResolvedColumn<TData>;
  readonly value: unknown;
}

export interface RowContextInfo<TData = unknown> {
  readonly row: DisplayRow;
  readonly node: RowNode<TData> | undefined;
}

export interface HeaderSlotContext<TData = unknown> {
  readonly column: ResolvedColumn<TData>;
}

/**
 * Presentation a module contributes to a cell without owning its DOM.
 *
 * Keeping modules to classes, parts and bracketing content — rather than letting
 * them render the cell — is what allows several modules to decorate the same cell
 * without fighting. The tree module's expander and the selection module's checkbox
 * coexist in one cell precisely because neither replaces it.
 */
export interface CellDecoration {
  readonly classes?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
  /**
   * CSS custom properties set on the cell.
   *
   * The supported way to pass a per-cell *value* — a depth, a ratio — into a
   * module's stylesheet. Keys must start with `--`; anything else is rejected,
   * since this is not a route for arbitrary inline declarations.
   */
  readonly customProperties?: Readonly<Record<string, string>>;
  /** Rendered before the cell's own content. */
  readonly prefix?: TemplateResult;
  /** Rendered after the cell's own content. */
  readonly suffix?: TemplateResult;
  /**
   * Called with the cell element after it has updated.
   *
   * The escape hatch for effects that are not expressible as markup — running a
   * Web Animation, measuring, moving focus. Everything declarative should use the
   * fields above instead; this exists because a value-change flash has to be
   * imperative to retrigger reliably.
   */
  readonly onRendered?: (cell: HTMLElement) => void;
}

export interface RowDecoration {
  readonly classes?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
  /** CSS custom properties set on every cell in the row. Keys must start with `--`. */
  readonly cellCustomProperties?: Readonly<Record<string, string>>;
  /**
   * Classes applied to every cell in the row rather than to the row element.
   *
   * A row is `display: contents` so it has no box of its own to paint — its cells
   * are the grid items. Anything visual therefore has to reach them.
   */
  readonly cellClasses?: readonly string[];
  /** Called when the row is clicked or activated from the keyboard. */
  readonly onActivate?: (event: Event) => void;
}

/**
 * Presentation and activation a module contributes to a column header.
 *
 * `onActivate` exists because a trader expects to click anywhere on a header to
 * sort it, not to hit a small icon. Core binds click, Enter and Space to it
 * without knowing what activation means — sorting is the sort module's idea.
 */
export interface HeaderDecoration {
  readonly classes?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
  /**
   * CSS custom properties set on the header cell.
   *
   * The same contract as `CellDecoration.customProperties`, and here for the
   * same reason: a header often has to line up with the cells beneath it to the
   * pixel — a pinned column's offset, a resize handle's position — and a
   * measurement cannot be spelled as a class.
   */
  readonly customProperties?: Readonly<Record<string, string>>;
  readonly onActivate?: (event: Event) => void;
}

/**
 * An additive feature.
 *
 * The rule that makes modularity real: no core component may import a module.
 * Features reach the DOM only through the hooks below, so core renders a grid with
 * no knowledge of what is installed, and a grid with nothing installed still works.
 */
export interface GridModule<TData = unknown, TState = unknown> {
  readonly id: string;
  /** Ids of modules that must be registered first. */
  readonly dependsOn?: readonly string[];

  init?(ctx: ModuleContext<TData>): void;
  destroy?(): void;

  /**
   * Stylesheets for the DOM this module contributes.
   *
   * A module's markup renders inside a cell's or header's shadow root, where the
   * page's CSS cannot reach it. Declaring styles here gets them adopted into
   * those roots, which is what lets a module contribute an expander or a
   * checkbox without a single inline style — and lets a consumer restyle it
   * through the same custom properties as everything else.
   */
  readonly styles?: CSSResultGroup;

  /**
   * `part` names this module puts on markup it renders.
   *
   * Declared rather than discovered, because the elements that have to forward
   * them across their shadow boundaries render before any module markup exists.
   * A part left undeclared still renders — it simply cannot be reached from
   * page CSS, which is the failure this list exists to prevent.
   */
  readonly parts?: readonly string[];

  /** Columns the module owns, such as selection's checkbox column. */
  provideColumns?(): ColumnDefs<TData>;
  /**
   * Rewrites the resolved columns, after every module has contributed its own.
   *
   * Where `provideColumns` adds a column, this changes the ones already there:
   * their order, their widths, whether they are pinned. It runs on the resolved
   * list rather than the definitions so a module sees the concrete width the
   * layout will use, not an optional one it would have to default itself.
   *
   * Modules run in registration order and each sees the previous one's output,
   * so two modules rewriting the same property is last-wins rather than a
   * conflict. Returning the input unchanged is free — the signal only
   * recomputes when the registry version or the options change.
   */
  transformColumns?(columns: readonly ResolvedColumn<TData>[]): readonly ResolvedColumn<TData>[];
  headerSlot?(ctx: HeaderSlotContext<TData>): TemplateResult | null;
  headerDecorator?(ctx: HeaderSlotContext<TData>): HeaderDecoration | null;
  cellDecorator?(ctx: CellContext<TData>): CellDecoration | null;
  /**
   * Takes over a cell's content, for the one cell being edited.
   *
   * The exception to `cellDecorator`, and deliberately a separate hook rather
   * than a field on `CellDecoration`. Decoration brackets a cell's content so
   * that several modules can contribute to the same cell without fighting —
   * the tree's expander and selection's checkbox coexist precisely because
   * neither replaces anything. Replacement cannot work that way: two modules
   * putting an editor in one cell is not a layout to reconcile, it is a
   * mistake, and the shape of the hook should say so.
   *
   * So at most one module may claim a cell. The first to claim it wins, and
   * core does not arbitrate beyond that — a second module returning markup for
   * a cell someone else has taken is a bug in the pair of them.
   *
   * Returning null for every cell, which is the normal case, costs a call and
   * nothing else.
   */
  cellContent?(ctx: CellContext<TData>): TemplateResult | null;
  rowDecorator?(ctx: RowContextInfo<TData>): RowDecoration | null;
  /**
   * Handles a key pressed inside the grid. Return true when handled, which
   * stops later modules seeing it and prevents the browser default.
   */
  onKeyDown?(event: KeyboardEvent): boolean;
  /** Methods merged onto the GridApi, typed by declaration merging. */
  apiExtension?(): Record<string, unknown>;

  getState?(): TState;
  setState?(state: TState): void;
}
