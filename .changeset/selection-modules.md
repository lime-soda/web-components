---
'flow-grid': minor
---

Split selection into row selection, tree selection and row ranges

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
