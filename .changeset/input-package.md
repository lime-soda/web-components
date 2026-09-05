---
'@lime-soda/input': minor
'@lime-soda/grid': patch
---

Add `@lime-soda/input`: `ls-input`, a single-line text input.

Deliberately thin — it draws a box, holds a value and says what it is, and
leaves keys alone, because what a key means belongs to whoever places it. A cell
editor wants Enter, Tab and Escape; a filter box wants the grid never to see
them.

Everything visual comes from `--input-*` and the field is exposed as
`::part(field)`, which is how a host places it under its own rules. The grid's
cell editors do exactly that: they drop the border, the radius and the focus
ring and re-point the padding to the cell's, so the input fills a cell without
knowing a grid exists. Its column filters keep the input's own appearance.

The grid's private text field is gone, and with it `--grid-filter-padding` —
the input owns its padding now.
