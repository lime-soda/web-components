# @lime-soda/grid

## 0.4.1

### Patch Changes

- 5da8910: Fix two things assistive tech was being told wrongly.

  Cells had no `role`. A `role="grid"` whose rows contain unroled elements is not
  a grid, and a screen reader moving through it found rows of nothing. They are
  `gridcell` now.

  A column heading took its accessible name from its contents, so every control a
  module put in the header joined it — with sorting and column arranging
  installed, "Price" was announced as "Price Move Price Resize Price". A heading
  is now named for its column, so the affordances stop describing the data.

- d8a92b5: Fix `aria-hidden-focus` on the rows and headers a continuation instance repeats.

  Both were hidden from assistive tech while staying focusable, which is a
  contradiction — and they needed opposite fixes.

  A continuation's header is now real. Focus goes to each instance's own header
  deliberately, and once the reader has scrolled right every header on screen is a
  continuation, so hiding them put sorting and filtering beyond both the mouse and
  the keyboard. Each instance is its own rowgroup, so a heading row is honest;
  only the first claims `aria-rowindex="1"`.

  A repeated ancestor row is now `inert` and skipped by keyboard navigation. That
  one really is a second drawing of a row already present, so the copy cannot be
  operated while the original still can be.

  The grid's Storybook stories now gate on accessibility rather than carrying this
  as a known exception.

## 0.4.0

### Minor Changes

- caa4fbe: Add `@lime-soda/grid/columns`: resize, reorder and pin columns.

  Each header gains a grip to move the column and a handle to resize it, both
  operable from the keyboard. `api.getColumnState()` and `setColumnState()`
  round-trip the arrangement for persistence.

  `pinned: 'left' | 'right'` holds a column against an edge in the stack layout,
  and is inert in the flow layout — an instance there is sized to its own columns
  and the scroller moves between instances, so nothing slides out from under the
  viewport for a pinned column to stay in front of.

  Modules can now rewrite the resolved columns through a `transformColumns` hook,
  which is what carries all three without core knowing about any of them.

## 0.3.0

### Minor Changes

- f4dc3ab: Remove the deprecated `ValueGetterParams` and `ValueFormatterParams` aliases.

  They were kept for one release when the cell contexts were split into three
  tiers. Use `CellValueContext` for a `valueGetter` and `CellFormatContext` for a
  `valueFormatter` — the aliases pointed at exactly these, so the change is a
  rename.

## 0.2.0

### Minor Changes

- a274376: Add `@lime-soda/grid/clipboard`: copy to the clipboard, and CSV or TSV export.

  Ctrl-C — Cmd-C on macOS — copies the selection, or the filtered rows when
  nothing is selected. `api.getDataAsCsv()`, `getDataAsTsv()` and
  `copyToClipboard()` do the same from code, and take a `rows` option:
  `filtered` for the rows the filter kept, `all` for every row the grid holds,
  `selected` for the selection. Neither `filtered` nor `all` needs anything
  selected, and both keep the sort.

  The line between the first two is the filter alone. Both include the children of
  a collapsed group, because collapsing is a way of looking at the data rather
  than a statement about which rows exist.

  What comes out is what is on screen rather than what is underneath: rows in
  projection order, so a filter and a sort are respected, and each cell through
  its own `valueFormatter`, so a price copies with the decimals it was shown with.
  Fields containing the delimiter, a quote or a newline are quoted — not a corner
  case here, since a formatted size carries thousands separators and would
  otherwise split into three columns and shift every column after it.

  Standalone. It composes with selection through a declared capability rather than
  a dependency: a selection module says what is selected, and the clipboard module
  asks whoever provides that. With no selection module installed it copies the
  projection and nothing breaks.

  Costs 0.7 kB gzipped, and the bundle-composition check covers it, so it stays
  out of a build that does not import it.

### Patch Changes

- 86b8b98: Stop publishing the `development` export condition.

  The workspace resolves its own packages through a `development` condition
  pointing at TypeScript source, so one package importing another gets source
  rather than a stale `dist`. That condition was being published, and `src` is not
  in `files` — so any consumer whose bundler sets `development`, which Vite does
  in dev, resolved to a file that was never shipped:

  ```
  Failed to resolve entry for package "@lime-soda/grid"
  ```

  `publishConfig.exports` now strips it at pack time. This affected every subpath
  of `@lime-soda/grid` and the entry point of `@lime-soda/button`.

## 0.1.0

### Minor Changes

