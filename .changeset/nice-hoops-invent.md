---
'@lime-soda/grid': minor
---

Always leave a pointer route to selection.

`checkboxColumn` defaulted on and `clickToSelect` defaulted off, so turning the
checkboxes off left the module with no mouse affordance at all: rows were
selectable by keyboard and inert to a pointer, which reads as the module being
broken rather than as an option being unset.

`clickToSelect` now defaults to whether the checkbox column is absent. With
checkboxes there, a row click is still left alone — it is free to mean something
else, such as opening a detail panel. Setting the option explicitly overrides
either way, and setting it back to `undefined` returns it to deriving.

Anyone relying on `checkboxColumn: false` leaving row clicks inert should now
pass `clickToSelect: false`.
