---
'@lime-soda/grid': patch
---

Keep the flow layout reachable by Tab after scrolling.

The grid's single tab stop was anchored to one instance, and the flow layout
releases instances as they leave the viewport. Scroll far enough and the anchor
named a placeholder: no rendered cell was tabbable, the scroller held no
focusable content — `scrollable-region-focusable` — and a keyboard user could
not reach what was on screen.

The tab stop now falls back to the first cell that is actually built. The
remembered position is kept, so Tab still returns to the cell you left once its
instance is back on screen; only the stop moves while it is away.
