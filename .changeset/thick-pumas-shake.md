---
'@lime-soda/button': minor
'@lime-soda/grid': minor
---

Close the last gaps between the two components' theming.

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
