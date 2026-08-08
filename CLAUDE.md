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
- `pnpm bench` - Run the grid's performance budgets
- `pnpm check` - Formatting, lint and types in one pass (`check:fix` to fix)

### Component Generation

- `pnpm create-component` - Interactive component generator using Plop
- Uses templates from `tools/generate/templates/` to scaffold new components

### Individual Package Commands

- `build-component` - Build individual component package (from
  `@lime-soda/build`)
- `tsc --emitDeclarationOnly --declarationDir dist` - Generate TypeScript
  declarations

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
- **esbuild** for component bundling (via custom `@lime-soda/build` tool);
  `packages/grid` builds with `tsc` instead, because it emits many entry points
  and must exclude its colocated tests from `dist`
- **Style Dictionary** for design token compilation
- Every package extends `@lime-soda/tsconfig`; there is no second base config.
  `noEmit` is on there, so a package that is meant to emit turns it off in its
  own build config

### Design System

- Design tokens in `support/tokens/` using Style Dictionary
- CSS custom properties for theming (e.g., `--color-orange-400`)
- Components use `var()` for consistent styling across the design system

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
