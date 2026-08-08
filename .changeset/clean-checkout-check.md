---
'flow-grid': patch
---

Resolve workspace types from source, so a clean checkout checks

`pnpm check` passed locally and failed in CI with 49 unresolved-module errors.
TypeScript was following the `types` condition into `dist`, which exists on a
machine that has built before and not on a fresh checkout — so the check was
really testing whether stale output happened to be lying around.

`customConditions: ["development"]` points workspace resolution at the source
the exports map already offers, so typechecking and type-aware linting need no
build. The published `types` are unchanged, and `build` still emits and
validates declarations.
