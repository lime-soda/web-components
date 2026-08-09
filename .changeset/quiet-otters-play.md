---
'@lime-soda/button': patch
---

Build with `tsc` instead of the esbuild wrapper, so one pass emits both the
JavaScript and the declarations. The published output is equivalent.
