# @flowgrid/core

A data grid web component that lays rows out **horizontally**.

Conventional grids scroll rows vertically in a narrow column, so an application
that wants a trader watching several instrument groups at once has to build
multi-pane UX to do it. This one fills an instance to the viewport height, then
starts another beside it. One component fills a wide monitor, and there are no
panes to manage.

Instances are virtualised with an `IntersectionObserver` rather than rows being
virtualised by scroll offset — a fixed-size block either intersects the viewport
or it doesn't, so there is no scroll arithmetic to get wrong.

```
┌─ Instance 0 ──────────┐ ┌─ Instance 1 ──────────┐ ┌─ Instance 2 ──────────┐
│ Instrument   Bid   Px │ │ Instrument   Bid   Px │ │ Instrument   Bid   Px │
├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤
│ ▾ UK Gilts            │ │ ▾ UK Gilts       ← rep│ │ ▾ German Bunds        │
│   UKT 4% 2030   7k 101│ │   UKT 1% 2041   3k  98│ │   DBR 2% 2032   5k 100│
│   UKT 0% 2031   5k 103│ │   UKT 3% 2050   9k 104│ │   DBR 0% 2035   2k  99│
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
                   scroll →
```

A group that does not fit reappears as a heading atop the continuation, so the
far-right instance still says what you are looking at.

## Install

```sh
npm install @flowgrid/core
```

## Quick start

```ts
import '@flowgrid/core';
import '@flowgrid/core/themes/flowgrid.css';
import type { ColumnDef, FgGrid, GridOptions } from '@flowgrid/core';

interface Quote {
  id: string;
  instrument: string;
  price: number;
}

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', headerName: 'Instrument', width: 240 },
  { field: 'price', width: 100, valueFormatter: ({ value }) => value!.toFixed(3) },
];

const grid = document.querySelector<FgGrid<Quote>>('fg-grid')!;
grid.gridOptions = { columns } satisfies GridOptions<Quote>;
grid.rowData = quotes;

// Later, from a market data feed:
grid.api.applyTransaction({ update: [{ id: 'UKT30', instrument: 'UKT 4% 2030', price: 101.25 }] });
```

```html
<fg-grid style="height: 100%"></fg-grid>
```

That is the whole of core: columns, rows, and a layout. No sorting, no
filtering, no hierarchy — those are modules, and a grid that imports none of
them ships none of their code.

## Why ticks are cheap

The read path is rows → projection → layout, each step a memoised signal:

```
RowStore ──► RowProjector ──► DisplayRow[] ──► LayoutEngine ──► Instance[] ──► DOM
   │              ▲                                                            │
   │      module projection stages                                 InstanceVirtualizer
   └── per-row signals ─────────────────────────────────────────────────► <fg-cell>
```

A price tick writes one row signal. The bound cells re-render; the projection and
the layout are not invalidated, so neither recomputes. Only _structural_ change —
a row added or removed, a sort key changed, a group expanded, a filter applied —
re-runs the pipeline.

The package's tests assert this directly rather than describing it: after a tick,
`api.getLayout()` returns the **same object** it returned before.

Measured in Chromium, 5,000 rows with six modules installed, 20 updates per
frame: median frame 16.7 ms, zero dropped frames, 6 of 194 instances mounted.

## Modules

Every feature beyond the core is an additive module with its own entry point.

| Import                      | Adds                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `@flowgrid/core/tree`       | Hierarchy, expand/collapse, and the repeated group headings |
| `@flowgrid/core/sort`       | Multi-column sort, comparators, header indicators           |
| `@flowgrid/core/filter`     | Quick filter and per-column filters                         |
| `@flowgrid/core/selection`  | Row and group selection, checkbox column                    |
| `@flowgrid/core/cell-flash` | Directional flash on value change                           |
| `@flowgrid/core/keyboard`   | Keyboard navigation and roving tabindex                     |

```ts
import { TreeModule } from '@flowgrid/core/tree';
import { SelectionModule } from '@flowgrid/core/selection';

grid.gridOptions = {
  columns,
  modules: [
    new TreeModule<Quote>({ getParentId: (quote) => quote.groupId, defaultExpanded: true }),
    new SelectionModule<Quote>({ mode: 'multi' }),
  ],
};
```

Importing a module also adds its options and api methods **to the types**. Without
the import, `api.expandAll()` does not exist and does not compile:

```ts
import '@flowgrid/core/tree';

grid.api.expandAll(); // ✅ typed, because tree is imported
grid.api.setSortModel([/* … */]); // ❌ compile error without /sort
```

The same applies to column options — `comparator` arrives with `/sort`,
`enableCellFlash` with `/cell-flash`.

## Columns

