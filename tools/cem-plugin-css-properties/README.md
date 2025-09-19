# @lime-soda/cem-plugin-css-properties

A Custom Elements Manifest (CEM) plugin that automatically adds CSS custom
properties from design tokens to your web component manifests.

## Features

- ✅ Automatically extracts CSS custom properties from design tokens
- ✅ Flexible element-to-token mapping with custom functions or simple prefix
  removal
- ✅ Type-safe TypeScript implementation
- ✅ Infers CSS syntax from token types
- ✅ Integrates seamlessly with Custom Elements Manifest analyzer

## Installation

```bash
npm install @lime-soda/cem-plugin-css-properties
```

## Usage

### Basic Usage with Prefix Mapping

```javascript
import { cssCustomPropertiesPlugin } from '@lime-soda/cem-plugin-css-properties'
import tokens from './design-tokens.js'

export default {
  plugins: [
    cssCustomPropertiesPlugin({
      tokens,
      elementMapping: 'ls-', // Removes 'ls-' prefix from element names
    }),
  ],
}
```

### Advanced Usage with Custom Mapping Function

```javascript
import { cssCustomPropertiesPlugin } from '@lime-soda/cem-plugin-css-properties'
import tokens from './design-tokens.js'

// Custom mapping function
function mapElementToTokens(tagName) {
  // Remove prefix and handle special cases
  const baseName = tagName.replace(/^ls-/, '')

  // Map specific elements to different token keys
  switch (baseName) {
    case 'btn':
      return 'button'
    case 'input-field':
      return 'input'
    default:
      return baseName
  }
}

export default {
  plugins: [
    cssCustomPropertiesPlugin({
      tokens,
      elementMapping: mapElementToTokens,
    }),
  ],
}
```

## Configuration

### `PluginOptions`

| Option           | Type                                      | Default | Description                                                      |
| ---------------- | ----------------------------------------- | ------- | ---------------------------------------------------------------- |
| `tokens`         | `Record<string, unknown>`                 | -       | Design tokens object (required)                                  |
| `elementMapping` | `((tagName: string) => string) \| string` | -       | Function to map element names to token keys, or prefix to remove |
| `componentName`  | `string`                                  | -       | Override component name detection                                |

## Token Structure

The plugin expects design tokens to follow this structure:

```javascript
const tokens = {
  button: {
    primary: {
      background: {
        $value: '#4ade80',
        $type: 'color',
        $description: 'Primary button background',
        name: 'button-primary-background',
      },
    },
  },
}
```

## Output

The plugin adds CSS custom properties to your Custom Elements Manifest:

```json
{
  "cssProperties": [
    {
      "name": "--button-primary-background",
      "description": "Primary button background",
      "default": "#4ade80"
    }
  ]
}
```

## License

MIT
