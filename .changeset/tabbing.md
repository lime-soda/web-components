---
'flow-grid': minor
---

Move a cell at a time on Tab

Tab left the grid entirely: the roving tabindex makes it one tab stop, so the
first press moved focus past the whole thing.

Tab now walks cells in reading order — along the row, on to the next, into the
next instance, taking in each header where reading order puts it — and
Shift-Tab reverses it. At either end the key is deliberately left unhandled so
focus leaves the grid; a grid that cannot be tabbed out of is a trap.

`skipRow` does not apply to Tab. It says where the arrows come to rest, and a
row Tab could not reach would be a row no keyboard could reach.
