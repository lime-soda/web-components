---
'flow-grid': minor
---

Read the tree selection hierarchy only from the data

`TreeSelectionModule` carried two complete implementations of the same idea: one
derived from the projection, one from the store. The projection-derived path
came first and was kept as a fallback for consumers who had not supplied
`getParentId` — but it was the one that could not tell a filtered row from a
collapsed one, and it needed a remembered-membership map to paper over the
difference.

`getParentId` is now required, and the projection path is gone with everything
that propped it up: the leaf index, the ancestor cache, the remembered leaves,
the store subscription that pruned them and the projection subscription that
filled them. The module is a third smaller and has one answer to every question
instead of two.

The projection is still consulted for two things it genuinely owns: whether a
row passed the filter, and what `meta` an `isSelectable` predicate is shown.

Leaves now come back in data order rather than in whatever order the traversal
happened to pop them.
