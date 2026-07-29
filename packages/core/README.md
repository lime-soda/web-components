# @flow-grid/core

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
npm install @flow-grid/core
```

## Quick start

```ts
import '@flow-grid/core/define';
import '@flow-grid/core/themes/flow-grid.css';
import type { ColumnDef, FlowGrid, GridOptions } from '@flow-grid/core';

interface Quote {
  id: string;
  instrument: string;
  price: number;
}

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', headerName: 'Instrument', width: 240 },
  { field: 'price', width: 100, valueFormatter: ({ value }) => value!.toFixed(3) },
];

const grid = document.querySelector<FlowGrid<Quote>>('flow-grid')!;
grid.gridOptions = { columns } satisfies GridOptions<Quote>;
grid.rowData = quotes;

// Later, from a market data feed:
grid.api.applyTransaction({ update: [{ id: 'UKT30', instrument: 'UKT 4% 2030', price: 101.25 }] });
```

```html
<flow-grid style="height: 100%"></flow-grid>
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
   └── per-row signals ─────────────────────────────────────────────────► <flow-cell>
```

A price tick writes one row signal. The bound cells re-render; the projection and
the layout are not invalidated, so neither recomputes. Only _structural_ change —
a row added or removed, a sort key changed, a group expanded, a filter applied —
re-runs the pipeline.

The package's tests assert this directly rather than describing it: after a tick,
`api.getLayout()` returns the **same object** it returned before.

Measured in Chromium, 5,000 rows with six modules installed, 20 updates per
frame: median frame 16.7 ms, zero dropped frames, 6 of 194 instances mounted.

## Registering the elements

`@flow-grid/core/define` registers `<flow-grid>` and the elements it renders
with. It is the only entry point with a side effect, and importing it once
anywhere in the application is enough.

Importing from `@flow-grid/core` gives you classes and nothing else — no
registration, and no sibling elements dragged in behind the one you asked for.
That is what makes it possible to subclass an element, render one in a test, or
swap an implementation through an import map without a grid appearing in the
registry as a consequence:

```ts
import { ELEMENTS, defineElement, defineElements } from '@flow-grid/core';

defineElements(); // everything, the same as importing /define

defineElement('flow-cell', class extends ELEMENTS['flow-cell'] {}); // or your own
```

Registration is idempotent and the first name registered wins, so two copies of
the package on one page will not throw.

## Modules

Every feature beyond the core is an additive module with its own entry point.

| Import                       | Adds                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `@flow-grid/core/tree`       | Hierarchy, expand/collapse, and the repeated group headings |
| `@flow-grid/core/sort`       | Multi-column sort, comparators, header indicators           |
| `@flow-grid/core/filter`     | Quick filter and per-column filters                         |
| `@flow-grid/core/selection`  | Row and group selection, checkbox column                    |
| `@flow-grid/core/cell-flash` | Directional flash on value change                           |
| `@flow-grid/core/keyboard`   | Keyboard navigation and roving tabindex                     |

```ts
import { TreeModule } from '@flow-grid/core/tree';
import { SelectionModule } from '@flow-grid/core/selection';

grid.gridOptions = {
  columns,
  modules: [
    new TreeModule<Quote>({ getParentId: (quote) => quote.groupId, defaultExpanded: true }),
    new SelectionModule<Quote>({ mode: 'multi' }),
  ],
};
```

Each module is a separate entry point, so an app pays only for what it imports.
Measured with esbuild, minified and gzipped:

| Imports      | Wire size |
| ------------ | --------- |
| core only    | 26.4 kB   |
| + keyboard   | +0.3 kB   |
| + cell-flash | +0.7 kB   |
| + sort       | +1.2 kB   |
| + filter     | +1.4 kB   |
| + tree       | +1.9 kB   |
| + selection  | +2.1 kB   |
| everything   | 33.3 kB   |

A bundle-composition check in CI asserts that an unimported module leaves no
trace in the output, so this cannot quietly regress.

Importing a module also adds its options and api methods **to the types**. Without
the import, `api.expandAll()` does not exist and does not compile:

```ts
import '@flow-grid/core/tree';

