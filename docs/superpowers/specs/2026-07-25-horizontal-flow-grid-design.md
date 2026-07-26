# Horizontal-Flow Trading Grid — Package Design

> Naming is a placeholder throughout: npm scope `@flowgrid`, element prefix `fg-`. Rename before first publish.

## Context

Trading desks run on wide monitors. Conventional grids waste that width: they scroll rows vertically in a
narrow column, forcing applications to build bespoke multi-pane UX so a trader can watch several
instrument groups at once.

The `experiments/grid` prototype (built earlier this year) proved a different model: rows flow **left to
right**, each grid _instance_ filled to the viewport height, then a new instance starts beside it.
Instances are virtualised by `IntersectionObserver` rather than rows being virtualised by scroll offset.
A trader fills the monitor with one component and no pane management.

The prototype (`packages/grid-lit`) validated the layout but is not a product:

- **Core is not minimal.** `snake-grid-row.ts` imports `ExpansionPlugin` and `SelectionPlugin` directly;
  `snake-grid-instance.ts` imports `SortPlugin` and `FilterPlugin`. Features are not removable.
- **Tree is mandatory.** `SnakeLayoutStore` walks `TreeNodeWithChildren` and owns a `parentRegistry` to
  mirror parent updates into duplicated instances.
- **Column API is thin.** No `valueGetter`, no dot-path fields, no column types, no defaults.
- **Projection is rebuilt wholesale.** `GridStore.getTree()` reconstructs the tree from the Map on every
  notification, and `SnakeLayoutStore.recalculate()` discards and rebuilds every instance — expensive at
  tick rates on 10k rows.
- **Plugin surface is two hooks** (`transform`, `renderHeader`) — too narrow for AG-Grid-like modularity.
- Lit 2.7, no tests in the Lit package, and 543/767-line components.

**Outcome:** a published, open-source web-component grid whose _core is minimal_ and whose features —
including tree data — are additive modules, with the horizontal instance layout as the differentiator.

## Decisions

| Decision         | Choice                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Starting point   | Fresh repo. Prototype is reference only; port proven algorithms, redesign the API.                                                         |
| Data model       | Client-side row store, transactional updates (`applyTransaction`).                                                                         |
| Consumers        | Web components only (Lit/vanilla), published to npm as open source.                                                                        |
| Core boundary    | Ultra-minimal. Tree, sort, filter, selection, keyboard, cell-flash are all modules.                                                        |
| Layouts          | Both flow (horizontal) and stack (vertical) ship in core, behind a `LayoutEngine` interface.                                               |
| Column API       | `valueGetter` + `valueFormatter`; cell renderers are custom elements. Module-specific column properties arrive via TS declaration merging. |
| Tree/layout seam | Sticky-ancestor row projection: `DisplayRow.repeatOnBreak`. Core stays hierarchy-blind.                                                    |
| Reactivity       | `@lit/context` carrying stable controllers; signals inside for cell-granular updates.                                                      |
| Testing          | Vitest (node + browser/Chromium projects) plus Playwright e2e.                                                                             |

---

## Architecture

```
RowStore ──► RowProjector ──► DisplayRow[] ──► LayoutEngine ──► Instance[] ──► DOM
   │              ▲                                                              │
   │      module ProjectionStages                                    InstanceVirtualizer
   │      (filter → sort → expand → decorate)                        (IntersectionObserver)
   │
   └── per-row signals ──────────────────────────────────────────────────► <fg-cell>
       (value ticks bypass projection AND layout entirely)
```

The bottom path is the central performance idea and the main departure from the prototype: a price tick
writes one signal and re-renders the bound cells. It does not rebuild the tree, the projection, or the
instance layout. Only _structural_ change (add/remove, sort key change, expand, filter) re-runs the
pipeline above.

### Single package, module subpaths

One npm package with per-module entry points — AG Grid v33's consolidation, and it avoids version skew:

```
@flowgrid/core            core: store, projection, layout, components, contexts, api
@flowgrid/core/tree       tree data + expansion
@flowgrid/core/sort
@flowgrid/core/filter
@flowgrid/core/selection
@flowgrid/core/keyboard
@flowgrid/core/cell-flash
@flowgrid/core/themes     light + dark CSS
```

`"sideEffects": false` and an `exports` map keep unused modules out of consumer bundles.

### Repository

