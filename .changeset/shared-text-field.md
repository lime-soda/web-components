---
'@lime-soda/grid': patch
---

Share one text field between cell editing and column filtering.

The editors and the filter each rendered their own input, with their own
padding, border, focus treatment and accessible-name plumbing — which is how the
editors came to be missing a name at all. `ls-grid-text-field` owns the box and
the value; keys stay with whoever put it there, because an editor wants Enter,
Tab and Escape and a filter wants the grid never to see them.

`type` is passed through, so a filter is still announced as a searchbox and an
editor as a textbox.

No new tokens: every value a field needs was already described by one.
