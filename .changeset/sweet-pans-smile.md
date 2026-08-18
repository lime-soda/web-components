---
'@lime-soda/grid': patch
---

Give the selection column's heading a name.

A word above a column of tickboxes is noise, so the column carries no visible
text — which left its heading with no accessible name at all, and axe reporting
`empty-table-header`. In multi mode the select-all control happened to supply
one; in single mode there is no such control and the heading was anonymous.

It now carries its name as visually hidden text, read aloud and never drawn. An
`aria-label` does not satisfy the rule, which asks for content.
