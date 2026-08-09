---
'@lime-soda/tokens': minor
'@lime-soda/button': minor
'@lime-soda/grid': minor
---

Repoint the base theme at trading interfaces.

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
