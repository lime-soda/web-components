---
'@lime-soda/mcp-server': patch
---

Fetch the MCP Inspector on demand instead of depending on it.

`pnpm run debug` now runs it through `pnpm dlx`, so it is no longer part of the
workspace dependency graph. Vite reaches this repo through `vite-plus` →
`vitest`, which depends on it across `^6 || ^7 || ^8`, and pnpm resolves one copy
for everything. The inspector is a web application that needs Vite too, so its
v2 release — which wants `^8.1.5` — pulled the whole workspace onto Vite 8 and
moved the component tests onto a different bundler.

Pinning Vite is not the answer: an override does hold everything at 7, but then
the inspector's own web UI will not start, because it needs the Vite 8 internals
`@vitejs/plugin-react` imports. It wants a different Vite than the test suite,
which is a good reason for it not to share one.
