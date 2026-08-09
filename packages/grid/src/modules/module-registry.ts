import { spannedColumns } from '../columns/col-span.js';
import { type CSSResultGroup, type CSSResultOrNative, unsafeCSS } from 'lit';
import type { ColumnDefs, ResolvedColumn } from '../columns/types.js';
import type { GridPipeline } from '../pipeline/grid-pipeline.js';
import { FocusController } from '../controller/focus-controller.js';
import { Version } from '../reactive/index.js';
import type {
  CellContext,
  CellDecoration,
  GridModule,
  HeaderDecoration,
  HeaderSlotContext,
  ModuleContext,
  RowContextInfo,
  RowDecoration,
} from './types.js';
import { providesGridRole } from './types.js';
import type { GridRole } from './types.js';

export interface ModuleRegistryOptions<TData> {
  pipeline: GridPipeline<TData>;
  getColumns: () => readonly ResolvedColumn<TData>[];
  dispatch: (type: string, detail: unknown) => void;
}

/**
 * Holds the installed modules and fans grid work out to them.
 *
 * Core components talk to this, never to a module directly — which is the
 * structural fix for the prototype, where a row component imported ExpansionPlugin
 * and SelectionPlugin by name and so could not be shipped without them.
 */
export class ModuleRegistry<TData = unknown> {
  private readonly modules = new Map<string, GridModule<TData>>();
  private readonly teardowns = new Map<string, (() => void)[]>();
  private order: string[] = [];
  private started = false;

  /**
   * Bumped whenever module state changes.
   *
   * Module state lives in plain fields, not signals, so nothing would otherwise
   * tell a header or cell that a decoration it already rendered is now stale — a
   * sort indicator would stay blank until some unrelated change forced a repaint.
   * Components read this during render, which subscribes them to every module at
   * once.
   */
  readonly version = new Version();

  /**
   * Focus lives here so that it exists before any module is initialised — a
   * module receives it during init, which happens while the grid controller is
   * still being constructed.
   */
  readonly focus: FocusController;

  constructor(private readonly options: ModuleRegistryOptions<TData>) {
    this.focus = new FocusController(
      () => options.pipeline.layout.get(),
      () => options.getColumns(),
      // Focus has to agree with what the row rendered. Spans are resolved from
      // the same function the row uses, so the two cannot drift into disagreeing
      // about which cells exist.
      (row) =>
        spannedColumns(options.getColumns(), row, options.pipeline.store.getRowNode(row.rowId)).map(
          ({ column, span }) => ({ colId: column.colId, span }),
        ),
    );
  }

  /** Repaints module-contributed content without re-running the projection. */
  requestRender(): void {
    this.version.bump();
  }

