---
'flow-grid': minor
---

Rename group selection to tree selection

`GroupSelectionModule` becomes `TreeSelectionModule`, and
`flow-grid/selection/group` becomes `flow-grid/selection/tree`.

The module only ever understood tree data, where every row is a record in the
store with an id of its own — the parent included. That is why `getParentId`
maps a record to another record, and why a parent can be selected, remembered
and reported like any other row.

Rows produced by _grouping_ are a different shape: synthetic, standing for an
aggregate that was never in the store, with membership following from a grouping
key rather than a parent. Calling this one "group selection" invited the two to
be conflated, and a grouping module will need its own answer.

`GroupSelectionScope` becomes `TreeSelectionScope`; the scope values are
unchanged.
