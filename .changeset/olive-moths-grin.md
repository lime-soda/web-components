---
'@lime-soda/grid': patch
---

Fix `aria-hidden-focus` on the rows and headers a continuation instance repeats.

Both were hidden from assistive tech while staying focusable, which is a
contradiction — and they needed opposite fixes.

A continuation's header is now real. Focus goes to each instance's own header
deliberately, and once the reader has scrolled right every header on screen is a
continuation, so hiding them put sorting and filtering beyond both the mouse and
the keyboard. Each instance is its own rowgroup, so a heading row is honest;
only the first claims `aria-rowindex="1"`.

A repeated ancestor row is now `inert` and skipped by keyboard navigation. That
one really is a second drawing of a row already present, so the copy cannot be
operated while the original still can be.

The grid's Storybook stories now gate on accessibility rather than carrying this
as a known exception.
