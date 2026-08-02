---
'@flow-grid/core': patch
---

Fix unused code and a text filter over non-primitive values

Adding a linter turned up several things that had gone unnoticed: two unused
imports, a dead local, a vestigial `TValue` type parameter on
`ValueGetterParams`, and a text filter that stringified any value with
`String(value)` — so a cell holding an object contained the literal
"[object Object]", and a search for "object" matched every one of them. Values
with no text form now read as blank.

`ValueGetterParams` loses its second type parameter. It was never used in the
interface body: it was meant for `column`, which deliberately broke to `any` to
keep `ColumnDef` covariant.