```ts
interface ColumnDef<TData, TValue> {
  colId?: string;
  field?: string; // supports dot paths: 'quote.bid.price'
  headerName?: string; // defaults to a humanised field name
  width?: number;
  minWidth?: number;
  type?: string | string[]; // named presets from `columnTypes`
  valueGetter?: (params) => TValue; // computed columns
  valueFormatter?: (params) => string;
  cellRenderer?: string | ((params) => TemplateResult | string);
  cellRendererParams?: Record<string, unknown>;
}
```

Values resolve `valueGetter ?? field` → `valueFormatter` → `cellRenderer`. Sorting,
filtering and cell-flash all work on the _resolved_ value, so a computed column
sorts and flashes on what it displays rather than on some field behind it.

`defaultColDef` and `columnTypes` apply beneath each definition, weakest first:
`defaultColDef` → each `type` in order → the column itself.

A column that needs its value type — for a comparator or a typed formatter —
declares it, and still sits in the same array as its siblings:

```ts
import type { ColumnDef, ColumnDefs } from '@flowgrid/core';

const price: ColumnDef<Quote, number> = {
  field: 'price',
  comparator: (a, b) => (a ?? 0) - (b ?? 0),
  valueFormatter: ({ value }) => (value ?? 0).toFixed(3),
};

const columns: ColumnDefs<Quote> = [{ field: 'instrument' }, price];
```

## Custom cell renderers

Set `cellRenderer` to a custom element's tag name. The element reads its row and
column from context — no props are drilled through:

```ts
import { CellRendererElement } from '@flowgrid/core';

@customElement('depth-bar')
class DepthBar extends CellRendererElement<Quote, number> {
  render() {
    const width = Math.min(100, (this.value ?? 0) / 100);
    return html`<div style="width:${width}%;background:#22c55e;height:100%"></div>`;
  }
}
```

Because the base class tracks the signals it reads, a renderer repaints when its
own row ticks and stays inert otherwise. A cell using an element renderer drops
its horizontal padding, so the renderer owns the full cell box.

## Theming

Everything is a CSS custom property with an inline fallback, so the stylesheet is
optional. Custom properties inherit through shadow roots — set them on `fg-grid`
or any ancestor:

```css
fg-grid {
  --fg-row-height: 28px;
  --fg-bg: #1a1a1a;
  --fg-text: #e5e5e5;
  --fg-border: #333;
  --fg-selection-bg: rgb(59 130 246 / 18%);
  --fg-flash-up: rgb(34 197 94 / 35%);
  --fg-flash-down: rgb(239 68 68 / 35%);
}
```

`@flowgrid/core/themes/flowgrid.css` provides a light/dark pair. For structure
rather than colour, the elements expose `::part()`: `scroller`, `instance`,
`instance-grid`, `header-cell`, `header-label`, `header-slots`, `cell`,
`cell-content`, `tree-expander`, `sort-indicator`, `selection-checkbox`.

## Layouts

```ts
grid.gridOptions = { columns, layout: 'stack' };
```

`flow` (default) is the horizontal layout above. `stack` is a conventional
vertical grid with windowed row virtualisation, for the blotters and dialogs that
want one. Both ship in core and share everything above the layout engine.

## API

```ts
grid.api.applyTransaction({ add, update, remove });
grid.api.setRowData(rows);
grid.api.getRow(id);
grid.api.setColumnDefs(columns);
grid.api.scrollToRow(id);
grid.api.getState(); // aggregated module state, for persisting
grid.api.setState(state);
```

Events are typed `CustomEvent`s on the host: `fg-grid-ready`, `fg-data-changed`,
plus `fg-sort-changed`, `fg-filter-changed`, `fg-selection-changed` and
`fg-expansion-changed` from their modules.

## Writing a module

A module reaches the grid through hooks; it never renders a cell itself, so
several modules can decorate the same cell without fighting:

```ts
import type { GridModule } from '@flowgrid/core';

export class HighlightModule implements GridModule<Quote> {
  readonly id = 'highlight';

  cellDecorator({ column, value }) {
    if (column.field !== 'price' || (value as number) < 100) return null;
    return { classes: ['rich'], suffix: html`<span>★</span>` };
  }
}
```

Available hooks: `projectionStage`, `provideColumns`, `headerSlot`,
`headerDecorator`, `cellDecorator`, `rowDecorator`, `onKeyDown`, `apiExtension`,
`getState`/`setState`.

Projection stages run in a fixed phase order — `filter` → `sort` → `expand` →
`decorate` — regardless of registration order. Filter and sort therefore operate
on a flat list and need no knowledge of hierarchy, while the tree module's
`expand` stage groups the order they produced. That is why sorting a grouped grid
correctly orders siblings without any of the three modules knowing about the
others.

## Browser support

Modern evergreen browsers. Uses custom elements, shadow DOM, `IntersectionObserver`,
`ResizeObserver`, CSS grid and the Web Animations API.

## Licence

MIT
