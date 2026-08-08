---
'@lime-soda/grid': minor
---

Rename the package to `@lime-soda/grid` and the elements to the `ls-` prefix.

The grid was developed in a separate repository as `flow-grid` and reached
0.2.0 there, but the release never published: npm normalises `flow-grid` to
`flowgrid`, which is taken. Publishing under a scope removes the collision, and
the design system's scope is where the grid belongs — it is a web component
alongside `@lime-soda/button`.

Everything user-facing moves with it, so that a consumer sees one vendor rather
than two:

- elements: `<flow-grid>` → `<ls-grid>`, and likewise `ls-grid-instance`,
  `ls-grid-row`, `ls-grid-cell`, `ls-grid-header-cell`
- classes: `FlowGrid` → `Grid`, `FlowRow` → `GridRow`, `FlowCell` → `GridCell`,
  `FlowInstance` → `GridInstance`, `FlowHeaderCell` → `GridHeaderCell`
- events: `flow-grid-ready` → `ls-grid-ready`, `flow-sort-changed` →
  `ls-grid-sort-changed`, and the rest of the `flow-*` events
- custom properties: `--flow-*` → `--ls-grid-*`
- theme: `flow-grid/themes/flow-grid.css` → `@lime-soda/grid/themes/grid.css`

`FlowLayoutEngine` and the `@lime-soda/grid/flow` entry point keep their names:
they refer to the horizontal flow layout, which is still what they do.

Since 0.2.0 was never published there is no upgrade path to write — nothing
downstream can be on the old name.
