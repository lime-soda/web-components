---
'@lime-soda/grid': minor
---

Add `valueType` to a column: `text`, `number`, `date` or `boolean`.

It decides which edge the value sits against and how it reads when nothing
formats it — numbers to the right with their separators, dates in the reader's
format, booleans centred and in words. A `valueFormatter` still wins, and
`align` overrides the edge on its own.

Declaring nothing keeps the current behaviour, so this changes no existing grid.

Fixes a right-alignment rule that had been in the cell's stylesheet with nothing
able to set it: every column of numbers read down its left edge.
