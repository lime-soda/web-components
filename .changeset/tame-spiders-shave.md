---
'@lime-soda/button': minor
---

Move to standard (TC39) decorators, and add a browser test suite.

Reactive properties are now declared with the `accessor` keyword. This is a
change to the published output, not just the source: `size` and `variant` are
accessors rather than plain fields, so a subclass that overrode either as a
field would now shadow the reactive one. The rendered markup, attributes and
events are unchanged.

The whole repository now uses one decorator dialect, so `@lime-soda/tsconfig`
is the single base config and the grid no longer needs its own.

The package also gains a `development` export condition, so Storybook and other
workspace consumers resolve it to source and pick up a change without a build
step, and a Chromium test suite that runs axe over every size and variant
alongside focus and reactivity assertions.

Fixed while migrating: `build-component` emitted at esbuild's default `esnext`
target, which left `accessor` in the published JavaScript as syntax no bundler
can parse. It now targets ES2022.
