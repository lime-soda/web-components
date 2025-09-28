/**
 * Example usage of the CSS Custom Properties Plugin
 */
import { cssPropertiesPlugin } from './dist/index.js'

// Mock tokens for demonstration
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
  input: {
    border: {
      $value: '1px solid #ccc',
      $type: 'dimension',
      $description: 'Input border',
      name: 'input-border',
    },
  },
}

// Example 1: Simple prefix removal
const prefixPlugin = cssPropertiesPlugin(tokens, {
  elementPrefix: 'my-', // Removes 'my-' prefix from element names
})

// Example 2: Custom mapping function
const customMappingPlugin = cssPropertiesPlugin(tokens, {
  mapElementToTokens: (manifest, tokens) => {
    const mapping = new Map()

    // Process manifest to create custom mappings
    if (manifest.modules) {
      for (const module of manifest.modules) {
        if (module.declarations) {
          for (const declaration of module.declarations) {
            if (declaration.tagName) {
              // Remove prefix and handle special cases
              const baseName = declaration.tagName.replace(/^my-/, '')

              // Map specific elements to different token keys
              switch (baseName) {
                case 'btn':
                  mapping.set(declaration.tagName, 'button') // my-btn -> button tokens
                  break
                case 'text-field':
                  mapping.set(declaration.tagName, 'input') // my-text-field -> input tokens
                  break
                case 'card-container':
                  mapping.set(declaration.tagName, 'card') // my-card-container -> card tokens
                  break
                default:
                  if (baseName in tokens) {
                    mapping.set(declaration.tagName, baseName) // my-button -> button tokens
                  }
              }
            }
          }
        }
      }
    }

    return mapping
  },
})

console.log('✅ Plugin examples created successfully!')
console.log('Prefix plugin:', prefixPlugin.name)
console.log('Custom mapping plugin:', customMappingPlugin.name)
