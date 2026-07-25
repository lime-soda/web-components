import type { TemplateResult } from 'lit';
import type { ColumnDef, ResolvedColumn } from '../columns/types.js';
import type { DisplayRow } from '../layout/types.js';
import type { GridPipeline } from '../pipeline/grid-pipeline.js';
import type { ProjectionStage } from '../projection/types.js';
import type { RowNode } from '../store/types.js';

/** What a module is handed at init. Its whole view of the grid. */
export interface ModuleContext<TData = unknown> {
  readonly pipeline: GridPipeline<TData>;
  /** Registers a projection stage. Removed automatically when the module is destroyed. */
  addStage(stage: ProjectionStage<TData>): void;
  /** Re-runs the projection. Call after the module's own config changes. */
  invalidate(): void;
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
  /** Rendered before the cell's own content. */
  readonly prefix?: TemplateResult;
  /** Rendered after the cell's own content. */
  readonly suffix?: TemplateResult;
}

export interface RowDecoration {
  readonly classes?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
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

  /** Columns the module owns, such as selection's checkbox column. */
  provideColumns?(): readonly ColumnDef<TData>[];
  headerSlot?(ctx: HeaderSlotContext<TData>): TemplateResult | null;
  cellDecorator?(ctx: CellContext<TData>): CellDecoration | null;
  rowDecorator?(ctx: RowContextInfo<TData>): RowDecoration | null;
  /** Methods merged onto the GridApi, typed by declaration merging. */
  apiExtension?(): Record<string, unknown>;

  getState?(): TState;
  setState?(state: TState): void;
}
