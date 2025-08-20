# @lime-soda/eslint-config

Shared ESLint configuration for the Lime Soda monorepo with TypeScript,
Prettier, and JSON/CSS support.

## Installation

```bash
pnpm add -D @lime-soda/eslint-config
```

## Usage

### Base Configuration

```js
// eslint.config.js
import { limeSoda } from '@lime-soda/eslint-config'

export default limeSoda()
```

### Browser-specific Configuration

For packages that run in the browser (web components):

```js
// eslint.config.js
import { limeSodaBrowser } from '@lime-soda/eslint-config/browser'

export default limeSodaBrowser()
```

### Node.js-specific Configuration

For packages that run in Node.js (tools, build scripts):

```js
// eslint.config.js
import { limeSodaNode } from '@lime-soda/eslint-config/node'

export default limeSodaNode()
```

## Features

- **TypeScript support** - Full type checking and TypeScript-specific rules
- **Prettier integration** - Automatic code formatting with conflict resolution
- **JSON linting** - Validates JSON files for syntax and formatting
- **CSS linting** - Basic CSS validation and formatting
- **Environment-specific globals** - Browser/Node.js globals configured
  automatically
- **Modern ES modules** - ESM-first configuration with proper module resolution

## Peer Dependencies

Make sure to install the required peer dependencies:

```bash
pnpm add -D eslint typescript typescript-eslint
```

## Configuration Options

The configurations support the same options as ESLint flat config:

```js
import { limeSoda } from '@lime-soda/eslint-config'

export default limeSoda({
  // ESLint flat config options
  ignores: ['build/**', 'dist/**'],
  rules: {
    // Override or add rules
    '@typescript-eslint/no-unused-vars': 'warn',
  },
})
```
