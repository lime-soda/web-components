# @lime-soda/grid

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
npm install @lime-soda/grid
```

## Quick start

```ts
import '@lime-soda/grid/layouts';
import '@lime-soda/grid/themes/grid.css';
import type { ColumnDef, Grid, GridOptions } from '@lime-soda/grid';

interface Quote {
  id: string;
  instrument: string;
  price: number;
}

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', headerName: 'Instrument', width: 240 },
  { field: 'price', width: 100, valueFormatter: ({ value }) => value!.toFixed(3) },
];

const grid = document.querySelector<Grid<Quote>>('ls-grid')!;
grid.gridOptions = { columns } satisfies GridOptions<Quote>;
grid.rowData = quotes;

// Later, from a market data feed:
grid.api.applyTransaction({ update: [{ id: 'UKT30', instrument: 'UKT 4% 2030', price: 101.25 }] });
```

```html
<ls-grid style="height: 100%"></ls-grid>
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
   └── per-row signals ─────────────────────────────────────────────────► <ls-grid-cell>
```

A price tick writes one row signal. The bound cells re-render; the projection and
the layout are not invalidated, so neither recomputes. Only _structural_ change —
a row added or removed, a sort key changed, a group expanded, a filter applied —
re-runs the pipeline.

The package's tests assert this directly rather than describing it: after a tick,
`api.getLayout()` returns the **same object** it returned before.

Measured in Chromium, 5,000 rows with six modules installed, 20 updates per
frame: median frame 16.7 ms, zero dropped frames, 6 of 194 instances mounted.

## Entry points

The root entry has **no side effects**: it hands out classes, types and helpers,
registers nothing and provides no layout. That is what lets you import a type,
subclass an element or swap one through an import map without a grid appearing
in the custom element registry as a consequence.

A working grid comes from an entry that provides one. Each registers the
elements, so one import is enough:

| Import                    | Gives you                             |
| ------------------------- | ------------------------------------- |
| `@lime-soda/grid/flow`    | the horizontal layout                 |
| `@lime-soda/grid/stack`   | the vertical layout                   |
| `@lime-soda/grid/layouts` | every layout, switchable via `layout` |

`@lime-soda/grid/layouts` is the plural of the other two and does nothing they cannot:
importing `@lime-soda/grid/flow` and `@lime-soda/grid/stack` together has the same effect,
since each registers its own engine and registering an element twice is a no-op.
It exists because wanting both is common enough to deserve a name.

```ts
import '@lime-soda/grid/flow'; // elements registered, horizontal layout available
import type { ColumnDef } from '@lime-soda/grid'; // no side effect
```

Asking for a layout an entry point did not provide throws, and names the import
that would:

```
Layout "stack" is not available. Import '@lime-soda/grid' for both layouts,
or '@lime-soda/grid/stack' for this one alone.
```

Choosing a single layout saves about 0.3 kB gzipped — the engine, and little
else. The grid element's own stack chrome is a branch inside a class rather than
a separate module, so it stays either way; excluding that would mean splitting
the element itself. The reason to reach for `@lime-soda/grid/flow` is that it says
what the application does, not that it saves much.

## Modules

Every feature beyond the core is an additive module with its own entry point.

| Import                                | Adds                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `@lime-soda/grid/tree`                | Hierarchy, expand/collapse, and the repeated group headings |
| `@lime-soda/grid/sort`                | Multi-column sort, comparators, header indicators           |
| `@lime-soda/grid/filter`              | Quick filter and per-column filters                         |
| `@lime-soda/grid/selection`           | Row selection, checkbox column, click and modifier handling |
| `@lime-soda/grid/selection/tree`      | Makes a parent stand for the rows beneath it, for tree data |
| `@lime-soda/grid/selection/row-range` | Shift-click spans over contiguous rows                      |
| `@lime-soda/grid/cell-flash`          | Directional flash on value change                           |
| `@lime-soda/grid/keyboard`            | Arrow navigation across instances, Home/End, Page keys      |

```ts
import { TreeModule } from '@lime-soda/grid/tree';
import { SelectionModule } from '@lime-soda/grid/selection';

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

| Imports               | Wire size |
| --------------------- | --------- |
| core only             | 28.1 kB   |
| + selection/row-range | +0.4 kB   |
| + keyboard            | +0.6 kB   |
| + cell-flash          | +0.7 kB   |
| + selection/tree      | +0.9 kB   |
| + sort                | +1.3 kB   |
| + filter              | +1.5 kB   |
| + tree                | +1.9 kB   |
| + selection           | +2.4 kB   |
| everything            | 36.5 kB   |

