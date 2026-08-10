---
'@lime-soda/cem-plugin-css-properties': patch
---

Ship the type declarations the package already promised.

`package.json` pointed `types` at `dist/index.d.ts`, but the build emitted only
JavaScript — declarations came from a separate `build:types` script that nothing
ran. The one build now emits both, as the component packages do.
