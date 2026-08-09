---
'@lime-soda/grid': patch
---

Fix keyboard navigation in the stacked layout when focus is in the header.

The key handler was bound to the scroller, and the stack renders its header in
chrome above the scroller rather than inside it. So arrowing up into a stacked
header left focus somewhere no key could reach: the body navigated, the header
was inert. It is bound to the host now, so no part of the grid can sit outside
the handler, whatever chrome is added later.
