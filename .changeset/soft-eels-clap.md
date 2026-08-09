---
'@lime-soda/grid': patch
---

Memoise the `exportparts` value instead of rebuilding it per cell.

Forwarding parts across the shadow boundaries means an `exportparts` string on
every row, cell, header cell and cell renderer. It was recomputed on each of
them on every render — a `flatMap` for the module parts, then a `Set`, a spread
and a `join` — even though the result changes only when the module set does. A
ticking cell rebuilt the identical string every frame.

The registry now hands back an identity-stable array of module parts, and the
string is cached against it, so a render after the first is a `WeakMap` lookup.
Tests pin it by identity rather than equality, since a correct-but-rebuilt
string would pass an equality check and still allocate.
