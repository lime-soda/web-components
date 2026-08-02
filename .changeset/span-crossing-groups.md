---
'flow-grid': patch
---

Stop a span selecting a whole group it only clipped

A range handed every row it covered to selection, which expands a group row to
all of its children — so a span reaching two rows into a group selected the
entire group. Crossing a boundary near the end of one category could quietly
select the whole of the next.

A span now covers rows. A row whose children are on screen contributes nothing
beyond the children inside the span, since each of those is in the span in its
own right. So a range over a whole group still takes the whole group — the same
set as clicking its heading — while one that clips a corner takes only the corner.

A collapsed group is unchanged: its contents are hidden behind the heading, so
the heading stands for them.