  register(module: GridModule<TData>): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module "${module.id}" is already registered.`);
    }
    this.modules.set(module.id, module);
    this.cachedModuleParts = undefined;

    // Registering after start is legitimate — a desk may enable a feature at
    // runtime — so the module is initialised immediately rather than waiting.
    if (this.started) {
      this.assertDependenciesPresent(module);
      this.order.push(module.id);
      this.initModule(module);
    }
  }

  get<T extends GridModule<TData>>(id: string): T | undefined {
    return this.modules.get(id) as T | undefined;
  }

  start(): void {
    if (this.started) return;
    for (const module of this.modules.values()) this.assertDependenciesPresent(module);
    this.order = this.topologicalOrder();
    this.started = true;
    for (const id of this.order) this.initModule(this.modules.get(id)!);
  }

  destroy(): void {
    for (const id of [...this.order].reverse()) {
      for (const teardown of this.teardowns.get(id) ?? []) teardown();
      this.teardowns.delete(id);
      this.modules.get(id)?.destroy?.();
    }
    this.modules.clear();
    this.order = [];
    this.cachedModuleParts = undefined;
    this.started = false;
  }

  provideColumns(): ColumnDefs<TData> {
    return this.orderedModules().flatMap((module) =>
      (module.provideColumns?.() ?? []).map((column) => ({ ...column, providedBy: module.id })),
    );
  }

  cellDecorations(ctx: CellContext<TData>): readonly CellDecoration[] {
    return this.collect((module) => module.cellDecorator?.(ctx));
  }

  rowDecorations(ctx: RowContextInfo<TData>): readonly RowDecoration[] {
    return this.collect((module) => module.rowDecorator?.(ctx));
  }

  headerSlots(ctx: HeaderSlotContext<TData>): readonly unknown[] {
    return this.collect((module) => module.headerSlot?.(ctx));
  }

  headerDecorations(ctx: HeaderSlotContext<TData>): readonly HeaderDecoration[] {
    return this.collect((module) => module.headerDecorator?.(ctx));
  }

  /**
   * Every installed module's stylesheets, flattened.
   *
   * Components adopt these into their shadow roots so module-contributed markup
   * is styled by CSS rather than inline declarations.
   */
  /**
   * Every `part` name modules contribute, for the elements that forward them.
   *
   * Cached, and deliberately identity-stable: this is read once per row, per
   * cell and per header cell on every render, and the elements that consume it
   * memoise on the array they were handed. A fresh array each call would defeat
   * that and leave the string being rebuilt for every cell on every tick.
   */
  moduleParts(): readonly string[] {
    this.cachedModuleParts ??= this.orderedModules().flatMap((module) => module.parts ?? []);
    return this.cachedModuleParts;
  }

  private cachedModuleParts: readonly string[] | undefined;

  moduleStyles(): readonly CSSResultOrNative[] {
    return this.orderedModules().flatMap((module) =>
      module.styles === undefined ? [] : flattenStyles(module.styles),
    );
  }

  /** Offers a key to each module in order. Stops at the first that handles it. */
  handleKeyDown(event: KeyboardEvent): boolean {
    for (const module of this.orderedModules()) {
      if (module.onKeyDown?.(event) === true) return true;
    }
    return false;
  }

  apiExtensions(): Record<string, unknown> {
    return Object.assign({}, ...this.each((module) => module.apiExtension?.() ?? {}));
  }

  /**
   * How the grid should be announced.
   *
   * `grid` unless a module says its rows are hierarchical. Two modules
   * disagreeing is a registration error rather than a coin toss, for the same
   * reason two membership providers are.
   */
  gridRole(): GridRole {
    const providers = this.orderedModules().filter(providesGridRole);
    if (providers.length > 1) {
      const names = providers.map((provider) => `"${provider.id}"`).join(' and ');
      throw new Error(`Modules ${names} both declare a grid role.`);
    }
    return providers[0]?.provideGridRole() ?? 'grid';
  }

  getState(): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (const module of this.orderedModules()) {
      if (module.getState) state[module.id] = module.getState();
    }
    return state;
  }

  setState(state: Record<string, unknown>): void {
    for (const module of this.orderedModules()) {
      const value = state[module.id];
      if (module.setState && value !== undefined) module.setState(value);
    }
  }

  private initModule(module: GridModule<TData>): void {
    const teardowns: (() => void)[] = [];
    this.teardowns.set(module.id, teardowns);

    const context: ModuleContext<TData> = {
      pipeline: this.options.pipeline,
      focus: this.focus,
      addStage: (stage) => void teardowns.push(this.options.pipeline.addStage(stage)),
      invalidate: () => {
        this.options.pipeline.projector.invalidate();
        this.requestRender();
      },
      requestRender: () => this.requestRender(),
      getColumns: () => this.options.getColumns(),
      getModule: (id) => this.get(id),
      getModules: () => [...this.modules.values()],
      dispatch: (type, detail) => this.options.dispatch(type, detail),
      addTeardown: (fn) => void teardowns.push(fn),
    };

    module.init?.(context);
  }

  private assertDependenciesPresent(module: GridModule<TData>): void {
    for (const dependency of module.dependsOn ?? []) {
      if (this.modules.has(dependency)) continue;
      throw new Error(
        `Module "${module.id}" requires module "${dependency}", which is not registered.`,
      );
    }
  }

  /** Depth-first topological sort, so a module is always initialised after its dependencies. */
  private topologicalOrder(): string[] {
    const sorted: string[] = [];
    const settled = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string, trail: readonly string[]): void => {
      if (settled.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Module dependency cycle: ${[...trail, id].join(' -> ')}`);
      }
      visiting.add(id);
      for (const dependency of this.modules.get(id)?.dependsOn ?? []) {
        visit(dependency, [...trail, id]);
      }
      visiting.delete(id);
      settled.add(id);
      sorted.push(id);
    };

    for (const id of this.modules.keys()) visit(id, []);
    return sorted;
  }

  private orderedModules(): readonly GridModule<TData>[] {
    const ids = this.order.length > 0 ? this.order : [...this.modules.keys()];
    return ids
      .map((id) => this.modules.get(id))
      .filter((m): m is GridModule<TData> => m !== undefined);
  }

  private each<T>(fn: (module: GridModule<TData>) => T): T[] {
    return this.orderedModules().map(fn);
  }

  private collect<T>(fn: (module: GridModule<TData>) => T | null | undefined): T[] {
    const results: T[] = [];
    for (const module of this.orderedModules()) {
      const result = fn(module);
      if (result !== null && result !== undefined) results.push(result);
    }
    return results;
  }
}

/** Lit's CSSResultGroup is arbitrarily nested; adoptedStyleSheets wants a flat list. */
function flattenStyles(styles: CSSResultGroup): CSSResultOrNative[] {
  if (Array.isArray(styles)) return styles.flatMap(flattenStyles);
  if (typeof styles === 'string') return [unsafeCSS(styles)];
  return [styles as CSSResultOrNative];
}
