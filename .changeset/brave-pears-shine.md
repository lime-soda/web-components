---
'@lime-soda/grid': patch
---

Fix two things assistive tech was being told wrongly.

Cells had no `role`. A `role="grid"` whose rows contain unroled elements is not
a grid, and a screen reader moving through it found rows of nothing. They are
`gridcell` now.

A column heading took its accessible name from its contents, so every control a
module put in the header joined it — with sorting and column arranging
installed, "Price" was announced as "Price Move Price Resize Price". A heading
is now named for its column, so the affordances stop describing the data.
