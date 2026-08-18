---
'@lime-soda/grid': minor
---

Draw each border once, and rule the columns the whole way down.

A row separator is a cell's bottom border, so on the last row of a container it
had nothing to separate and landed on the container's own bottom edge — two
lines a pixel apart at the foot of every instance and of the stack layout's
body. The last row no longer draws one. The stack layout's sticky group band is
the exception and says so: its last row is not at a container edge, and that
separator is the only thing dividing the pinned heading from the rows moving
under it. The band drops its own bottom border instead, keeping its sides so the
body's outline runs unbroken through the row it covers.

Cells now carry the column rule their headings already had. It stopped at the
bottom of the header, so a grid was ruled into columns for forty pixels and then
dissolved.
