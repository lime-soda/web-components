# @lime-soda/build

Build tool for Lime Soda web components using esbuild.

## Usage

This package provides a `build-component` command that bundles web component
packages using esbuild.

### As a CLI tool

```bash
# From a component package directory
build-component
```

### In package.json scripts

```json
{
  "scripts": {
    "build": "build-component"
  }
}
```

## What it does

The build tool:

1. **Bundles TypeScript** - Compiles and bundles TypeScript source files
2. **Creates ES modules** - Outputs modern ES module format
3. **Handles imports** - Resolves and bundles dependencies appropriately
4. **Optimizes output** - Minifies and optimizes the final bundle
5. **Preserves exports** - Maintains proper ES module exports for consumption

## Configuration

The build tool uses esbuild under the hood with sensible defaults for web
components:

- **Entry point**: `src/index.ts`
- **Output**: `dist/index.js`
- **Format**: ES modules
- **Target**: Modern browsers (ES2020+)
- **Bundle**: Yes (with external peer dependencies)

## Dependencies

- **esbuild** - Fast JavaScript bundler and minifier
- **glob** - File pattern matching for finding source files

## Integration

This tool is designed to work with the Lime Soda monorepo build system:

- Used by component packages in their build scripts
- Integrates with Turbo for parallel builds
- Works with TypeScript declaration generation
- Compatible with Custom Elements Manifest generation
