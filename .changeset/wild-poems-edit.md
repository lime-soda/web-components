---
'@lime-soda/grid': minor
---

Add `@lime-soda/grid/edit`: editing a cell in place.

A column opts in with `editable`, which also takes a predicate for the common
case that only some rows accept a change. Enter, F2, a double click or simply
typing opens an editor; Enter commits and steps down, Tab commits and steps
across, Escape discards, and focus leaving commits — losing a half-typed value
by clicking away is what people report as a bug.

Editors are custom elements, as cell renderers are. Two ship, chosen by the
column's `valueType`, and an application supplies its own with `cellEditor`. An
editor is asked only to show a value and say when it changed, so it needs to
know nothing about the store. A column whose value comes from a `valueGetter`
has no field to write back to and needs a `valueSetter`; without one the write
is dropped rather than guessed at.

Core gains one hook for this, `cellContent`, which lets a module replace a
cell's content rather than bracket it. At most one module may claim a cell.
