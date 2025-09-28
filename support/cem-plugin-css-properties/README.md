# @lime-soda/cem-plugin-css-properties

A Custom Elements Manifest (CEM) plugin that automatically adds CSS custom
properties from design tokens to your custom element manifests.

## Installation

```bash
npm install @lime-soda/cem-plugin-css-properties
```

## Usage

### Basic Usage with Element Prefix

```javascript
import { cssPropertiesPlugin } from '@lime-soda/cem-plugin-css-properties'
import tokens from './design-tokens.js'

export default {
  plugins: [
    cssPropertiesPlugin(tokens, {
      elementPrefix: 'ls-', // Removes 'ls-' prefix from element names
    }),
  ],
}
```

### Advanced Usage with Custom Mapping Function

```javascript
import { cssPropertiesPlugin } from '@lime-soda/cem-plugin-css-properties'
import tokens from './design-tokens.js'

// Custom mapping function
function mapElementToTokens(manifest, tokens) {
  const mapping = new Map()

  // Process manifest to create custom mappings
  if (manifest.modules) {
    for (const module of manifest.modules) {
      if (module.declarations) {
        for (const declaration of module.declarations) {
          if (declaration.tagName) {
            // Custom logic for mapping element to token key
            const baseName = declaration.tagName.replace(/^ls-/, '')

            switch (baseName) {
              case 'btn':
                mapping.set(declaration.tagName, 'button')
                break
              case 'input-field':
                mapping.set(declaration.tagName, 'input')
                break
              default:
                if (baseName in tokens) {
                  mapping.set(declaration.tagName, baseName)
                }
            }
          }
        }
      }
    }
  }

  return mapping
}

export default {
  plugins: [
    cssPropertiesPlugin(tokens, {
      mapElementToTokens,
    }),
  ],
}
```

## Configuration

### `PluginOptions`

| Option               | Type                                                                          | Default | Description                                   |
| -------------------- | ----------------------------------------------------------------------------- | ------- | --------------------------------------------- |
| `mapElementToTokens` | `(manifest: Package, tokens: Record<string, unknown>) => Map<string, string>` | -       | Custom function to map elements to token keys |
| `elementPrefix`      | `string`                                                                      | `'ls-'` | Element prefix to remove for default mapping  |

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
