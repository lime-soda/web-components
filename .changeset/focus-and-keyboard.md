---
'@flow-grid/core': minor
---

Make focus visible, reachable and skippable

The focus ring was `:focus-visible`, which by design never matches a mouse click,
so a clicked cell was genuinely focused — arrows moved from it, screen readers
followed it — while looking exactly like an unfocused one. The grid tracks focus
itself and now paints from its own state. The grid also gained a tab stop, so it
can be reached by keyboard at all.

Arrow keys reach header cells, but only backwards: up from the first row enters
that instance's header, while down and forwards always land on data.
`CellPosition` gains a required `section` of `'header'` or `'body'`.

`KeyboardModule` accepts a `skipRow` predicate for rows to pass over rather than
land on. The predicate always comes from the consumer — there is deliberately no
`skipParentRows` flag, which would require the module to know what a parent row is.

The rightmost column no longer has its focus ring clipped: an instance is sized
to its columns, and its border is now added around that rather than eaten out of
it.
