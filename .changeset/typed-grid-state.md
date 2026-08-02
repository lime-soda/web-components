---
'flow-grid': minor
---

Type grid state per module

`getState()` returned `Record<string, unknown>`, so persisting and restoring a
grid meant handling an untyped blob — even though a module already owns its
slice at runtime, keyed by module id.

State is now contributed the way API methods and column options are: a module
augments `GridState` with the slice it owns, so `state.sort` exists and is typed
when `flow-grid/sort` is imported and does not compile without it.

No runtime change. The slices, their contents and the round trip are exactly as
they were; this describes them in the type system.