- 004aa74: Give selection a single accent at the theme level.

  `theme.color.accent` is the colour of a control in its selected state, and
  `theme.color.accentSubtle` the wash behind a selected row. Both follow the
  primary by default, so retargeting selection across every component is one
  value rather than a hunt.

  The token stylesheet also sets `accent-color` on `:root`. That is the one thing
  a custom property cannot do on its own — nothing else paints the tick inside a
  native checkbox or the thumb of a range — so an application's own form controls
  now match the components without wiring anything up per control.

  The grid picks both up. Its checkbox was borrowing `--grid-focus`, which meant a
  ticked box was the focus-ring colour: a ring says "the keyboard is here" and an
  accent says "this is on", and they should not be the same statement. Its
  selected-row wash was mixed from the info blue and is now the accent, at 12% in
  light and 22% in dark — one figure does not read in both. Text over a selected
  row clears AA either way, at 16.8:1 and 14.0:1.

- 216ebd5: Rename the package to `@lime-soda/grid` and the elements to the `ls-` prefix.

  The grid was developed in a separate repository as `flow-grid` and reached
  0.2.0 there, but the release never published: npm normalises `flow-grid` to
  `flowgrid`, which is taken. Publishing under a scope removes the collision, and
  the design system's scope is where the grid belongs — it is a web component
  alongside `@lime-soda/button`.

  Everything user-facing moves with it, so that a consumer sees one vendor rather
  than two:

  - elements: `<flow-grid>` → `<ls-grid>`, and likewise `ls-grid-instance`,
    `ls-grid-row`, `ls-grid-cell`, `ls-grid-header-cell`
  - classes: `FlowGrid` → `Grid`, `FlowRow` → `GridRow`, `FlowCell` → `GridCell`,
    `FlowInstance` → `GridInstance`, `FlowHeaderCell` → `GridHeaderCell`
  - events: `flow-grid-ready` → `ls-grid-ready`, `flow-sort-changed` →
    `ls-grid-sort-changed`, and the rest of the `flow-*` events
  - custom properties: `--flow-*` → `--ls-grid-*`
  - theme: `flow-grid/themes/flow-grid.css` → `@lime-soda/grid/themes/grid.css`

  `FlowLayoutEngine` and the `@lime-soda/grid/flow` entry point keep their names:
  they refer to the horizontal flow layout, which is still what they do.

  Since 0.2.0 was never published there is no upgrade path to write — nothing
  downstream can be on the old name.

- f603a80: Default to a trading density, and set figures in tabular widths.

  Rows are 24px rather than 32px, cells 12px and headers 11px, so a monitor holds
  roughly a third more instruments.

  `numericVariant` is a new theme token, resolving to `tabular-nums slashed-zero`.
  Tabular widths mean every digit takes the same advance, so a column of prices
  aligns on the decimal without being set in a monospace face, and a number does
  not visibly reflow as it ticks. The slashed zero is for instrument codes, where
  `0` and `O` sit next to each other. It replaces a hard-coded
  `font-variant-numeric: tabular-nums` in the cell, so it is now themeable and
  documented in the manifest like every other token.

- 786da6d: Let a modified click select, so a pointer can always reach selection.

  `checkboxColumn` defaults on and `clickToSelect` defaults off, which together
  left a grid configured with no checkbox column selectable by keyboard and inert
  to a mouse — the pair of defaults was reachable, and broken, without setting
  anything unusual.

  Ctrl-click, or Cmd-click on macOS, now selects whatever `clickToSelect` says.
  That keeps the plain click free to mean something else in the application —
  opening a detail panel, say — which is why the option stays off by default, and
  it means the option never has to be turned on merely to make selection possible.

  `clickSelects` still reports the plain click alone, since a range module reads
  it to decide whether to agree with row clicks.

- e50b72d: Take theming from the design system rather than from a stylesheet of its own.

  Every `--grid-*` property is now a design token declared in
  `support/tokens/components/grid.json` against the semantic tier, so the grid
  inherits the palette, the spacing scale and the light/dark pair the rest of the
  system uses. The host adopts those declarations the way the button does.

  Breaking, though nothing is published on the old name:

  - Custom properties are `--grid-*`, not `--ls-grid-*`, matching the convention
    that names them after the element minus its `ls-` prefix
  - `@lime-soda/grid/themes/grid.css` is gone, and with it the
    `prefers-color-scheme` block and the `data-ls-grid-theme` override. Light and
    dark now follow `color-scheme`, because the semantic tier resolves through CSS
    `light-dark()`
  - An application must load `@lime-soda/tokens/variables.css`. The grid used to
    carry a literal fallback for every colour and size; those are gone, so the
    tokens are the only source of its appearance

  The `theme` option is unchanged: a `GridTheme` object still overrides any token
  on the host, and is still validated against the same schema. A test now checks
  that schema against the design tokens themselves, in both directions, so a token
  cannot exist on the type with nothing behind it or in the design system with
  nothing reading it.

  The published manifest describes the elements for the first time — they are
  registered imperatively rather than with a decorator, so the analyser had no tag
  names to find — and `ls-grid` documents all 27 themeable properties with their
  descriptions and defaults.

