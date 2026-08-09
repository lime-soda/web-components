---
'@lime-soda/tokens': minor
'@lime-soda/button': patch
'@lime-soda/grid': patch
---

Make the focus ring its own semantic token, and the same colour in both
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
