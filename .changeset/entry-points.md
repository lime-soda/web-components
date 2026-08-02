---
'flow-grid': minor
---

Give each layout its own entry point, and keep the root free of side effects

The root entry registers nothing and provides no layout. Importing a type,
subclassing an element or swapping one through an import map cannot put a grid
in the custom element registry as a consequence.

A working grid comes from an entry that provides one, and each registers the
elements so a single import is enough:

- `flow-grid/flow` — the horizontal layout
- `flow-grid/stack` — the vertical layout
- `flow-grid/layouts` — every layout, switchable through `layout`

The grid controller no longer names both engines and picks with a ternary; an
entry point registers what it provides, and asking for a layout that was not
registered throws, naming the import that would provide it.

Choosing one layout saves about 0.3 kB gzipped. The engine is excluded; the grid
element's own stack chrome is a branch inside a class rather than a separate
module, so it stays either way.
