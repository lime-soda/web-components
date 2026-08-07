---
'flow-grid': patch
---

Stop the range module inferring hierarchy from `meta.depth`

`RowRangeModule` read `meta.depth` off the projection to work out whether a
row's children were on screen — a convention the tree module owns, being read by
a module that has no business knowing what a hierarchy is. It happened to work,
and would have misbehaved silently under any module that expressed one
differently.

It asks selection instead, through a new `standsFor(rowId)`: the ids a row
stands for, which is itself unless a membership module says otherwise. A row
whose ids are themselves on screen adds nothing to a span; a row whose are not
is the only thing that can stand for them.

Behaviour is unchanged — clipping a group still takes only what it clipped,
covering one takes all of it, and stopping at a heading reaches nothing past it
— and a test now proves it holds under a membership with no depth, no parent
ids and no tree module at all.
