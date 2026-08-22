---
'@lime-soda/grid': patch
---

Fix cell ranges doing nothing from the keyboard when the keyboard module is
installed.

Shift-arrow drew a single cell and never grew it. The registry offers a key
press to each module until one reports it handled, and the keyboard module
claimed every arrow — so the range module, registered after it, was never
offered the press. A shifted arrow is not navigation, and the keyboard module
now declines it. With nothing installed to extend a range, it falls through to
core's navigation floor and still moves.

An unshifted arrow had the same problem in reverse: the range could not clear on
a key it was never given, so a rectangle stayed drawn while the caret walked out
of it. It reads the focus position instead, which is state both modules agree on
however it got there. Pressing a cell also moves the caret to it, as clicking
one already did.