- 7b8ad6b: Add `colSpan`, and define what a column function is given.

  `colSpan` takes a number or a function and is resolved per row, because that is
  where the answer lives: a group heading spans the grid and the instrument in the
  same column beneath it does not. Covered columns render no cell, the spanning
  cell carries `aria-colspan`, and arrow navigation steps over the span rather
  than stopping inside a cell that was never drawn — the renderer and the focus
  controller resolve spans through the same function so they cannot disagree.

  Column function contexts are now three tiers rather than two ad-hoc shapes:
  `CellValueContext` (data, node, column) for `valueGetter`, which sort and filter
  call during projection where no laid-out row exists; `CellFormatContext` adds
  the resolved value; `CellContext` adds the row, for anything running at render
  time, which is what makes per-row decisions like `colSpan` possible.
  `ValueGetterParams` and `ValueFormatterParams` remain as deprecated aliases.

  `cellClass` is gone. It was declared on `ColumnDef` and never read by anything,
  and a class on a cell cannot be reached by page CSS in any case — `::part(cell)`
  is the way to style structure now that parts are forwarded.

- f603a80: Repoint the base theme at trading interfaces.

  The palette was a bright green and a bright pink — opinionated, and hard to sit
  in front of all day next to coloured market data. The primary is now a muted
  teal and the secondary a warm taupe, with a neutral grey ramp in place of the
  blue-tinted one, so the chrome stays out of the way of the data on top of it.

  Every foreground and background pairing in the semantic tier now clears WCAG AA
  in both modes, the tightest at 5.48:1. The old white-on-green was 2.27:1. Part
  of the fix is that the accent label inverts between modes — white on the darker
  light-mode teal, near-black on the lighter dark-mode one — because white on a
  light accent cannot pass. The button's Storybook accessibility check is back to
  failing the build rather than merely reporting.

  Everything is a step denser, which is the point of a trading surface: 13px body
  text where it was 16px, component spacing from 2px to 16px where it was 4px to
  32px, and tighter corner radii.

  Breaking: `color.green` and `color.pink` no longer exist, and every `theme.*`
  value has moved. Anything referencing the primitives by name needs updating;
  anything referencing the semantic tier keeps working and simply looks different.

- 2593a93: Make arrow-key navigation part of core rather than an optional module.

  The grid announces `role="grid"`, and the ARIA pattern for that role requires
  arrow navigation: assistive technology tells the user this is a grid and that
  arrows move around it. With navigation in an optional module, a default grid
  made that announcement and then ignored every arrow — an incorrect
  announcement, not a missing convenience.

  Core now handles the four arrows, Tab in reading order, and Escape. Tab is here
  for a separate reason: it is allowed to run out at either end so focus leaves
  the grid, and a grid you cannot Tab out of is a keyboard trap under WCAG 2.1.2
  whatever role it claims.

  The keyboard module keeps everything the pattern lists as optional — Home and
  End, the page keys, instance jumps, and the skip-row predicate — and is still
  offered every key first, so installing it replaces the floor rather than
  competing with it. Nothing changes for a grid that already imports it.

  Core grows 0.2 kB gzipped. The module still costs 0.6 kB.

- 1f65a00: Close the last gaps between the two components' theming.

  The button's focus ring was two hard-coded widths and a colour borrowed from the
  primary variant; it is now `--button-focus-width`, `--button-focus-offset` and
  `--button-focus-color`, with the disabled opacity tokenised alongside. No
  literal values remain in either component's styles.

  The grid's nine control knobs — expander size, sort indicator and badge sizes,
  filter input width, padding and font size, instance border width and disabled
  opacity — were literals inlined as `var()` fallbacks, which made them the only
  part of its appearance the design system could not reach. They are design tokens
  now and part of the public `GridTheme`, which grows from 27 to 36 tokens. The
  test that keeps the schema and the design tokens in step covers them, so the
  exemption list they used to sit on is gone.