```
packages/core/src/
  store/        RowStore, transactions, row signals
  projection/   RowProjector, ProjectionStage, memoisation + dependency tracking
  layout/       LayoutEngine, FlowLayoutEngine, StackLayoutEngine, ViewportMetrics
  virtualize/   InstanceVirtualizer
  components/   fg-grid, fg-instance, fg-row, fg-cell, fg-header-cell
  context/      gridContext, instanceContext, rowContext, columnContext
  columns/      ColumnDef, resolveColumns, defaultColDef, columnTypes, value resolution
  modules/      GridModule, ModuleRegistry, ModuleContext
  api/          GridApi, event bus, typed GridEventMap
  reactive/     internal signal facade (isolates @lit-labs/signals)
  modules/{tree,sort,filter,selection,keyboard,cell-flash}/
apps/storybook/       dev harness, visual docs, Playwright targets
bench/                perf harnesses
```

Components stay small and single-purpose — no repeat of the prototype's 543- and 767-line files.

---

## Core

### RowStore

`Map<rowId, RowNode<TData>>`, insertion-ordered. `RowNode = { id, data }` — **no `parentId`, `level`,
`childIds`, or `isExpanded`**; that vocabulary belongs to the tree module.

- `applyTransaction({ add, update, remove })` returns changed ids and whether the change is _structural_.
- Updates produce a new `data` object (identity-based change detection).
- Each row has a signal; `update` writes the signal. Transactions inside a microtask coalesce;
  `flushSync()` is the escape hatch for tests.

### Projection

```ts
interface ProjectionStage {
  readonly id: string;
  readonly phase: 'filter' | 'sort' | 'expand' | 'decorate';
  run(rows: readonly RowNode[], ctx: StageContext): readonly RowNode[] | readonly DisplayRow[];
  /** Fields whose change invalidates this stage. Set | '*' | null */
  readonly dependsOn?: ReadonlySet<string> | '*' | null;
}
```

Phases run in fixed order, so modules never depend on registration order. Filter and sort operate on the
**flat** row list; the tree module's `expand` stage then groups and flattens, preserving sibling order —
which is how sort and filter stay entirely hierarchy-blind while still producing correctly sorted,
correctly filtered trees. (Ancestor retention for filtered descendants is a tree-module option.)

With zero modules the projection is the identity map `RowNode → DisplayRow`.

The `dependsOn` mechanism is carried over from the prototype's `getAffectedDataFields`, but applied at
stage granularity: a price tick invalidates the sort stage only when price is an active sort key.

### DisplayRow — the tree/layout seam

```ts
interface DisplayRow {
  readonly id: string; // unique in projection (DOM key)
  readonly rowId: string; // RowStore id; repeats share it
  readonly height?: number;
  readonly repeatOnBreak?: readonly DisplayRow[]; // re-emitted atop the next instance
  readonly meta: Readonly<Record<string, unknown>>; // depth, isGroup, isRepeat, groupKey …
}
```

Two consequences worth naming:

1. **Core never sees a hierarchy.** The flow engine's whole tree-awareness is
   `emit(row.repeatOnBreak ?? [])` at a break. The same mechanism gives sticky section headers later,
   for free.
2. **The prototype's `parentRegistry` disappears.** Repeated parents share a `rowId`, therefore the same
   row signal — an update to a parent propagates to every instance rendering it, automatically.

### LayoutEngine

```ts
interface LayoutEngine {
  readonly id: string;
  layout(rows: readonly DisplayRow[], viewport: ViewportMetrics): LayoutResult;
}
interface Instance {
  id: string;
  index: number;
  rows: readonly DisplayRow[];
  width: number;
  height: number;
}
```

- **`FlowLayoutEngine`** (default) — ported from `SnakeLayoutStore.distributeNodes`
  (`packages/grid-lit/src/store/snake/SnakeLayoutStore.ts:41`), rewritten against `DisplayRow`:
  fill `floor((viewportHeight - headerHeight) / rowHeight)` rows per instance, emit `repeatOnBreak` on
  each break. Pure function — no store, no subscribers, trivially testable.
- **`StackLayoutEngine`** — one instance, windowed row range from scroll offset. Classic vertical
  virtualisation, replacing the prototype's `default-grid.ts`.

Selected by `layout="flow" | "stack"` on the host.

### Virtualisation

`InstanceVirtualizer` wraps `IntersectionObserver` with a `rootMargin` prefetch of one instance width —
the prototype uses `threshold: 0` with no margin, which shows skeletons during fast horizontal scroll.
Offscreen instances render a correctly-sized placeholder so scroll geometry never shifts.

Scroll-jacking (wheel-Y → scroll-X, `snake-grid.ts:326`) carries over as opt-in core config.

### Components and contexts

