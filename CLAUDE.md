# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build Commands
- `pnpm build` - Build all packages and types using Turbo
- `pnpm build-storybook` - Build Storybook for production

### Development Commands
- `pnpm storybook` - Start Storybook development server on port 6006
- `pnpm test` - Run Vitest tests for Storybook stories
- `pnpm lint` - Run ESLint across the codebase

### Component Generation
- `pnpm create-component` - Interactive component generator using Plop
- Uses templates from `tools/generate/templates/` to scaffold new components

### Individual Package Commands
- `build-component` - Build individual component package (from `@lime-soda/build`)
- `tsc --emitDeclarationOnly --declarationDir dist` - Generate TypeScript declarations

## Project Architecture

### Monorepo Structure
This is a pnpm workspace monorepo with packages organized into:
- `packages/` - Web components (e.g., `@lime-soda/button`)
- `support/` - Design tokens and shared assets (`@lime-soda/tokens`)  
- `tools/` - Build tools and generators (`@lime-soda/build`, `@lime-soda/generate`)

### Web Components Framework
- Built with **Lit** (version 3.3.0) for web components
- Uses TypeScript decorators (`@customElement`, `@property`)
- Components follow the `ls-` prefix convention (e.g., `ls-button`)
- Shadow DOM with CSS custom properties for theming

### Testing & Documentation
- **Storybook** for component documentation and visual testing
- **Vitest** with browser testing using Playwright
- Tests are integration tests in Storybook stories using `@storybook/addon-vitest`
- Accessibility testing via `@storybook/addon-a11y`

### Build System
- **Turbo** for build orchestration
- **esbuild** for component bundling (via custom `@lime-soda/build` tool)
- **Style Dictionary** for design token compilation
- Each component package has its own `tsconfig.json` extending `@lime-soda/tsconfig`

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
Run `pnpm lint` to check code quality. The ESLint config includes:
- TypeScript ESLint with type checking
- JSON and CSS linting
- Separate globals for browser (`packages/`) and Node.js (`tools/`) code