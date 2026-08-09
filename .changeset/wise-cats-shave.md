---
'@lime-soda/grid': patch
---

Fix focus and arrow keys on the stacked layout's pinned group band.

The band is a copy of rows that are also in the body, drawn over them. It was
built as an instance with an id of its own — `${id}-sticky` — which the layout
did not contain, so a click on one of its cells put focus at a position the
focus controller could not locate. Every arrow key afterwards went unhandled,
which meant the browser scrolled the body instead of the grid moving, and a
group row reached with the keyboard showed no ring because the ring was on the
body row hidden underneath the band.

The band now carries the same id as the instance it echoes, so a position taken
from it is a real one, and a new `pinned` flag keeps its cells out of the tab
order — the rows it mirrors are already in it. As a side effect the band shows
the focus ring for the row it covers, which is the visible element.
