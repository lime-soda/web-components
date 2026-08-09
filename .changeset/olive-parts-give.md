---
'@lime-soda/grid': minor
---

Add `colSpan`, and define what a column function is given.

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