### Patch Changes

- c061be6: Document the parts and events in the manifest.

  `::part()` is the supported way to restyle structure and the manifest is what
  the MCP server and editor integrations read, so the grid publishing sixteen
  reachable parts and describing none of them meant nobody could find them. The
  analyser reports what `@csspart` and `@fires` tags tell it, and the grid had
  neither.

  `ls-grid` now documents all sixteen parts and eight events. Child elements carry
  their own, and the host repeats the full set deliberately: a consumer writes
  `ls-grid::part(cell)`, never `ls-grid-row::part(cell)`, so the host is where the
  whole list belongs.

  Four tests keep it honest, in both directions — every rendered part is
  documented, everything forwarded is documented, nothing documented has been
  renamed away, and the host lists the complete set. They read the source rather
  than the built manifest so they pass on a clean checkout.

- 05050dd: Fix keyboard navigation in the stacked layout when focus is in the header.

  The key handler was bound to the scroller, and the stack renders its header in
  chrome above the scroller rather than inside it. So arrowing up into a stacked
  header left focus somewhere no key could reach: the body navigated, the header
  was inert. It is bound to the host now, so no part of the grid can sit outside
  the handler, whatever chrome is added later.

- c893589: Make `::part` actually reach the grid's internals.

  The README has always listed parts as the way to restyle structure, but `part`
  does not cross a shadow boundary on its own — each host in between has to
  forward it with `exportparts`, and nothing did. So `ls-grid::part(scroller)` and
  `::part(instance)` worked, being in the grid's own shadow root, while
  `::part(cell)`, `::part(row)`, `::part(header-cell)`, `::part(cell-content)` and
  every module part silently matched nothing.

  Forwarding now runs the whole chain — grid → instance → row → cell, and out of
  cell renderers, which are a shadow root each again. Rows gain a `row` part,
  which they never had.

  Modules declare their part names through a new optional `parts` on the module
  contract, because the elements that forward them render before any module
  markup exists. `tree-expander`, `sort-indicator`, `filter-input` and
  `selection-checkbox` are reachable as a result.

  Seven browser tests style the grid through the host exactly as a consumer would
  and read the result off the element, one per depth, so a broken link in the
  chain fails rather than going quiet.

- 7f573d4: Make the focus ring its own semantic token, and the same colour in both
  components.

  `theme.color.focus` is blue — `color.blue.600` in light, `400` in dark. It stays
  deliberately apart from the accent: an accent says "this is selected" and a ring
  says "the keyboard is here", and a keyboard user needs to tell those apart on
  the same row.

  It also stops both components borrowing a semantic that means something else.
  The grid reached through `theme.color.info`, so restyling an informational
  banner would have moved every focus ring; the button reached through the primary
  and so had a teal ring where the grid had a blue one. Both now point at the same
  token.

  The ring clears the WCAG 2.2 non-text threshold of 3:1 everywhere it lands:
  5.17:1 on the page, 4.95:1 on a raised surface and 4.37:1 on a selected row in
  light mode, and 7.83 / 6.97 / 5.74 in dark.

- 4660828: Reference tokens through the generated module rather than by writing the
  property names out, matching how the button consumes its own:
  `${tokens.borderSubtle}` instead of `var(--grid-border-subtle)`, 56 references
  across eight files.

  The output is identical — the token exports are `css` literals holding exactly
  that `var()` — but a mistyped name is now a compile error rather than dead CSS,
  and the name is written once instead of once per use.

  Raw `var()` remains only for the internal geometry a component sets and reads
  itself, which has no token behind it: instance width and height, the column
  template, spacer and sticky heights, scroll offset, scrollbar width and tree
  depth.

- 2edb37b: Memoise the `exportparts` value instead of rebuilding it per cell.

  Forwarding parts across the shadow boundaries means an `exportparts` string on
  every row, cell, header cell and cell renderer. It was recomputed on each of
  them on every render — a `flatMap` for the module parts, then a `Set`, a spread
  and a `join` — even though the result changes only when the module set does. A
  ticking cell rebuilt the identical string every frame.

  The registry now hands back an identity-stable array of module parts, and the
  string is cached against it, so a render after the first is a `WeakMap` lookup.
  Tests pin it by identity rather than equality, since a correct-but-rebuilt
  string would pass an equality check and still allocate.

