---
'@lime-soda/grid': patch
'@lime-soda/button': patch
---

Stop publishing the `development` export condition.

The workspace resolves its own packages through a `development` condition
pointing at TypeScript source, so one package importing another gets source
rather than a stale `dist`. That condition was being published, and `src` is not
in `files` — so any consumer whose bundler sets `development`, which Vite does
in dev, resolved to a file that was never shipped:

```
Failed to resolve entry for package "@lime-soda/grid"
```

`publishConfig.exports` now strips it at pack time. This affected every subpath
of `@lime-soda/grid` and the entry point of `@lime-soda/button`.
