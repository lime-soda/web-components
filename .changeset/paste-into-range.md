---
'@lime-soda/grid': minor
---

Paste into a cell range: `new ClipboardModule({ pasteOnKeyboard: true })`.

Ctrl-V writes the clipboard into the grid, starting at the top-left of the cell
range if one is drawn and the focused cell otherwise — the same precedence
copying uses. A single value fills a whole range, which is the case people reach
for; a block is written from that corner and clipped at the grid's edges rather
than tiled.

Off by default, because a paste writes and a copy does not. It needs a module
that can write cells — the edit module — found through a declared capability, so
the clipboard still knows nothing about what a column will accept.

Text becomes the column's own type on the way in, so a number column pasted into
holds a number rather than the text of one. A cell that will not take an edit is
skipped rather than failing the paste, and the whole block is one transaction.
