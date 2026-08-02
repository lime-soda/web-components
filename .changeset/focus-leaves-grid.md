---
'@flow-grid/core': patch
---

Clear the focus ring when focus leaves the grid

The grid painted its ring from the remembered focus position and nothing told it
when focus had gone elsewhere, so a cell went on looking focused while a click
had moved focus to something else entirely.

Focus being _inside_ the grid is now tracked separately from _where_ it was, and
the ring is painted only while both hold. The position survives, so the cell
remains the grid's tab stop and Tab returns to where you were rather than to the
first cell.
