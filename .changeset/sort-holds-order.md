---
'@flow-grid/core': minor
---

Hold the row order while values tick

A sorted grid no longer re-orders as values change. Sorting by price on a live
feed used to stream rows past the pointer, so the row being reached for had moved
by the time the click landed.

The order is recomputed where a reorder is not a surprise: when rows are added or
removed, when the sort model changes, and on the new `api.refreshSort()`, which
re-orders against current values without touching the model. Pass
`resortOnValueChange: true` to `SortModule` for the previous behaviour.

A tick now costs the same sorted as unsorted, since the projection is not
invalidated at all.
