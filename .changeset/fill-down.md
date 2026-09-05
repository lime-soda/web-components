---
'@lime-soda/grid': minor
---

Fill down with Ctrl-D.

Copies the top row of the cell range down through the rest of it, or — with no
range — the focused cell from the row above, which is what Ctrl-D means to
anyone arriving from a spreadsheet. On by default, and available as
`api.fillDown()`.

The key is claimed only when there is something to fill, so on the first row of
a grid it is left to the browser rather than taken and wasted.

Values rather than text: a fill is not a round trip through the clipboard, so a
number stays a number and a column whose value is an object survives being
filled.
