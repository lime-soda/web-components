# @lime-soda/button

## 0.2.0

### Minor Changes

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

- 553a975: Move to standard (TC39) decorators, and add a browser test suite.

  Reactive properties are now declared with the `accessor` keyword. This is a
  change to the published output, not just the source: `size` and `variant` are
  accessors rather than plain fields, so a subclass that overrode either as a
  field would now shadow the reactive one. The rendered markup, attributes and
  events are unchanged.

  The whole repository now uses one decorator dialect, so `@lime-soda/tsconfig`
  is the single base config and the grid no longer needs its own.

  The package also gains a `development` export condition, so Storybook and other
  workspace consumers resolve it to source and pick up a change without a build
  step, and a Chromium test suite that runs axe over every size and variant
  alongside focus and reactivity assertions.

  Fixed while migrating: `build-component` emitted at esbuild's default `esnext`
  target, which left `accessor` in the published JavaScript as syntax no bundler
  can parse. It now targets ES2022.

- 1f65a00: Close the last gaps between the two components' theming.

  The button's focus ring was two hard-coded widths and a colour borrowed from the
  primary variant; it is now `--button-focus-width`, `--button-focus-offset` and
  `--button-focus-color`, with the disabled opacity tokenised alongside. No
  literal values remain in either component's styles.

  The grid's nine control knobs — expander size, sort indicator and badge sizes,
  filter input width, padding and font size, instance border width and disabled
  opacity — were literals inlined as `var()` fallbacks, which made them the only
  part of its appearance the design system could not reach. They are design tokens
  now and part of the public `GridTheme`, which grows from 27 to 36 tokens. The
  test that keeps the schema and the design tokens in step covers them, so the
  exemption list they used to sit on is gone.

### Patch Changes

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

- 19d2eac: Give every variant the same border box, so an outline button is no longer 2px
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

- e50b72d: Build with `tsc` instead of the esbuild wrapper, so one pass emits both the
  JavaScript and the declarations. The published output is equivalent.
- Updated dependencies [004aa74]
- Updated dependencies [7f573d4]
- Updated dependencies [f603a80]
  - @lime-soda/tokens@0.2.0

## 0.1.0

### Minor Changes

- c5b035d: Initial release version

### Patch Changes

- Updated dependencies [c5b035d]
  - @lime-soda/tokens@0.1.0
