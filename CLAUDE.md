# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Turborepo monorepo for the Lime Soda Design System web components library. Built with Lit 3.3.0 and Storybook 8.x for component development and testing.

## Development Commands

- **Package Manager**: `pnpm` (version 10.12.1)
- **Install Dependencies**: `pnpm install`
- **Build All Packages**: `pnpm build`
- **Start Development**: `pnpm dev` (runs all package dev scripts)
- **Start Storybook**: `pnpm storybook`
- **Build Storybook**: `pnpm build-storybook`
- **Run Tests**: `pnpm test` (Storybook interaction tests)
- **Lint**: `pnpm lint`
- **Clean**: `pnpm clean`

## Architecture

### Monorepo Structure

```
├── apps/
│   └── storybook/          # Storybook app for component development
├── packages/
│   ├── core/              # Shared design tokens and utilities
│   ├── button/            # Button component
│   ├── input/             # Input component (placeholder)
│   └── card/              # Card component (placeholder)
├── .github/workflows/     # CI/CD workflows
└── turbo.json            # Turborepo configuration
```

### Component Development

- Each component is a separate package in `packages/`
- Components use Lit 3.3.0 with TypeScript decorators
- Shared design tokens and utilities in `@lime-soda/core`
- Storybook stories for development and testing

### Build System

- **Turborepo**: Manages monorepo builds and caching
- **Vite**: Build tool for individual packages
- **TypeScript**: Type checking with project references
- **ESLint + Prettier**: Code quality and formatting

### Testing

- **Storybook Test Runner**: Interaction tests using Playwright
- **@storybook/test**: Testing utilities and assertions
- Stories include play functions for automated testing

## Package Structure

Each component package follows this structure:

```
packages/[component]/
├── src/
│   ├── index.ts           # Main export
│   └── [component].ts     # Component implementation
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Adding New Components

1. Create new package directory in `packages/`
2. Copy package.json structure from existing component
3. Implement component using Lit with TypeScript decorators
4. Import design tokens from `@lime-soda/core`
5. Create Storybook stories in `apps/storybook/stories/`
6. Add package reference to root tsconfig.json

## CI/CD

- **GitHub Actions**: Automated CI/CD workflows
- **Changesets**: Version management and publishing
- CI runs lint, build, and Storybook tests on PRs
- Release workflow publishes to npm on main branch
