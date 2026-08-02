---
'flow-grid': minor
---

Give tree selection three scopes instead of a boolean

`TreeSelectionModule`'s `groupSelectsChildren` boolean becomes `scope`, which
says what a group row actually stands for:

- `self` — the group row alone, standing for nothing but itself.
- `children` — every descendant in the data, including rows the current filter
  has hidden. Requires `getParentId`, because hidden rows are absent from the
  projection entirely and the hierarchy has to be read from the data.
- `filteredChildren` — the descendants currently projected. The default, and
  what the old `true` meant.

The boolean could not express the difference between the last two: it was always
scoped to the projection, so there was no way to say "tick the category, and mean
the whole category" under an active filter.

`filteredChildren` stays the default because it is the conservative one — it can
only ever select rows the user can see, so a filtered view cannot quietly put
hidden rows in a basket.