- decdf55: Fix focus and arrow keys on the stacked layout's pinned group band.

  The band is a copy of rows that are also in the body, drawn over them. It was
  built as an instance with an id of its own — `${id}-sticky` — which the layout
  did not contain, so a click on one of its cells put focus at a position the
  focus controller could not locate. Every arrow key afterwards went unhandled,
  which meant the browser scrolled the body instead of the grid moving, and a
  group row reached with the keyboard showed no ring because the ring was on the
  body row hidden underneath the band.

  The band now carries the same id as the instance it echoes, so a position taken
  from it is a real one, and a new `pinned` flag keeps its cells out of the tab
  order — the rows it mirrors are already in it. As a side effect the band shows
  the focus ring for the row it covers, which is the visible element.

- Updated dependencies [004aa74]
- Updated dependencies [7f573d4]
- Updated dependencies [f603a80]
  - @lime-soda/tokens@0.2.0

## Before publication

The grid was built in a separate repository under the name `flow-grid` and
versioned to 0.2.0 there, but no release ever reached a registry: npm
normalises `flow-grid` to `flowgrid`, which is taken. Those versions are
development history, kept here because the changes are real, and numbered
separately from the published ones above — which start at 0.1.0, this
package's first actual release.

### 0.2.0

#### Minor Changes

- 167e74e: Report the grid's shape to assistive technology, and treegrid for tree data

  The roles were there — `grid`, `row`, `columnheader`, `gridcell` — but none of
  the counting attributes, which matter more here than in a conventional grid
  because rows are spread across instances. Without them a reader is told only
  about the markup that happens to exist.

  The grid carries `aria-rowcount` and `aria-colcount` describing the whole data
  set; each instance is a `rowgroup` labelled with the rows it holds; rows carry
  `aria-rowindex` giving their place in the data rather than in the panel drawing
  them; and cells and header cells carry `aria-colindex`.

  The repeated header and a group heading re-emitted atop a continuation are
  hidden from readers — both are content that has already been read, and counting
  them would make the numbering disagree with itself.

  With `TreeModule` installed the role becomes `treegrid`, and rows carry
  `aria-level` and `aria-expanded` — the latter on the row, where a treegrid looks
  for it, rather than only on the expander button. The module declares the role
  through a new `provideGridRole` capability; core cannot infer it without reading
  a hierarchy convention it does not own.

  Rows are laid out with `subgrid` rather than `display: contents`, so a row
  carrying `role="row"` is a real element rather than one with no box.

- 5a5cfc7: Give each layout its own entry point, and keep the root free of side effects

  The root entry registers nothing and provides no layout. Importing a type,
  subclassing an element or swapping one through an import map cannot put a grid
  in the custom element registry as a consequence.

  A working grid comes from an entry that provides one, and each registers the
  elements so a single import is enough:

  - `flow-grid/flow` — the horizontal layout
  - `flow-grid/stack` — the vertical layout
  - `flow-grid/layouts` — every layout, switchable through `layout`

  The grid controller no longer names both engines and picks with a ternary; an
  entry point registers what it provides, and asking for a layout that was not
  registered throws, naming the import that would provide it.

  Choosing one layout saves about 0.3 kB gzipped. The engine is excluded; the grid
  element's own stack chrome is a branch inside a class rather than a separate
  module, so it stays either way.

- f288064: Let modules declare selection behaviour instead of installing it

  `SelectionModule` exposed setters that other modules called to replace its
  behaviour, passing their own id along so a clash could be reported. That put the
  wiring in the wrong place: a module reached into another module, the outcome
  depended on registration order, and the id was a string that had to agree with
  the module it named.

  Behaviour is now a property of the module. `TreeSelectionModule` implements
  `provideSelectionMembership()` and `RowRangeModule` implements
  `provideSelectionRange()`; core selection looks for the module that provides
  each, and refuses to start when two provide the same one, naming both.

  `ModuleContext` gains `getModules()`, which is what makes finding a capability
  possible without knowing an id in advance.

  Core still answers both questions when nothing provides them, so plain row
  selection remains a single module.

- 4e5c4ef: Register elements explicitly instead of on import

  Importing `flow-grid` no longer defines the custom elements. Call
  `defineElements()`, or import `flow-grid/layouts`, which does it for you.

  Importing a class now gives you the class and nothing else — no registration,
  and no sibling elements dragged in behind it — so an element can be subclassed,
  rendered in a test, or substituted through an import map without a grid
  appearing in the registry as a consequence.

  `sideEffects` was also declared as `false`, which was untrue: bundlers took it at
  its word and dropped the entry outright, leaving a 105-byte bundle with no
  elements defined and nothing rendered. It now lists the files that really do have
  side effects, and two bundle tests hold this in place.

