---
'@lime-soda/grid': minor
---

Let a modified click select, so a pointer can always reach selection.

`checkboxColumn` defaults on and `clickToSelect` defaults off, which together
left a grid configured with no checkbox column selectable by keyboard and inert
to a mouse — the pair of defaults was reachable, and broken, without setting
anything unusual.

Ctrl-click, or Cmd-click on macOS, now selects whatever `clickToSelect` says.
That keeps the plain click free to mean something else in the application —
opening a detail panel, say — which is why the option stays off by default, and
it means the option never has to be turned on merely to make selection possible.

`clickSelects` still reports the plain click alone, since a range module reads
it to decide whether to agree with row clicks.
