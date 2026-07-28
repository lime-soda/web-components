import type { CSSResultGroup, TemplateResult } from 'lit';
import type { ColumnDefs, ResolvedColumn } from '../columns/types.js';
import type { DisplayRow } from '../layout/types.js';
import type { GridPipeline } from '../pipeline/grid-pipeline.js';
import type { FocusController } from '../controller/focus-controller.js';
import type { ProjectionStage } from '../projection/types.js';
import type { RowNode } from '../store/types.js';

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

  /** Columns the module owns, such as selection's checkbox column. */
  provideColumns?(): ColumnDefs<TData>;
  headerSlot?(ctx: HeaderSlotContext<TData>): TemplateResult | null;
  headerDecorator?(ctx: HeaderSlotContext<TData>): HeaderDecoration | null;
  cellDecorator?(ctx: CellContext<TData>): CellDecoration | null;
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
