# @lime-soda/tokens

## 0.2.0

### Minor Changes

- 004aa74: Give selection a single accent at the theme level.

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

- 7f573d4: Make the focus ring its own semantic token, and the same colour in both
  components.

  `theme.color.focus` is blue — `color.blue.600` in light, `400` in dark. It stays
  deliberately apart from the accent: an accent says "this is selected" and a ring
  says "the keyboard is here", and a keyboard user needs to tell those apart on
  the same row.

  It also stops both components borrowing a semantic that means something else.
  The grid reached through `theme.color.info`, so restyling an informational
  banner would have moved every focus ring; the button reached through the primary
  and so had a teal ring where the grid had a blue one. Both now point at the same
  token.

  The ring clears the WCAG 2.2 non-text threshold of 3:1 everywhere it lands:
  5.17:1 on the page, 4.95:1 on a raised surface and 4.37:1 on a selected row in
  light mode, and 7.83 / 6.97 / 5.74 in dark.

- f603a80: Repoint the base theme at trading interfaces.

  The palette was a bright green and a bright pink — opinionated, and hard to sit
  in front of all day next to coloured market data. The primary is now a muted
  teal and the secondary a warm taupe, with a neutral grey ramp in place of the
  blue-tinted one, so the chrome stays out of the way of the data on top of it.

  Every foreground and background pairing in the semantic tier now clears WCAG AA
  in both modes, the tightest at 5.48:1. The old white-on-green was 2.27:1. Part
  of the fix is that the accent label inverts between modes — white on the darker
  light-mode teal, near-black on the lighter dark-mode one — because white on a
  light accent cannot pass. The button's Storybook accessibility check is back to
  failing the build rather than merely reporting.

  Everything is a step denser, which is the point of a trading surface: 13px body
  text where it was 16px, component spacing from 2px to 16px where it was 4px to
  32px, and tighter corner radii.

  Breaking: `color.green` and `color.pink` no longer exist, and every `theme.*`
  value has moved. Anything referencing the primitives by name needs updating;
  anything referencing the semantic tier keeps working and simply looks different.

## 0.1.0

### Minor Changes

- c5b035d: Initial release version
