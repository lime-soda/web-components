---
'flow-grid': minor
---

Let modules declare selection behaviour instead of installing it

`SelectionModule` exposed setters that other modules called to replace its
behaviour, passing their own id along so a clash could be reported. That put the
wiring in the wrong place: a module reached into another module, the outcome
depended on registration order, and the id was a string that had to agree with
the module it named.

Behaviour is now a property of the module. `TreeSelectionModule` implements
`provideSelectionMembership()` and `RowRangeModule` implements
`provideSelectionRange()`; core selection looks for the module that provides
each, and refuses to start when two provide the same one, naming both.

`ModuleContext` gains `getModules()`, which is what makes finding a capability
possible without knowing an id in advance.

Core still answers both questions when nothing provides them, so plain row
selection remains a single module.
