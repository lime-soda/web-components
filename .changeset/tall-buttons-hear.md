---
'@lime-soda/grid': minor
---

Make arrow-key navigation part of core rather than an optional module.

The grid announces `role="grid"`, and the ARIA pattern for that role requires
arrow navigation: assistive technology tells the user this is a grid and that
arrows move around it. With navigation in an optional module, a default grid
made that announcement and then ignored every arrow — an incorrect
announcement, not a missing convenience.

Core now handles the four arrows, Tab in reading order, and Escape. Tab is here
for a separate reason: it is allowed to run out at either end so focus leaves
the grid, and a grid you cannot Tab out of is a keyboard trap under WCAG 2.1.2
whatever role it claims.

The keyboard module keeps everything the pattern lists as optional — Home and
End, the page keys, instance jumps, and the skip-row predicate — and is still
offered every key first, so installing it replaces the floor rather than
competing with it. Nothing changes for a grid that already imports it.

Core grows 0.2 kB gzipped. The module still costs 0.6 kB.
