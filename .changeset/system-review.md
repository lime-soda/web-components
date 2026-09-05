---
'@lime-soda/grid': patch
---

Fixes from a review of the CSS, the part names and the module bundling.

`::part(header-band-cell)` matched nothing: the floating filter's band cell was
rendered but never added to the forwarding chain, so it never reached the host.
The range module declared a `cell-range` part it never rendered — a name in the
manifest that nothing answered to.

The cell-flash module carried hard-coded green, red and grey as fallbacks for
its design tokens: three colours from no palette in particular, in a package
whose claim is that appearance comes from tokens. A missing token now means no
flash, which is what a missing design system should look like.

Three spacing tokens — `gapSmall`, `gapMedium`, `gapLarge` — for the gaps
components were writing as literals because nothing named them.
