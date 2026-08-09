---
'@lime-soda/tokens': minor
'@lime-soda/grid': minor
---

Give selection a single accent at the theme level.

`theme.color.accent` is the colour of a control in its selected state, and
`theme.color.accentSubtle` the wash behind a selected row. Both follow the
primary by default, so retargeting selection across every component is one
value rather than a hunt.

The token stylesheet also sets `accent-color` on `:root`. That is the one thing
a custom property cannot do on its own — nothing else paints the tick inside a
native checkbox or the thumb of a range — so an application's own form controls
now match the components without wiring anything up per control.

The grid picks both up. Its checkbox was borrowing `--grid-focus`, which meant a
ticked box was the focus-ring colour: a ring says "the keyboard is here" and an
accent says "this is on", and they should not be the same statement. Its
selected-row wash was mixed from the info blue and is now the accent, at 12% in
light and 22% in dark — one figure does not read in both. Text over a selected
row clears AA either way, at 16.8:1 and 14.0:1.
