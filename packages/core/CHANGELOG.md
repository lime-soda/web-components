# @flowgrid/core

## 0.1.0

### Minor Changes

- d56c21c: Initial release.

  A data grid web component that lays rows out horizontally: each instance is
  filled to the viewport height, then another starts beside it, so one component
  fills a wide monitor without the application building multi-pane UX. Instances
  are virtualised with an IntersectionObserver rather than rows by scroll offset.

  Core is columns, rows and a layout. Everything else — tree data, sorting,
  filtering, selection, cell flash, keyboard navigation — is an additive module
  with its own entry point, and a grid that imports none of them ships none of
  their code.

  A price tick writes one row signal and re-renders the bound cells without
  invalidating the projection or the layout. Both flow and stack layouts ship in
  core.