| Element            | Responsibility                          | Provides          |
| ------------------ | --------------------------------------- | ----------------- |
| `<fg-grid>`        | host, controller, scroller, virtualizer | `gridContext`     |
| `<fg-instance>`    | header + rows for one instance          | `instanceContext` |
| `<fg-row>`         | one `DisplayRow`, reads its row signal  | `rowContext`      |
| `<fg-cell>`        | value resolution + renderer host        | `columnContext`   |
| `<fg-header-cell>` | header label + module header slots      | `columnContext`   |

Contexts carry **stable controller objects**; reactive values inside them are signals. Nothing re-provides
context on data change, and no component hand-manages subscriptions — the prototype's `snake-grid-row`
maintains three (`nodeUnsubscribe`, `selectionUnsubscribe`, `storeUnsubscribe`) with manual teardown.
`@lit-labs/signals` is labs, so it sits behind `reactive/` and can be swapped without touching components.

### Columns

```ts
interface ColumnDef<TData = unknown, TValue = unknown> {
  colId?: string;
  field?: string; // dot paths supported
  headerName?: string;
  width?: number;
  minWidth?: number;
  flex?: number;
  type?: string | string[]; // columnTypes presets
  valueGetter?: (p: ValueGetterParams<TData>) => TValue;
  valueFormatter?: (p: ValueFormatterParams<TData, TValue>) => string;
  cellRenderer?: string | CellRendererFn; // custom element tag OR function
  cellRendererParams?: Record<string, unknown>;
  cellClass?: string | ((p: CellParams<TData, TValue>) => string);
}
```

Plus `defaultColDef` and `columnTypes` on grid config. Resolution order per cell:
`valueGetter ?? field path` → `valueFormatter` → `cellRenderer`.

Modules add their own column properties by augmentation, so core's `ColumnDef` never grows:

```ts
// @flowgrid/core/sort
declare module '@flowgrid/core' {
  interface ColumnDef<TData, TValue> {
    sortable?: boolean;
    comparator?: (a: TValue, b: TValue, ctx: ComparatorContext<TData>) => number;
    initialSort?: 'asc' | 'desc';
  }
}
```

### Cell renderers as Lit elements

```ts
export abstract class CellRendererElement<TData = unknown, TValue = unknown> extends LitElement {
  @consume({ context: rowContext, subscribe: true }) protected row!: RowController<TData>;
  @consume({ context: columnContext, subscribe: true }) protected column!: ResolvedColumn;
  protected get value(): TValue;
  protected get api(): GridApi<TData>;
}
```

A renderer declares `cellRenderer: 'my-depth-bar'` and pulls what it needs from context — no prop
drilling, and it can hold its own state and lifecycle. Function renderers returning `TemplateResult`
remain supported for trivial cases. `<fg-cell>` instantiates tag-name renderers through a cached
`static-html` template keyed by tag.

### Module contract

```ts
interface GridModule<TState = unknown> {
  readonly id: string;
  readonly dependsOn?: readonly string[];
  init(ctx: ModuleContext): void;
  destroy?(): void;

  projectionStage?: ProjectionStage;
  provideColumns?(): readonly ColumnDef[]; // e.g. selection's checkbox column
  headerSlot?(ctx: HeaderSlotContext): TemplateResult | null;
  cellDecorator?(ctx: CellContext): CellDecoration | null; // classes/parts/attrs/prefix content
  rowDecorator?(ctx: RowContext): RowDecoration | null;
  apiExtension?(): Record<string, unknown>; // merged onto GridApi
  getState?(): TState;
  setState?(s: TState): void;
}
```

Two rules make the modularity real, and both are direct fixes to prototype defects:

- **No core component imports a module.** Tree contributes its expander via `cellDecorator`; selection
  contributes its checkbox column via `provideColumns()` — the app no longer composes
  `createSelectionColumn(plugin)` by hand as the prototype's story does.
- **API extensions are typed by declaration merging**, so `api.expandAll()` exists only when the tree
  module is imported.

### GridApi and events

Core: `applyTransaction`, `getRow`, `getRows`, `setColumnDefs`, `refreshCells`, `scrollToRow`,
`getLayoutInstances`, `updateConfig`, `getState`/`setState` (aggregating module state).
Events are typed CustomEvents on the host with a `GridEventMap` so `addEventListener` infers `detail`.

### Theming

