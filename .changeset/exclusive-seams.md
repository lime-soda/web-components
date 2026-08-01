---
'@flow-grid/core': minor
---

Make the selection seams exclusive claims

`setMembership` and `setRangeHandler` were setters: a module reached into core
selection and replaced its behaviour, and a second module doing the same
silently won. Nothing broke while one module claimed each, but a grouping
selection module would want membership for a different definition entirely, and
a grid installing both would have behaved like whichever registered last.

They are now `claimMembership(claimedBy, ...)` and
`claimRangeHandler(claimedBy, ...)`. A second claimant throws, naming both
modules; the holder may re-claim what it already holds, and releasing frees it
for someone else. Two modules with different ideas of what a row id stands for
are not composable, so the grid says so at registration.

Core still answers both questions when nothing has claimed them, so plain row
selection remains a single module.
