---
'@lime-soda/grid': minor
---

Add `@lime-soda/grid/clipboard`: copy to the clipboard, and CSV or TSV export.

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
