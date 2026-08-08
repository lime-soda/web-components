# Lime Soda Web Components

A modern, type-safe web component library built with Lit and TypeScript,
featuring a comprehensive design system and developer tooling.

## Overview

This monorepo contains a complete design system including:

- **Web Components** - Reusable UI components built with Lit
- **Design Tokens** - Consistent styling with CSS custom properties
- **Developer Tools** - Build system, linting, testing, and component generation
- **Documentation** - Storybook for interactive component documentation
- **MCP Integration** - Model Context Protocol server for AI tooling

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development environment
pnpm dev

# Build all packages
pnpm build

# Generate a new component
pnpm create-component
```

## Packages

### 🧩 Components

#### [`@lime-soda/button`](./packages/button/)

Customizable button component with multiple variants, full accessibility
support, and extensive theming options.

#### [`@lime-soda/grid`](./packages/grid/)

Data grid that lays rows out horizontally: rows fill an instance to the viewport
height, then flow into another beside it, so one component fills a wide monitor
without the application building multi-pane UX. Minimal core with tree data,
sort, filter, selection, keyboard and cell flash as separately importable
modules.

### 🎨 Design System

#### [`@lime-soda/tokens`](./support/tokens/)

Design tokens built with Style Dictionary, providing CSS custom properties and
grouped Lit exports for colors, spacing, typography, and component styling with
DTCG-compliant descriptions.

### 🔧 Development Tools

#### [`@lime-soda/build`](./tools/build/)

Fast component bundler using esbuild with Custom Elements Manifest generation
support for enhanced component documentation.

#### [`@lime-soda/cem-plugin-css-properties`](./support/cem-plugin-css-properties/)

Custom Elements Manifest plugin that automatically adds CSS custom properties
from design tokens to component manifests, with conditional debug logging for
troubleshooting.

#### [`@lime-soda/bench`](./tools/bench/)

Benchmarks for the grid, written as budgets rather than timings: they catch an
order-of-magnitude regression such as a lost memo or a retained element, not a
few milliseconds of noise.

#### [`@lime-soda/generate`](./tools/generate/)

Interactive component generator using Plop.js to scaffold new components with
proper configuration.

#### [`@lime-soda/tsconfig`](./tools/tsconfig/)

Shared TypeScript configurations for consistent compilation settings across the
monorepo.

### 📚 Documentation & Testing

#### [`@lime-soda/storybook`](./support/storybook/)

Interactive component documentation with visual testing, accessibility checks,
and integration testing.

### 🤖 AI Integration

#### [`@lime-soda/mcp-server`](./support/mcp-server/)

Model Context Protocol server providing AI tools access to component information
and design tokens.

## Architecture

### Monorepo Structure

```
web-components/
├── packages/          # Public web components
│   ├── button/       # Individual component packages
│   └── grid/         # Horizontal-flow data grid
├── support/          # Internal support packages
│   ├── mcp-server/   # MCP server for AI tooling
│   ├── storybook/    # Documentation and testing
│   └── tokens/       # Design tokens
├── tools/            # Development tools
│   ├── bench/        # Grid performance budgets
│   ├── build/        # Component build tool
│   ├── generate/     # Component generator
│   └── tsconfig/     # TypeScript configurations
└── CLAUDE.md         # AI assistant instructions
```

### Technology Stack

- **Lit 3** - Web component framework with decorators and reactive properties
- **TypeScript 5.9** - Type safety and modern JavaScript features
- **Style Dictionary** - Design token compilation and CSS generation
- **Storybook 10** - Component documentation and testing
- **Vitest 4** - Fast unit testing with browser environment
- **Turbo** - Build system orchestration and caching
- **Vite+** - Linting, formatting and testing in one tool (`vp check`), with a
  pre-commit hook that fixes what it can

### Key Features

- **🚀 Modern Standards** - ES modules, TypeScript decorators, CSS custom
  properties
- **🎯 Type Safety** - Full TypeScript support with strict mode
- **♿ Accessibility** - WCAG compliant components with comprehensive a11y
  testing
- **🎨 Themeable** - CSS custom properties for flexible styling
- **📱 Responsive** - Mobile-first design with responsive utilities
- **🔍 Searchable** - Components and tokens discoverable via MCP server
- **🧪 Tested** - Integration and accessibility testing with Storybook/Vitest
- **📦 Optimized** - Tree-shakeable ES modules with minimal runtime
- **🎯 Self-Documenting** - Auto-generated manifests with design token CSS
  properties

## Development

### Prerequisites

- **Node.js 22+** - Required for experimental TypeScript support
- **pnpm 9+** - Package manager for monorepo workspace management

### Common Commands

```bash
# Development
pnpm dev                 # Start all development servers
pnpm dev:storybook      # Start Storybook only
pnpm dev:packages       # Watch component builds
pnpm dev:mcp           # Start MCP server

# Building
pnpm build             # Build all packages
pnpm create-component  # Generate new component

# Quality
pnpm check             # Formatting, lint and types in one pass
pnpm check:fix         # ...and fix what can be fixed

# Testing
pnpm test              # Every package's tests
pnpm test:node         # Pure units only, no browser
pnpm test:browser      # Component tests in real Chromium
pnpm bench             # Performance budgets for the grid

# Debugging
DEBUG=cem-plugin:* pnpm build  # Debug CEM plugin during build
```

### Creating Components

Use the interactive generator:

```bash
pnpm create-component
```

This creates a complete component package with:

- Lit-based TypeScript implementation
- Automated Custom Elements Manifest with design token CSS properties
- TypeScript declarations and grouped token exports
- Build configuration
- README documentation template

### Design Tokens

The design system uses DTCG-compliant tokens with automatic CSS generation and
Lit exports:

```bash
# Edit component tokens (includes $description properties)
vim support/tokens/theme/light/components/button.json

# Rebuild tokens and component manifests
cd support/tokens && pnpm build

# Build component manifest with token integration
cd packages/button && pnpm build:manifest
```

Token exports provide both CSS custom properties and grouped Lit objects:

```typescript
import * as styles from '@lime-soda/tokens/button';

// Use CSS custom properties
styles.props; // :host { --button-sm-padding: 0.375rem 0.75rem; }

// Use grouped token objects
styles.sm.padding; // css`var(--button-sm-padding)`
styles.primary.backgroundColor; // css`var(--button-primary-background-color)`
```

## Contributing

1. **Follow conventions** - Use existing patterns for consistency
2. **Include tests** - Add Storybook stories with tests for new components
3. **Update documentation** - Keep READMEs current with changes
4. **Check your work** - Run `pnpm check` and `pnpm test` before submitting
5. **Build successfully** - Ensure `pnpm build` completes without errors

## License

MIT © Phil Parsons
