---
'@lime-soda/grid': minor
---

Add `@lime-soda/grid/range`: selecting a rectangle of cells.

Drag across cells, or hold shift with the arrows, to mark out a block. The
clipboard takes it: `rows: 'range'` copies those rows and only the columns the
rectangle spans, which is the half a row-based export cannot do — three
instruments and, from them, just the two size columns. An unqualified Ctrl-C
prefers a rectangle over a row selection, because drawing one is the more
specific statement.

Separate from row selection, and the two coexist. They answer different
questions, and collapsing one into the other would make the narrowing above
impossible to express.

The clipboard finds the range through a declared capability rather than
importing the module, so either can be installed without the other.