A bundle-composition check in CI asserts that an unimported module leaves no
trace in the output, so this cannot quietly regress.

Importing a module also adds its options and api methods **to the types**. Without
the import, `api.expandAll()` does not exist and does not compile:

```ts
import '@lime-soda/grid/tree';

grid.api.expandAll(); // ✅ typed, because tree is imported
grid.api.setSortModel([/* … */]); // ❌ compile error without /sort
```

The same applies to column options — `comparator` arrives with `/sort`,
`enableCellFlash` with `/cell-flash`.

## Sorting under a live feed

Sorting re-orders when the set of rows changes, when the sort model changes, and
on `api.refreshSort()` — **not** as values tick.

That is deliberate. Sort by price on a live feed and a grid that re-sorts on
every tick streams rows past the pointer: the row being reached for is somewhere
else by the time the click lands, and nothing can be read while it moves. Rows
therefore hold their positions and their cells repaint in place. The projection
is not invalidated at all, so a tick costs no more sorted than unsorted.

The order is recomputed against current values at each of those points, so it is
never far behind, and an application can offer a re-sort explicitly:

```ts
new SortModule<Quote>({ resortOnValueChange: false }); // the default

grid.api.refreshSort(); // re-order now, leaving the sort model alone
```

Set `resortOnValueChange: true` for data that changes rarely, where an order
drifting out of date is more surprising than one that moves.

## Saving and restoring state

`api.getState()` returns everything worth persisting, keyed by the module that
owns it, and `api.setState()` puts it back:

```ts
localStorage.setItem('grid', JSON.stringify(grid.api.getState()));

grid.api.setState(JSON.parse(localStorage.getItem('grid')!));
```

A module owns its own slice, exactly as it owns its API methods, and contributes
it by augmenting `GridState`. So the shape follows the imports:

```ts
import '@lime-soda/grid/sort';

const state = grid.api.getState();
state.sort; // ✅ typed, because sort is imported
state.filter; // ❌ compile error without /filter
```

| Module      | Slice                                        |
| ----------- | -------------------------------------------- |
| `sort`      | the active sort, in priority order           |
| `filter`    | the column filters and the quick filter text |
| `selection` | the selected row ids                         |
| `tree`      | the ids of the expanded rows                 |

Every slice is optional, and a slice belonging to a module that is not installed
is ignored rather than being an error — so a profile saved by a grid with more
features still restores into one with fewer, and picks the rest up again if they
return. Modules with nothing worth persisting contribute nothing: cell-flash is
an animation, and a row range is a gesture that has already finished.

## Accessibility

The rows are one list however they are arranged, so the grid is the element
holding all of them and its totals describe the **data**, not the markup. An
instance is a group of rows within it, labelled with which rows — so a reader
landing in the middle of a wide grid knows where they are.

| Attribute       | On                | Meaning                                |
| --------------- | ----------------- | -------------------------------------- |
| `aria-rowcount` | the grid          | every row, plus the header             |
| `aria-colcount` | the grid          | the number of columns                  |
| `aria-label`    | each instance     | "Rows 23 to 43" — which rows it holds  |
| `aria-rowindex` | each row          | its place in the data; 1 is the header |
| `aria-colindex` | each cell, header | 1-based column position                |

Two kinds of repetition are hidden from readers, because both are content that
has already been read: the header, which every instance draws but only the first
exposes, and a group heading re-emitted atop a continuation, which already has a
place in the numbering.

With `TreeModule` installed the role becomes **`treegrid`**, and rows carry
`aria-level` and — where a row has children — `aria-expanded`. The role is
declared by the module rather than inferred by core, which would mean reading a
hierarchy convention core does not own.

Rows are laid out with `subgrid` rather than `display: contents`, so a row with
`role="row"` is a real element rather than one with no box.

