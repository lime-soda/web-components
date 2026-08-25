---
'@lime-soda/grid': patch
---

Tell a reader a cell range exists, and stop the active cell competing with it.

Cells in a range now carry `aria-selected`, and the grid carries
`aria-multiselectable` when something installed can hold more than one selection
— row selection in multi mode says so too, which it never did. Before this the
rectangle existed only for people who could see the tint.

The cell the caret is in is drawn in the range's own colours: no tint, and its
ring recoloured from the design system's focus colour to the accent the
rectangle is drawn in. It was both tinted and ringed, in a different hue from
the block it sat in, so it read as something else entirely rather than as the
caret inside the selection.
