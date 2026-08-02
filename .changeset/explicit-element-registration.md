---
'flow-grid': minor
---

Register elements explicitly instead of on import

Importing `flow-grid` no longer defines the custom elements. Call
`defineElements()`, or import `flow-grid/layouts`, which does it for you.

Importing a class now gives you the class and nothing else — no registration,
and no sibling elements dragged in behind it — so an element can be subclassed,
rendered in a test, or substituted through an import map without a grid
appearing in the registry as a consequence.

`sideEffects` was also declared as `false`, which was untrue: bundlers took it at
its word and dropped the entry outright, leaving a 105-byte bundle with no
elements defined and nothing rendered. It now lists the files that really do have
side effects, and two bundle tests hold this in place.
