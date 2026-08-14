---
'@lime-soda/grid': minor
---

Add `@lime-soda/grid/columns`: resize, reorder and pin columns.

Each header gains a grip to move the column and a handle to resize it, both
operable from the keyboard. `api.getColumnState()` and `setColumnState()`
round-trip the arrangement for persistence.

`pinned: 'left' | 'right'` holds a column against an edge in the stack layout,
and is inert in the flow layout — an instance there is sized to its own columns
and the scroller moves between instances, so nothing slides out from under the
viewport for a pinned column to stay in front of.

Modules can now rewrite the resolved columns through a `transformColumns` hook,
which is what carries all three without core knowing about any of them.
