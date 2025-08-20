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

### 🎨 Design System

#### [`@lime-soda/tokens`](./support/tokens/)

Design tokens built with Style Dictionary, providing CSS custom properties for
colors, spacing, typography, and more.

### 🔧 Development Tools

#### [`@lime-soda/build`](./tools/build/)

Fast component bundler using esbuild, optimized for web components with ES
module output.

#### [`@lime-soda/eslint-config`](./tools/eslint-config/)

Shared ESLint configuration with TypeScript, Prettier, JSON, and CSS support for
consistent code quality.

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
├── packages/           # Public web components
│   └── button/        # Individual component packages
├── support/           # Internal support packages
│   ├── mcp-server/   # MCP server for AI tooling
│   ├── storybook/    # Documentation and testing
│   └── tokens/       # Design tokens
├── tools/            # Development tools
│   ├── build/        # Component build tool
│   ├── eslint-config/ # Shared linting configuration
│   ├── generate/     # Component generator
│   └── tsconfig/     # TypeScript configurations
└── CLAUDE.md         # AI assistant instructions
```

### Technology Stack

- **Lit 3** - Web component framework with decorators and reactive properties
- **TypeScript 5.9** - Type safety and modern JavaScript features
- **Style Dictionary** - Design token compilation and CSS generation
- **Storybook 8** - Component documentation and testing
- **Vitest** - Fast unit testing with browser environment
- **Turbo** - Build system orchestration and caching
- **ESLint 9** - Code quality with flat config
- **Prettier** - Consistent code formatting

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
pnpm lint              # Lint all packages
pnpm create-component  # Generate new component

# Testing
cd support/storybook && pnpm test  # Run component tests
```

### Creating Components

Use the interactive generator:

```bash
pnpm create-component
```

This creates a complete component package with:

- Lit-based TypeScript implementation
- Custom elements manifest generation
- TypeScript declarations
- ESLint and build configuration
- README documentation template

### Design Tokens

Update design tokens in `support/tokens/`:

```bash
# Edit token files
vim support/tokens/primitives/color.json

# Rebuild CSS
cd support/tokens && pnpm build
```

## Contributing

1. **Follow conventions** - Use existing patterns for consistency
2. **Include tests** - Add Storybook stories with tests for new components
3. **Update documentation** - Keep READMEs current with changes
4. **Lint code** - Run `pnpm lint` before submitting
5. **Build successfully** - Ensure `pnpm build` completes without errors

## License

MIT © Phil Parsons
