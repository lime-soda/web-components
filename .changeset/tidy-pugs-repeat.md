---
'@lime-soda/storybook': patch
---

Stop the button's click story capturing a focus ring.

Clicking leaves the button focused, the snapshot is taken after the play
function, and an `outline` sits outside the element's box — which a screenshot
cropped to that box clips. Whether `:focus-visible` matches a synthetic click is
a modality heuristic besides, so the ring came and went between runs and flagged
a diff each time.

That story is about the click handler firing, so it now blurs afterwards. A new
`Focus ring` story shows the state deliberately, focused by keyboard so
`:focus-visible` matches reliably, with room around the button for the ring to
be captured whole.
