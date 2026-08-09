---
'@lime-soda/grid': patch
---

Document the parts and events in the manifest.

`::part()` is the supported way to restyle structure and the manifest is what
the MCP server and editor integrations read, so the grid publishing sixteen
reachable parts and describing none of them meant nobody could find them. The
analyser reports what `@csspart` and `@fires` tags tell it, and the grid had
neither.

`ls-grid` now documents all sixteen parts and eight events. Child elements carry
their own, and the host repeats the full set deliberately: a consumer writes
`ls-grid::part(cell)`, never `ls-grid-row::part(cell)`, so the host is where the
whole list belongs.

Four tests keep it honest, in both directions — every rendered part is
documented, everything forwarded is documented, nothing documented has been
renamed away, and the host lists the complete set. They read the source rather
than the built manifest so they pass on a clean checkout.
