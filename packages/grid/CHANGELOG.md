# @lime-soda/grid

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
