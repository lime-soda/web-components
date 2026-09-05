# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Build Commands

- `pnpm build` - Build all packages and types using Turbo
- `pnpm build-storybook` - Build Storybook for production

### Development Commands

- `pnpm storybook` - Start Storybook development server on port 6006
- `pnpm test` - Run every package's tests (`test:node` / `test:browser` to pick
  one half)
- `pnpm test:browsers` - Install the Chromium the browser tests drive. Needed
  once per machine; CI does not run it, because its browser job runs inside
  Playwright's own image
- `pnpm bench` - Run the grid's performance budgets
- `pnpm size` - Check what crosses the wire against its budget (`size-limit`).
  Needs `pnpm build` first, since it measures the published files
- `pnpm check` - Formatting, lint and types in one pass (`check:fix` to fix)

### Component Generation

- `pnpm create-component` - Interactive component generator using Plop
- Uses templates from `tools/generate/templates/` to scaffold new components

### Individual Package Commands

- `tsc -p tsconfig.build.json` - Build a package: one pass emits both the
  JavaScript and the declarations
- `build-manifest` - Generate `custom-elements.json`, including each element's
  CSS custom properties from the design tokens (from `@lime-soda/build`)

## Project Architecture

### Monorepo Structure

This is a pnpm workspace monorepo with packages organized into:

- `packages/` - Web components (e.g., `@lime-soda/button`, `@lime-soda/grid`)
- `support/` - Design tokens and shared assets (`@lime-soda/tokens`)
- `tools/` - Build tools, generators and benchmarks (`@lime-soda/build`,
  `@lime-soda/generate`, `@lime-soda/bench`)

### Web Components Framework

- Built with **Lit** (version 3.3.0) for web components
- Uses TypeScript decorators (`@customElement`, `@property`)
- Components follow the `ls-` prefix convention (e.g., `ls-button`, `ls-grid`)
- Shadow DOM with CSS custom properties for theming
- **Standard (TC39) decorators**, not the legacy experimental ones, so reactive
  properties are declared with the `accessor` keyword:
  `@property({ type: String }) accessor size = 'md'`. Anything that compiles or
  serves this code must target ES2022 or lower — left at `esnext`, `accessor`
  survives into the output and bundlers cannot parse it.

### Testing & Documentation

- **Storybook** for component documentation and visual testing, with Chromatic
  for visual regression
- **Vitest** with browser testing using Playwright
- Storybook stories carry integration tests via `@storybook/addon-vitest`
- Component packages also have their own suite of `*.browser.test.ts` files
  running in real Chromium, because shadow DOM, focus and layout measurement
  have no useful answer in jsdom. `packages/grid` adds a `node` project for its
  pure units (store, projection, layout engines)
- Accessibility is tested twice on purpose: `@storybook/addon-a11y` checks the
  themed component as rendered in a story, and axe runs directly in the browser
  tests over every variant, with `color-contrast` disabled there because the
  harness has no theme
- `tools/bench` holds budgets rather than timings — published bundle sizes and
  grid render performance — so an order-of-magnitude regression fails CI

### Build System

- **Turbo** for build orchestration
- **tsc** builds every package: one pass emits the JavaScript and the
  declarations, from a `tsconfig.build.json` that excludes the colocated tests
- **Style Dictionary** for design token compilation
- Every package extends `@lime-soda/tsconfig`; there is no second base config.
  `noEmit` is on there, so a package that is meant to emit turns it off in its
  own build config

### Design System

Three tiers, and each only ever references the one below it:

1. **Primitives** in `support/tokens/definitions/` — `--color-teal-600`, the
   raw palette and scales. Teal is the primary hue and taupe the secondary,
   both muted: the screens this system dresses are mostly coloured data, and a
   saturated accent competes with it
2. **Semantic** in `support/tokens/theme/{light,dark}/` —
   `--theme-color-background-default`. Combined into a single stylesheet where
   the two modes differ by CSS `light-dark()`, so light and dark follow
   `color-scheme` rather than a class or a media query of their own
3. **Component** in `support/tokens/components/<name>.json` — `--button-*`,
   `--grid-*`, named after the element minus its `ls-` prefix, which is the
   mapping `@lime-soda/cem-plugin-css-properties` relies on

**No literal values in component styles.** A component imports
`@lime-soda/tokens/<name>`, puts `tokens.props` first in its `static styles`,
and reads `var(--<name>-*)` from there. That is what makes the whole system
themeable from one place, and why a hard-coded colour in a component is a bug
rather than a shortcut.

An application must load `@lime-soda/tokens/variables.css`, which defines the
first two tiers. Without it the component tokens reference nothing.

Two things to preserve when changing the palette or the scales:

- **Contrast.** Every foreground/background pairing in the semantic tier clears
  WCAG AA (4.5:1) in both modes; the tightest is 5.48:1. Note that the accent
  inverts between modes — `primary.textOnBackground` is white on light and
  near-black on dark, because white on the lighter dark-mode teal is 2.87:1.
  The Storybook a11y addon gates on this, so a regression fails the test run.
- **Density.** The scales sit one step below a typical UI: 13px body text, 2px
  to 16px component spacing, 24px grid rows. It is a trading surface, and the
  currency is rows on screen.

### Key Patterns

- Components export both the class and register custom elements globally
- TypeScript declarations extend `HTMLElementTagNameMap` for type safety
- Package exports use dual ESM/TypeScript formats in `package.json`
- Storybook stories include interactive tests using `@storybook/addon-vitest`

## Linting & Type Checking

Run `pnpm check` to check code quality: **Vite+** (`vp`) runs oxlint, oxfmt and
the type checker in one pass, configured in `vite.config.ts`.

- Type-aware linting is on, so lint sees what the compiler sees
- `no-unused-vars` is an error rather than a warning: a warning fails nothing,
  so dead code accumulates exactly as it did with no linter at all
- A pre-commit hook (`.vite-hooks/pre-commit` → `vp staged`) formats and applies
  fixable lint rules to staged files, so a fix lands in the commit that needed
  it
- Always use variables from the design tokens package when styling components
  and stories
