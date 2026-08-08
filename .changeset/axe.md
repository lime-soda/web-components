---
'flow-grid': patch
---

Check accessibility with axe, and fix what it found

The ARIA work was written by reading the specification and checking attributes,
which finds what you thought to look for. axe checks the rules that exist —
including how roles must nest — and immediately found a critical one:
`aria-required-children`.

The scroller carried `aria-label="Data grid"`, from when each instance was its
own grid. A labelled `div` is exposed rather than passed through, so it stood
between the grid and its rows as a child a grid may not have — every row was
inside something the grid did not officially contain. The label belongs on the
grid itself, which is where it is now.

The browser suite runs axe over a plain grid, a treegrid, one with sorting and
selection installed, and one with a collapsed group.
