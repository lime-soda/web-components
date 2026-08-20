---
'@lime-soda/grid': patch
---

`EditModule.setOptions`, so editing can be reconfigured after registration.

Every other module has this. A grid keeps the modules it was given, so changing
a setting by constructing a new one leaves the new instance unregistered and the
setting apparently ignored. An edit open under the old rules is closed rather
than left open on a column that may no longer be editable.
