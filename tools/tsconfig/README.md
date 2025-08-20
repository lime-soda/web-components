# @lime-soda/tsconfig

Shared TypeScript configurations for the Lime Soda monorepo.

## Usage

### Base Configuration

For most packages, extend the base configuration:

```json
{
  "extends": "@lime-soda/tsconfig/tsconfig.json"
}
```

### Type Declarations Only

For generating type declarations without compilation:

```json
{
  "extends": "@lime-soda/tsconfig/tsconfig.types.json"
}
```

## Configurations

### `tsconfig.json` (Base)

The main TypeScript configuration with:

- **Target**: ES2022 (modern JavaScript)
- **Module**: ESNext (for bundler compatibility)
- **Strict mode**: Enabled for type safety
- **Source maps**: Enabled for debugging
- **Declaration**: Disabled (use types config for declarations)

### `tsconfig.types.json`

Configuration for generating type declarations:

- **Extends**: Base configuration
- **Declaration**: Enabled
- **Emit declaration only**: True
- **Output**: `dist/` directory

### `tsconfig.base.json`

Base configuration shared by other configs:

- Core compiler options
- Shared path mappings
- Module resolution settings

## Features

- **Strict TypeScript** - Full strict mode for better code quality
- **Modern target** - ES2022 for current browser support
- **ESM support** - Native ES module support
- **Path mapping** - Workspace package resolution
- **Incremental builds** - Faster rebuilds with build info
- **Source maps** - Better debugging experience

## Integration

Used by all packages in the monorepo:

- Component packages extend base config
- Tools extend base or types config as needed
- Build tools use for compilation
- ESLint uses for type checking

## Dependencies

- **TypeScript** - The TypeScript compiler and language service
