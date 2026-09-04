---
'@lime-soda/grid': minor
---

Add a floating filter row: `new FilterModule({ floatingFilter: true })`.

A strip of filter boxes beneath the column headings, which is the answer to the
problem `headerUi` has — a trading grid's columns are 80-100px, and a box
sharing that line with the label crushes the label to an initial. Given a strip
of its own, a box fits any column. Opt-in, and `floatingFilterHeight` sets how
tall it is.

Core gains a `HeaderBandProvider` capability for it: a module declares a band's
height and its content per column, and the height reaches the layout engine so
the rows below are sized knowing the band is there.
