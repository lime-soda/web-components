# flowgrid

[![CI](https://github.com/flow-grid-dev/flowgrid/actions/workflows/ci.yml/badge.svg)](https://github.com/flow-grid-dev/flowgrid/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/flow-grid.svg)](https://www.npmjs.com/package/flow-grid)

A horizontally-flowing data grid web component for trading platforms.

Rows fill an instance to the viewport height, then flow into another instance
beside it, so one component fills a wide monitor without the application building
multi-pane UX. Instances are virtualised with an `IntersectionObserver` rather
than rows by scroll offset.

See [`packages/core/README.md`](packages/core/README.md) for the package
documentation.

## Layout

| Path             |                                                  |
| ---------------- | ------------------------------------------------ |
| `packages/core`  | The published package: core plus all six modules |
| `apps/storybook` | Development harness and visual documentation     |
| `bench`          | Performance budgets, asserted in CI              |

## Working on it

```sh
pnpm install
pnpm --filter flow-grid exec playwright install chromium

pnpm test          # 360 tests: node for logic, Chromium for components
pnpm typecheck
pnpm bench         # performance budgets
pnpm storybook     # http://localhost:6006
```

Tests run in two projects. Pure units — the store, projection stages, layout
engines — run in node and are fast enough for a watch loop. Component tests run
in real Chromium, because the layout depends on real measurement and a real
`IntersectionObserver`, and jsdom provides neither.

## Design

The read path is rows → projection → layout, each step a memoised signal. A price
tick writes one row signal and re-renders the bound cells; it does not invalidate
the projection or the layout, so neither recomputes. Only structural change
re-runs the pipeline. The tests assert this by identity: after a tick,
`api.getLayout()` returns the same object.

Core knows nothing about hierarchy. A tree module flattens its own hierarchy into
`DisplayRow[]` and hangs each row's ancestor chain off `repeatOnBreak`; the
layout engine's entire tree-awareness is re-emitting that array when an instance
boundary splits a group. Selection derives group state from `meta.depth` the same
way. That seam is what lets tree data be genuinely optional.

No core component imports a module. Features reach the DOM through
`provideColumns`, `headerSlot`, `headerDecorator`, `cellDecorator`, `rowDecorator`,
`onKeyDown` and `apiExtension`, and a browser test asserts the converse: with
nothing imported, no expander, checkbox or sort affordance renders.

The full design document is at
[`docs/superpowers/specs/`](docs/superpowers/specs/).

## Licence

MIT
