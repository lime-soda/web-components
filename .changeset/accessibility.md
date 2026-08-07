---
'flow-grid': minor
---

Report the grid's shape to assistive technology, and treegrid for tree data

The roles were there — `grid`, `row`, `columnheader`, `gridcell` — but none of
the counting attributes, which matter more here than in a conventional grid
because rows are spread across instances. Without them a reader is told only
about the markup that happens to exist.

Each instance now carries `aria-rowcount` and `aria-colcount` describing what it
holds, rows carry `aria-rowindex` counting from the header, and cells and header
cells carry `aria-colindex`.

With `TreeModule` installed the role becomes `treegrid`, and rows carry
`aria-level` and `aria-expanded` — the latter on the row, where a treegrid looks
for it, rather than only on the expander button. The module declares the role
through a new `provideGridRole` capability; core cannot infer it without reading
a hierarchy convention it does not own.

Rows are laid out with `subgrid` rather than `display: contents`, so a row
carrying `role="row"` is a real element rather than one with no box.