All of this is checked with [axe](https://github.com/dequelabs/axe-core) in the
browser suite — a plain grid, a treegrid, one with sorting and selection
installed, and one with a collapsed group — rather than by reading the
specification and hoping.

## Keyboard and focus

The grid tracks focus itself rather than relying on the browser's, and paints
the ring from its own state. `:focus-visible` is not enough: it deliberately
does not match a mouse click, so a cell clicked into was genuinely focused —
arrows moved from it, screen readers followed it — while looking exactly like an
unfocused cell.

Exactly one cell is tabbable at a time, so the grid is a single tab stop from
outside. Once inside, **Tab moves a cell at a time** in reading order — along
the row, on to the next, and into the next instance, taking in each header
where reading order puts it. Shift-Tab reverses it.

At either end Tab is left unhandled, so focus leaves the grid rather than being
trapped in it.

When focus leaves, the ring goes with it but the position does not: the cell
stays the grid's tab stop, so Tab returns to where you were rather than to the
first cell. A remembered position is not a focused grid. `skipRow` does not apply to Tab: it says where the arrows come to
rest, and a row Tab could not reach would be a row no keyboard could reach.

Arrow keys reach the **header** too, but only backwards: up from the first row
enters that instance's header, and down or forwards always lands on data. A
header is something you go up to when you want it, and stepping through one on
the way to the next instance's rows would put a stop in the path of the common
movement for the sake of the rare one. Sideways movement and instance jumps stay
in whichever band they started in.

Arrow keys can pass over rows entirely — group headings, separators, whatever a
particular grid treats as scenery:

```ts
new KeyboardModule<Quote>({
  skipRow: ({ meta }) => meta['hasChildren'] === true,
});
```

The predicate always comes from the consumer. There is deliberately no
`skipParentRows` flag: the module would have to read `meta.hasChildren` or
`meta.depth` to implement one, and those are conventions belonging to whichever
module built the hierarchy. Keeping the predicate outside is what lets the
keyboard module stay a mapping from keys onto movement.

It applies to movement between rows — arrows, page keys, instance jumps — and
not along one, since that never changes row. Headers are never offered to it. If
everything ahead is skipped the movement is refused and focus stays put, rather
than being left partway through the rows it rejected.

With `SelectionModule` installed, **Space or Enter selects the focused row** from
the checkbox cell — focus sits on the cell, not on the checkbox inside it, so the
key press would otherwise reach nothing. With no checkbox column there is nothing
to aim at, so any cell answers. Space does not scroll the page while the grid has
focus.

## Selection

Selection is three modules, because most grids do not need all three.

`SelectionModule` on its own is **flat**: it holds a set of selected row ids,
every row stands for itself, and nothing in it reads hierarchy. That is the
whole model, and it is what a grid of instruments with no grouping should pay
for.

```ts
import { SelectionModule } from '@lime-soda/grid/selection';
import { TreeSelectionModule } from '@lime-soda/grid/selection/tree';
import { RowRangeModule } from '@lime-soda/grid/selection/row-range';

modules: [
  new SelectionModule<Quote>({ mode: 'multi' }),
  new TreeSelectionModule<Quote>(), // ticking a group ticks its rows
  new RowRangeModule<Quote>(), // shift-click selects a span
];
```

**`TreeSelectionModule`** makes a parent stand for the rows beneath it. Ticking
a category selects its instruments, a partly selected category reads as
indeterminate, and `getSelectedRows()` returns instruments rather than the
headings above them — what you would send to a basket. It is scoped to the
projection, so selecting a group under an active filter selects the children
that survived it, not the ones hidden behind it.

It is named for **tree data** and not for grouped rows, because the two are not
the same shape. In tree data every row is a record in the store with an id of
its own, the parent included — which is why `getParentId` maps a record to
another record, and why a parent can be selected, remembered and reported like
any other row. Rows produced by _grouping_ are synthetic: they stand for an
aggregate that was never in the store and take their membership from a grouping
key rather than a parent. That will be a separate module.

It does not require `TreeModule`, though it pairs with it: the hierarchy comes
from `getParentId` on the data, never from the screen.

**`RowRangeModule`** adds shift-click spans, taken from the projection so they
follow the rows as displayed. Without it, shift is simply an unmodified click.

A span covers rows, so crossing into a group selects the rows it crossed and no
more. A group is only taken whole when the span covers all of it — which is the
same set as clicking its heading — or when it is collapsed, since then the
heading is the only representation its contents have.

Both attach through published seams — a `SelectionMembership` and a
`RangeHandler` — rather than by reaching into core selection, so removing a
module restores the behaviour underneath rather than leaving the grid in a half
state.

Neither module installs anything. Each **declares** what it can do —
`provideSelectionMembership()`, `provideSelectionRange()` — and selection finds
the module that provides it:

```ts
class TreeSelectionModule {
  provideSelectionMembership(): SelectionMembership {
    /* a parent stands for the rows beneath it */
  }
}
```

So the result does not depend on registration order, no module reaches into
another, and two modules providing the same thing is a single, obvious error at
registration:

```
Modules "selection-tree" and "selection-group" both provide selection
membership. A row id can only stand for one thing, so these modules cannot be
installed together.
```

Core answers both questions itself when nothing provides them: every row stands
for itself, and shift is an unmodified click.

```ts
new SelectionModule<Quote>({
  mode: 'multi', // or 'single'
  checkboxColumn: true, // default, in either mode
  checkboxColumnWidth: 28,
  clickToSelect: false, // select by clicking anywhere in the row
  selectionWithoutKeys: false, // plain click adds instead of replacing, for touch
  isSelectable: (rowId, meta) => true,
});
```

With `clickToSelect`, row clicks follow the desktop conventions: a plain click
replaces the selection, Ctrl or Cmd adds to it, and Shift extends from the last
row acted on. A plain checkbox click always accumulates, modifier or not — that
is what a checkbox is for.

Shift works identically on a row and on a checkbox, and both **re-cut** the span
rather than only growing it: drag out to row 6, come back to row 3, and rows 4
to 6 are given up again. Only the span is given up — rows picked out separately,
by a plain click or a Ctrl-click, are not the range's to withdraw and survive
it. Moving the anchor starts a fresh span. Set `selectionWithoutKeys` for touch devices, where there are
no modifier keys and a plain click has to accumulate to be useful.

`mode`, `checkboxColumn` and `clickToSelect` are independent. Single selection
with checkboxes behaves like radio buttons; multi selection without them relies
on `clickToSelect`. The header select-all appears only in multi mode, since
selecting everything is not something single selection can express.

A group row can stand for three different things, set by `scope`:

| `scope`                        | Ticking a category selects            |
| ------------------------------ | ------------------------------------- |
| `self`                         | the category row alone                |
| `children`                     | every instrument in it, hidden or not |
| `filteredChildren` _(default)_ | only those the filter left visible    |

```ts
new TreeSelectionModule<Quote>({
  scope: 'filteredChildren', // the default
  getParentId: (quote) => quote.groupId,
});
```

`getParentId` is required, and is the module's only source of hierarchy. It was
briefly optional, with membership read off the projection when it was missing —
but the projection hides two different things: rows the filter excluded, and
rows a _collapsed_ parent is not drawing. Only the first were excluded by
anything, so a parent collapsed before it had ever been opened stood only for
itself, and clicking it reported the category's own id as though it were an
instrument.

Reading the data instead makes that whole class of question disappear, and
`filteredChildren` means what it says: descendants that passed the filter, drawn
or not. The projection is still consulted for the two things it genuinely owns —
whether a row passed the filter, and the `meta` an `isSelectable` predicate
sees.

`filteredChildren` is the default because it is the conservative one: it can only
ever select rows the user can see, so a filtered view cannot quietly put hidden
instruments in a basket. `children` is the choice when ticking a category is
meant to mean the category itself, whatever happens to be on screen.

`self` makes a group row selectable **in its own right**, standing for nothing
but itself. Its children are then unaffected by it and it is never
indeterminate — the right choice when group rows are real records rather than
headings.

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
import type { ColumnDef, ColumnDefs } from '@lime-soda/grid';

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
import { CellRendererElement } from '@lime-soda/grid';

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
import type { GridTheme } from '@lime-soda/grid';

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
ls-grid {
  --ls-grid-row-height: 28px;
  --ls-grid-background: #1a1a1a;
  --ls-grid-text: #e5e5e5;
  --ls-grid-selection-background: rgb(59 130 246 / 18%);
}
```

`@lime-soda/grid/themes/grid.css` provides a light/dark pair, honouring
`prefers-color-scheme` with a `data-ls-grid-theme="light|dark"` override.

Every token maps to one property by the same rule — `selectionBackground` is
`--ls-grid-selection-background`:

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
`--ls-grid-text-muted` like everything else.

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
grid.api.getState(); // everything worth persisting, typed per module
grid.api.setState(state);
```

Events are typed `CustomEvent`s on the host: `ls-grid-ready`, `ls-grid-data-changed`,
plus `ls-grid-sort-changed`, `ls-grid-filter-changed`, `ls-grid-selection-changed` and
`ls-grid-expansion-changed` from their modules.

## Writing a module

A module reaches the grid through hooks; it never renders a cell itself, so
several modules can decorate the same cell without fighting:

```ts
import type { GridModule } from '@lime-soda/grid';

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
