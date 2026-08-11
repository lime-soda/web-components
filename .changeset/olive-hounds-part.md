---
'@lime-soda/grid': minor
---

Remove the deprecated `ValueGetterParams` and `ValueFormatterParams` aliases.

They were kept for one release when the cell contexts were split into three
tiers. Use `CellValueContext` for a `valueGetter` and `CellFormatContext` for a
`valueFormatter` — the aliases pointed at exactly these, so the change is a
rename.
