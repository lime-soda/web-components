---
'@lime-soda/grid': patch
---

Make `::part` actually reach the grid's internals.

The README has always listed parts as the way to restyle structure, but `part`
does not cross a shadow boundary on its own — each host in between has to
forward it with `exportparts`, and nothing did. So `ls-grid::part(scroller)` and
`::part(instance)` worked, being in the grid's own shadow root, while
`::part(cell)`, `::part(row)`, `::part(header-cell)`, `::part(cell-content)` and
every module part silently matched nothing.

Forwarding now runs the whole chain — grid → instance → row → cell, and out of
cell renderers, which are a shadow root each again. Rows gain a `row` part,
which they never had.

Modules declare their part names through a new optional `parts` on the module
contract, because the elements that forward them render before any module
markup exists. `tree-expander`, `sort-indicator`, `filter-input` and
`selection-checkbox` are reachable as a result.

Seven browser tests style the grid through the host exactly as a consumer would
and read the result off the element, one per depth, so a broken link in the
chain fails rather than going quiet.