- 4e5c4ef: Make focus visible, reachable and skippable

  The focus ring was `:focus-visible`, which by design never matches a mouse click,
  so a clicked cell was genuinely focused — arrows moved from it, screen readers
  followed it — while looking exactly like an unfocused one. The grid tracks focus
  itself and now paints from its own state. The grid also gained a tab stop, so it
  can be reached by keyboard at all.

  Arrow keys reach header cells, but only backwards: up from the first row enters
  that instance's header, while down and forwards always land on data.
  `CellPosition` gains a required `section` of `'header'` or `'body'`.

  `KeyboardModule` accepts a `skipRow` predicate for rows to pass over rather than
  land on. The predicate always comes from the consumer — there is deliberately no
  `skipParentRows` flag, which would require the module to know what a parent row is.

  The rightmost column no longer has its focus ring clipped: an instance is sized
  to its columns, and its border is now added around that rather than eaten out of
  it.

- c9dbf82: Rename the package to `flow-grid`

  `@flow-grid/core` held the whole grid — tree, sort, filter, selection, keyboard
  and cell-flash — which made the name a contradiction: "core" reads as the
  minimal thing, and it was the shipping unit.

  The package is now `flow-grid`, and "core" means what it always meant: the `.`
  entry, the grid with no modules installed.

  ```ts
  import 'flow-grid/layouts';
  import { TreeModule } from 'flow-grid/tree';
  ```

  Nothing else moves. The entry points, their contents and the tree-shaking are
  unchanged; `@flow-grid/core` was only ever published at 0.1.0 and should be
  treated as deprecated.

- 4e5c4ef: Split selection into row selection, tree selection and row ranges

  `SelectionModule` is now flat by construction: a set of selected row ids where
  every row stands for itself. Hierarchy and spans arrive as separate modules
  through two published seams, so a grid pays only for what it uses.

  - Group selection — ticking a category selecting its instruments, indeterminate
    state, membership surviving collapse — moves to `TreeSelectionModule` from
    `flow-grid/selection/tree`, and `groupSelectsChildren` moves to its
    options.
  - Shift-click spans move to `RowRangeModule` from
    `flow-grid/selection/row-range`. Without it, shift is a plain click.

  Row clicks now follow the desktop conventions: a plain click replaces the
  selection, Ctrl or Cmd adds to it, and Shift extends from the anchor. Checkbox
  clicks still accumulate without a modifier, which is the distinction between the
  two affordances. `selectionWithoutKeys` restores an accumulating plain click for
  touch devices.

  The checkbox column is no longer derived from `mode`. It defaults on in either
  mode and is turned off only by asking; the header select-all never appears in
  single mode. Space or Enter selects the focused row from the checkbox cell.

- 4e5c4ef: Hold the row order while values tick

  A sorted grid no longer re-orders as values change. Sorting by price on a live
  feed used to stream rows past the pointer, so the row being reached for had moved
  by the time the click landed.

  The order is recomputed where a reorder is not a surprise: when rows are added or
  removed, when the sort model changes, and on the new `api.refreshSort()`, which
  re-orders against current values without touching the model. Pass
  `resortOnValueChange: true` to `SortModule` for the previous behaviour.

  A tick now costs the same sorted as unsorted, since the projection is not
  invalidated at all.

- 7568b8e: Move a cell at a time on Tab

  Tab left the grid entirely: the roving tabindex makes it one tab stop, so the
  first press moved focus past the whole thing.

  Tab now walks cells in reading order — along the row, on to the next, into the
  next instance, taking in each header where reading order puts it — and
  Shift-Tab reverses it. At either end the key is deliberately left unhandled so
  focus leaves the grid; a grid that cannot be tabbed out of is a trap.

  `skipRow` does not apply to Tab. It says where the arrows come to rest, and a
  row Tab could not reach would be a row no keyboard could reach.

- ecf5b39: Read the tree selection hierarchy only from the data

  `TreeSelectionModule` carried two complete implementations of the same idea: one
  derived from the projection, one from the store. The projection-derived path
  came first and was kept as a fallback for consumers who had not supplied
  `getParentId` — but it was the one that could not tell a filtered row from a
  collapsed one, and it needed a remembered-membership map to paper over the
  difference.

  `getParentId` is now required, and the projection path is gone with everything
  that propped it up: the leaf index, the ancestor cache, the remembered leaves,
  the store subscription that pruned them and the projection subscription that
  filled them. The module is a third smaller and has one answer to every question
  instead of two.

  The projection is still consulted for two things it genuinely owns: whether a
  row passed the filter, and what `meta` an `isSelectable` predicate is shown.

  Leaves now come back in data order rather than in whatever order the traversal
  happened to pop them.

