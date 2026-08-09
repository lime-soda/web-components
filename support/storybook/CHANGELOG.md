# @lime-soda/storybook

## 0.1.1

### Patch Changes

- 5c318d0: Build the grid story's toolbar from `ls-button` rather than bare `<button>`
  elements, so the two components are shown together and the story stops carrying
  a private copy of button styling. The search input keeps local styles — there is
  no input component yet — but on tokens rather than the literals it had.
- 5bd95c9: Stop the button's click story capturing a focus ring.

  Clicking leaves the button focused, the snapshot is taken after the play
  function, and an `outline` sits outside the element's box — which a screenshot
  cropped to that box clips. Whether `:focus-visible` matches a synthetic click is
  a modality heuristic besides, so the ring came and went between runs and flagged
  a diff each time.

  That story is about the click handler firing, so it now blurs afterwards. A new
  `Focus ring` story shows the state deliberately, focused by keyboard so
  `:focus-visible` matches reliably, with room around the button for the ring to
  be captured whole.

- Updated dependencies [004aa74]
- Updated dependencies [c061be6]
- Updated dependencies [216ebd5]
- Updated dependencies [05050dd]
- Updated dependencies [f603a80]
- Updated dependencies [c893589]
- Updated dependencies [786da6d]
- Updated dependencies [7f573d4]
- Updated dependencies [e50b72d]
- Updated dependencies [4660828]
- Updated dependencies [7b8ad6b]
- Updated dependencies [19d2eac]
- Updated dependencies [e50b72d]
- Updated dependencies [f603a80]
- Updated dependencies [2edb37b]
- Updated dependencies [2593a93]
- Updated dependencies [553a975]
- Updated dependencies [1f65a00]
- Updated dependencies [decdf55]
  - @lime-soda/tokens@0.2.0
  - @lime-soda/grid@0.1.0
  - @lime-soda/button@0.2.0

## 0.1.0

### Minor Changes

- c5b035d: Initial release version

### Patch Changes

- Updated dependencies [c5b035d]
  - @lime-soda/button@0.1.0
  - @lime-soda/tokens@0.1.0
