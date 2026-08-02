---
'flow-grid': patch
---

Tell a collapsed group apart from a filtered one

`TreeSelectionModule` read membership off the projection, which hides two
unrelated things: rows the filter excluded, and rows a collapsed group is not
drawing. Only the first were ever excluded by anything.

A group collapsed before it had been opened stood only for itself, so clicking
it selected the category's own id — `getSelectedRows()` returned something that
was not an instrument, while the checkbox showed a confident tick.

Supplying `getParentId` now fixes this for every scope, not just `children`: the
hierarchy comes from the data, and the rows that passed the filter are taken
from the projection's filter phase rather than from what ended up on screen. So
`filteredChildren` means descendants that passed the filter, drawn or not.

Without `getParentId` the previous behaviour stands, since the projection
genuinely does not contain those rows.
