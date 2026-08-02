---
'flow-grid': minor
---

Rename the package to `flow-grid`

`@flow-grid/core` held the whole grid — tree, sort, filter, selection, keyboard
and cell-flash — which made the name a contradiction: "core" reads as the
minimal thing, and it was the shipping unit.

The package is now `flow-grid`, and "core" means what it always meant: the `.`
entry, the grid with no modules installed.

```ts
import 'flow-grid/define';
import { TreeModule } from 'flow-grid/tree';
```

Nothing else moves. The entry points, their contents and the tree-shaking are
unchanged; `@flow-grid/core` was only ever published at 0.1.0 and should be
treated as deprecated.