grid.api.expandAll(); // ✅ typed, because tree is imported
grid.api.setSortModel([/* … */]); // ❌ compile error without /sort
```

The same applies to column options — `comparator` arrives with `/sort`,
`enableCellFlash` with `/cell-flash`.

## Selection

Ticking a group selects the instruments beneath it, and the group reflects them:
checked when all are selected, indeterminate when only some. Only leaves are
stored, so `getSelectedRows()` returns instruments rather than the headings above
them — what you would send to a basket.

It is scoped to the projection, so selecting a group under an active filter
selects the children that survived the filter, not the ones hidden behind it.

```ts
new SelectionModule<Quote>({
  mode: 'multi', // or 'single'
  groupSelectsChildren: true, // default
  checkboxColumn: true, // default, in either mode
  checkboxColumnWidth: 28,
  clickToSelect: false, // select by clicking anywhere in the row
  isSelectable: (rowId, meta) => true,
});
```

`mode`, `checkboxColumn` and `clickToSelect` are independent. Single selection
with checkboxes behaves like radio buttons; multi selection without them relies
on `clickToSelect`. The header select-all appears only in multi mode, since
selecting everything is not something single selection can express.

Set `groupSelectsChildren: false` to make a group row selectable **in its own
right**, standing for nothing but itself. Its children are then unaffected by it
and it is never indeterminate — the right choice when group rows are real
records rather than headings:

```ts
new SelectionModule<Quote>({ groupSelectsChildren: false });

grid.api.setRowSelected('some-group', true);
grid.api.getSelectedRows(); // ['some-group'] — no children
```

`isSelectable` excludes rows entirely. A row excluded that way is skipped when
its group is selected, and its group can still reach `checked` without it.

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
import type { ColumnDef, ColumnDefs } from '@flow-grid/core';

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
import { CellRendererElement } from '@flow-grid/core';

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

Two ways in, both landing on the same custom properties.

A typed theme object, validated on assignment:

```ts
import type { GridTheme } from '@flow-grid/core';

const theme: GridTheme = {
  rowHeight: '28px',
  background: '#1a1a1a',
  text: '#e5e5e5',
  border: '#333',
  selectionBackground: 'rgb(59 130 246 / 18%)',
  flashUp: 'rgb(34 197 94 / 35%)',
  flashDown: 'rgb(239 68 68 / 35%)',
};

grid.gridOptions = { columns, theme };
```

Only declared tokens are accepted — an unknown key throws rather than being
silently dropped, so a typo in a saved workspace surfaces immediately. A partial
theme is fine; anything unset falls back to the stylesheet.

Or set the properties directly, on the grid or any ancestor. They inherit through
every shadow root:

```css
flow-grid {
  --flow-row-height: 28px;
  --flow-background: #1a1a1a;
  --flow-text: #e5e5e5;
  --flow-selection-background: rgb(59 130 246 / 18%);
}
```

`@flow-grid/core/themes/flow-grid.css` provides a light/dark pair, honouring
`prefers-color-scheme` with a `data-flow-theme="light|dark"` override.

Every token maps to one property by the same rule — `selectionBackground` is
`--flow-selection-background`:

| Group      | Tokens                                                                        |
| ---------- | ----------------------------------------------------------------------------- |
| Typography | `font` `fontSize` `headerFontSize` `headerFontWeight`                         |
| Metrics    | `rowHeight` `headerHeight` `cellPaddingX` `instanceGap` `radius` `treeIndent` |
| Surfaces   | `surface` `background` `headerBackground` `placeholderBackground`             |
| Text       | `text` `textMuted` `headerText`                                               |
| Lines      | `border` `borderSubtle`                                                       |
| State      | `focus` `focusWidth` `selectionBackground` `hoverBackground`                  |
| Flash      | `flashUp` `flashDown` `flashNeutral` `flashDuration`                          |

`rowHeight` is the one token the grid overrides: the layout engine has already
used it to decide how many rows fit an instance, so CSS must lay them out at
exactly that height. Set it through `gridOptions.rowHeight`.

No component uses inline styles — a test walks the source and fails on any, so
every rule is reachable from a stylesheet. Module-contributed markup is styled
the same way: a module ships a `styles` stylesheet that is adopted into the
shadow roots its markup renders in, which is why the tree expander answers to
`--flow-text-muted` like everything else.

For structure rather than colour, the elements expose `::part()`: `scroller`,
`instance`, `instance-grid`, `placeholder`, `header-cell`, `header-label`,
`header-slots`, `cell`, `cell-content`, `tree-expander`, `sort-indicator`,
`filter-input`, `selection-checkbox`.

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

Events are typed `CustomEvent`s on the host: `flow-grid-ready`, `flow-data-changed`,
plus `flow-sort-changed`, `flow-filter-changed`, `flow-selection-changed` and
`flow-expansion-changed` from their modules.

## Writing a module

A module reaches the grid through hooks; it never renders a cell itself, so
several modules can decorate the same cell without fighting:

```ts
import type { GridModule } from '@flow-grid/core';

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
