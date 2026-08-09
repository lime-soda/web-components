---
'@lime-soda/grid': patch
---

Reference tokens through the generated module rather than by writing the
property names out, matching how the button consumes its own:
`${tokens.borderSubtle}` instead of `var(--grid-border-subtle)`, 56 references
across eight files.

The output is identical — the token exports are `css` literals holding exactly
that `var()` — but a mistyped name is now a compile error rather than dead CSS,
and the name is written once instead of once per use.

Raw `var()` remains only for the internal geometry a component sets and reads
itself, which has no token behind it: instance width and height, the column
template, spacer and sticky heights, scroll offset, scrollbar width and tree
depth.
