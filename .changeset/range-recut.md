---
'flow-grid': patch
---

Make a checkbox and a row extend a range the same way

Shift-clicking a checkbox always added to the selection, while shift-clicking a
row cleared it first — two gestures for one idea, behaving differently.

Both now re-cut the span: drag out to row 6, come back to row 3, and rows 4 to 6
are given up again. Only the span is given up, so rows picked out separately by
a plain click or a Ctrl-click survive a shift-click instead of being discarded
with everything else. Moving the anchor starts a fresh span.

A shift-click on an already-ticked checkbox is now a range gesture too, rather
than a toggle that happened to skip the range.