- 99db74d: Rename group selection to tree selection

  `GroupSelectionModule` becomes `TreeSelectionModule`, and
  `flow-grid/selection/group` becomes `flow-grid/selection/tree`.

  The module only ever understood tree data, where every row is a record in the
  store with an id of its own — the parent included. That is why `getParentId`
  maps a record to another record, and why a parent can be selected, remembered
  and reported like any other row.

  Rows produced by _grouping_ are a different shape: synthetic, standing for an
  aggregate that was never in the store, with membership following from a grouping
  key rather than a parent. Calling this one "group selection" invited the two to
  be conflated, and a grouping module will need its own answer.

  `GroupSelectionScope` becomes `TreeSelectionScope`; the scope values are
  unchanged.

- 71514cf: Give tree selection three scopes instead of a boolean

  `TreeSelectionModule`'s `groupSelectsChildren` boolean becomes `scope`, which
  says what a group row actually stands for:

  - `self` — the group row alone, standing for nothing but itself.
  - `children` — every descendant in the data, including rows the current filter
    has hidden. Requires `getParentId`, because hidden rows are absent from the
    projection entirely and the hierarchy has to be read from the data.
  - `filteredChildren` — the descendants currently projected. The default, and
    what the old `true` meant.

  The boolean could not express the difference between the last two: it was always
  scoped to the projection, so there was no way to say "tick the category, and mean
  the whole category" under an active filter.

  `filteredChildren` stays the default because it is the conservative one — it can
  only ever select rows the user can see, so a filtered view cannot quietly put
  hidden rows in a basket.

- 57c1556: Type grid state per module

  `getState()` returned `Record<string, unknown>`, so persisting and restoring a
  grid meant handling an untyped blob — even though a module already owns its
  slice at runtime, keyed by module id.

  State is now contributed the way API methods and column options are: a module
  augments `GridState` with the slice it owns, so `state.sort` exists and is typed
  when `flow-grid/sort` is imported and does not compile without it.

  No runtime change. The slices, their contents and the round trip are exactly as
  they were; this describes them in the type system.

#### Patch Changes

- 9cce1a2: Check accessibility with axe, and fix what it found

  The ARIA work was written by reading the specification and checking attributes,
  which finds what you thought to look for. axe checks the rules that exist —
  including how roles must nest — and immediately found a critical one:
  `aria-required-children`.

  The scroller carried `aria-label="Data grid"`, from when each instance was its
  own grid. A labelled `div` is exposed rather than passed through, so it stood
  between the grid and its rows as a child a grid may not have — every row was
  inside something the grid did not officially contain. The label belongs on the
  grid itself, which is where it is now.

  The browser suite runs axe over a plain grid, a treegrid, one with sorting and
  selection installed, and one with a collapsed group.

- 34308fa: Resolve workspace types from source, so a clean checkout checks

  `pnpm check` passed locally and failed in CI with 49 unresolved-module errors.
  TypeScript was following the `types` condition into `dist`, which exists on a
  machine that has built before and not on a fresh checkout — so the check was
  really testing whether stale output happened to be lying around.

  `customConditions: ["development"]` points workspace resolution at the source
  the exports map already offers, so typechecking and type-aware linting need no
  build. The published `types` are unchanged, and `build` still emits and
  validates declarations.

- 330d0aa: Tell a collapsed group apart from a filtered one

  `TreeSelectionModule` read membership off the projection, which hides two
  unrelated things: rows the filter excluded, and rows a collapsed group is not
  drawing. Only the first were ever excluded by anything.

  A group collapsed before it had been opened stood only for itself, so clicking
  it selected the category's own id — `getSelectedRows()` returned something that
  was not an instrument, while the checkbox showed a confident tick.

  Supplying `getParentId` now fixes this for every scope, not just `children`: the
  hierarchy comes from the data, and the rows that passed the filter are taken
  from the projection's filter phase rather than from what ended up on screen. So
  `filteredChildren` means descendants that passed the filter, drawn or not.

  Without `getParentId` the previous behaviour stands, since the projection
  genuinely does not contain those rows.

