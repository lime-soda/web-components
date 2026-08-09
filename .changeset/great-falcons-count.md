---
'@lime-soda/grid': minor
---

Default to a trading density, and set figures in tabular widths.

Rows are 24px rather than 32px, cells 12px and headers 11px, so a monitor holds
roughly a third more instruments.

`numericVariant` is a new theme token, resolving to `tabular-nums slashed-zero`.
Tabular widths mean every digit takes the same advance, so a column of prices
aligns on the decimal without being set in a monospace face, and a number does
not visibly reflow as it ticks. The slashed zero is for instrument codes, where
`0` and `O` sit next to each other. It replaces a hard-coded
`font-variant-numeric: tabular-nums` in the cell, so it is now themeable and
documented in the manifest like every other token.
