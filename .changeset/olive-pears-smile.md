---
'@lime-soda/button': patch
---

Give every variant the same border box, so an outline button is no longer 2px
wider and taller than a filled one beside it in a toolbar.

A button is intrinsically sized, so a border on the outline variant alone adds
twice its width to the box. The filled and ghost variants now carry the same
border with a transparent colour. Drawing it inside with an inset `box-shadow`
would equalise the boxes too, but inset shadows are dropped in forced-colors
mode where borders survive, and an outline button would lose its only visible
boundary there.

The button's browser tests now load the token stylesheet. Without it every
`--theme-*` and `--size-*` reference was undefined, so the outline's border
never applied and the component was measured — and checked with axe — unstyled.
