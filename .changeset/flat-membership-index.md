---
'@flow-grid/core': patch
---

Index flat selection membership by row id

Splitting selection into layers replaced a cached lookup with a linear scan.
`FlatMembership.leavesOf` is asked what a row stands for once per rendered row,
so the scan ran per row per render — invisible at the top of a list, and about
15ms per instance at fifty thousand rows, because the rows on screen in a flow
grid are the ones furthest along.

It now keeps a Map keyed on row id, cached against the projection identity in
the same way every other index in the package is. Twenty renders of an instance
at fifty thousand rows went from 300ms to under 1ms once the index is built.

Also replaces two literal NUL bytes in the source with the escape sequence that
was meant. Behaviour is identical — it is a separator that cannot occur in a row
id — but the raw bytes made those files read as binary, so `grep` silently
skipped them.