- 81d78a7: Index flat selection membership by row id

  Splitting selection into layers replaced a cached lookup with a linear scan.
  `FlatMembership.leavesOf` is asked what a row stands for once per rendered row,
  so the scan ran per row per render — invisible at the top of a list, and about
  15ms per instance at fifty thousand rows, because the rows on screen in a flow
  grid are the ones furthest along.

  It now keeps a Map keyed on row id, cached against the projection identity in
  the same way every other index in the package is. Twenty renders of an instance
  at fifty thousand rows went from 300ms to under 1ms once the index is built.

  Also replaces two literal NUL bytes in the source with the escape sequence that
  was meant. Behaviour is identical — it is a separator that cannot occur in a row
  id — but the raw bytes made those files read as binary, so `grep` silently
  skipped them.

- 8ab550a: Clear the focus ring when focus leaves the grid

  The grid painted its ring from the remembered focus position and nothing told it
  when focus had gone elsewhere, so a cell went on looking focused while a click
  had moved focus to something else entirely.

  Focus being _inside_ the grid is now tracked separately from _where_ it was, and
  the ring is painted only while both hold. The position survives, so the cell
  remains the grid's tab stop and Tab returns to where you were rather than to the
  first cell.

- a13617f: Make a checkbox and a row extend a range the same way

  Shift-clicking a checkbox always added to the selection, while shift-clicking a
  row cleared it first — two gestures for one idea, behaving differently.

  Both now re-cut the span: drag out to row 6, come back to row 3, and rows 4 to 6
  are given up again. Only the span is given up, so rows picked out separately by
  a plain click or a Ctrl-click survive a shift-click instead of being discarded
  with everything else. Moving the anchor starts a fresh span.

  A shift-click on an already-ticked checkbox is now a range gesture too, rather
  than a toggle that happened to skip the range.

- 6d424e5: Stop the range module inferring hierarchy from `meta.depth`

  `RowRangeModule` read `meta.depth` off the projection to work out whether a
  row's children were on screen — a convention the tree module owns, being read by
  a module that has no business knowing what a hierarchy is. It happened to work,
  and would have misbehaved silently under any module that expressed one
  differently.

  It asks selection instead, through a new `standsFor(rowId)`: the ids a row
  stands for, which is itself unless a membership module says otherwise. A row
  whose ids are themselves on screen adds nothing to a span; a row whose are not
  is the only thing that can stand for them.

  Behaviour is unchanged — clipping a group still takes only what it clipped,
  covering one takes all of it, and stopping at a heading reaches nothing past it
  — and a test now proves it holds under a membership with no depth, no parent
  ids and no tree module at all.

- 2ab19a8: Stop a span selecting a whole group it only clipped

  A range handed every row it covered to selection, which expands a group row to
  all of its children — so a span reaching two rows into a group selected the
  entire group. Crossing a boundary near the end of one category could quietly
  select the whole of the next.

  A span now covers rows. A row whose children are on screen contributes nothing
  beyond the children inside the span, since each of those is in the span in its
  own right. So a range over a whole group still takes the whole group — the same
  set as clicking its heading — while one that clips a corner takes only the corner.

  A collapsed group is unchanged: its contents are hidden behind the heading, so
  the heading stands for them.

- 49dc360: Fix unused code and a text filter over non-primitive values

  Adding a linter turned up several things that had gone unnoticed: two unused
  imports, a dead local, a vestigial `TValue` type parameter on
  `ValueGetterParams`, and a text filter that stringified any value with
  `String(value)` — so a cell holding an object contained the literal
  "[object Object]", and a search for "object" matched every one of them. Values
  with no text form now read as blank.

  `ValueGetterParams` loses its second type parameter. It was never used in the
  interface body: it was meant for `column`, which deliberately broke to `any` to
  keep `ColumnDef` covariant.

### 0.1.0

#### Minor Changes

- d56c21c: Initial release.

  A data grid web component that lays rows out horizontally: each instance is
  filled to the viewport height, then another starts beside it, so one component
  fills a wide monitor without the application building multi-pane UX. Instances
  are virtualised with an IntersectionObserver rather than rows by scroll offset.

  Core is columns, rows and a layout. Everything else — tree data, sorting,
  filtering, selection, cell flash, keyboard navigation — is an additive module
  with its own entry point, and a grid that imports none of them ships none of
  their code.

  A price tick writes one row signal and re-renders the bound cells without
  invalidating the projection or the layout. Both flow and stack layouts ship in
  core.