CSS custom properties (`--fg-*`, evolved from the prototype's `--grid-*`) plus `::part()` on grid, instance,
header-cell, row and cell. No colour literals in component styles. `@flowgrid/core/themes` ships light and
dark.

---

## Modules (v1)

1. **tree** — `getDataPath(data)` or a `hierarchy` field; parent index maintained _incrementally_ per
   transaction rather than rebuilt (prototype: `GridStore.buildTreeFromMap` per notification). `expand`
   stage emits visible rows with `meta.depth` and `repeatOnBreak = ancestorChain` — this is what makes
   `layouts.md`'s duplicated-parent behaviour work. Expander via `cellDecorator` on the configured tree
   column. API: `setExpanded`, `expandAll`, `collapseAll`, `isExpanded`.
2. **sort** — multi-column sort model, `comparator`/`sortable` augmentation, header indicator slot,
   `dependsOn` = active sort fields only.
3. **filter** — quick filter plus per-column text/number/set filters, header filter UI slot, filter model
   get/set, `retainAncestors` cooperation with tree.
4. **selection** — `single` | `multi`, optional checkbox column via `provideColumns()`, `rowDecorator` for
   selected styling, `selectAll` scoped to the current projection. Range selection is backlog.
5. **keyboard** — roving tabindex within an instance, arrows/Home/End/PageUp/PageDown, Ctrl+Arrow to jump
   instances, Enter/Space delegated to the focused cell. Rewritten from `GridKeyboardBase.ts` (471 lines)
   against the module contract.
6. **cell-flash** — diffs resolved values per column on row-signal change; WAAPI animation ported from
   `snake-grid-row.animateCell` (`snake-grid-row.ts:171`), extended with directional up/down colours,
   `flashDuration`, and an `enableCellFlash` colDef augmentation.

**Backlog (not v1):** column resize/reorder/pin, cell editing, row grouping/aggregation, clipboard and
CSV export, state persistence, range selection, master/detail, server-side row model, React wrapper
(generated from the custom-elements manifest).

---

## Tooling

pnpm + turbo (as the prototype) · TypeScript 5.9 strict · **Lit 3.x** (upgrade from 2.7) · `@lit/context` 1.x ·
`@lit-labs/signals` behind `reactive/` · Custom Elements Manifest analyzer → published
`custom-elements.json` · Changesets · ESLint + Prettier + codespell · conventional commits.

---

## Milestones

| #   | Deliverable                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0  | Repo scaffold, tooling, CI, Vitest node+browser projects, Storybook harness                                                                                                                            |
| M1  | Core: RowStore + transactions + signals, projection pipeline, `LayoutEngine` + `FlowLayoutEngine`, virtualizer, five components, contexts, columns/value resolution, module registry, GridApi, theming |
| M2  | tree module — the layout differentiator end to end                                                                                                                                                     |
| M3  | sort + filter modules                                                                                                                                                                                  |
| M4  | selection module                                                                                                                                                                                       |
| M5  | keyboard + cell-flash modules                                                                                                                                                                          |
| M6  | `StackLayoutEngine` (vertical mode)                                                                                                                                                                    |
| M7  | Docs site, benchmarks, `0.1.0` release                                                                                                                                                                 |

Each milestone is TDD: pure units (store, projection stages, layout engines) get node tests written first —
a real dividend of the `DisplayRow` seam, since layout is a pure function of rows and viewport metrics.

---

## Verification

**Unit (Vitest, node)**

- `FlowLayoutEngine`: exact break points for N rows × viewport height; `repeatOnBreak` emitted at every
  break and _not_ at instance start; `maxInstances` honoured; zero/one-row and taller-than-viewport cases.
- `RowStore`: transaction results, structural vs value-only classification, microtask coalescing.
- Projection: phase ordering fixed regardless of registration order; `dependsOn` correctly skips
  re-running stages; identity projection with zero modules.
- Each module's stage in isolation against fixture data.

**Component (Vitest browser, Chromium via Playwright provider)**

- Real `IntersectionObserver`: scrolling right mounts instances ahead of the viewport and unmounts
  behind; placeholders preserve `scrollWidth`.
- A price tick re-renders only the bound cells — assert via a render counter on `<fg-cell>` that neither
  projection nor layout ran.
- A parent row updated once repaints in **every** instance that repeats it (the `layouts.md` requirement).
- Import core alone and assert no tree/sort/filter/selection code is reachable and no expander renders.

**E2E (Playwright, Storybook)**

- Bond-market story ported from `SnakeGrid.lit.stories.tsx` (50 groups / 10k instruments): expand-all,
  sort, filter, select, keyboard traversal across instances, scroll-jacking.
- Visual regression on the flow layout at three viewport heights.

**Benchmarks (`bench/`)** — targets to hold, measured in CI:

- initial layout of 10k rows < 100 ms
- sort toggle (projection + layout) < 50 ms
- 20 row updates per frame for 60 s with no dropped frames
- no heap growth after scrolling through 200 instances and back

**Manual** — `pnpm --filter storybook dev`, open the flow story on a wide monitor, start price ticking,
confirm instances fill the width, parents repeat correctly across breaks, and flashes are cell-local.
