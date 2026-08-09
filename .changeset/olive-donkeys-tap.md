---
'@lime-soda/grid': minor
---

Take theming from the design system rather than from a stylesheet of its own.

Every `--grid-*` property is now a design token declared in
`support/tokens/components/grid.json` against the semantic tier, so the grid
inherits the palette, the spacing scale and the light/dark pair the rest of the
system uses. The host adopts those declarations the way the button does.

Breaking, though nothing is published on the old name:

- Custom properties are `--grid-*`, not `--ls-grid-*`, matching the convention
  that names them after the element minus its `ls-` prefix
- `@lime-soda/grid/themes/grid.css` is gone, and with it the
  `prefers-color-scheme` block and the `data-ls-grid-theme` override. Light and
  dark now follow `color-scheme`, because the semantic tier resolves through CSS
  `light-dark()`
- An application must load `@lime-soda/tokens/variables.css`. The grid used to
  carry a literal fallback for every colour and size; those are gone, so the
  tokens are the only source of its appearance

The `theme` option is unchanged: a `GridTheme` object still overrides any token
on the host, and is still validated against the same schema. A test now checks
that schema against the design tokens themselves, in both directions, so a token
cannot exist on the type with nothing behind it or in the design system with
nothing reading it.

The published manifest describes the elements for the first time — they are
registered imperatively rather than with a decorator, so the analyser had no tag
names to find — and `ls-grid` documents all 27 themeable properties with their
descriptions and defaults.
