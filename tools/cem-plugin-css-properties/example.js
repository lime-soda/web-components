/* eslint-disable no-undef */
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
  elementMapping: 'my-', // Removes 'my-' prefix from element names
})

// Example 2: Custom mapping function
const customMappingPlugin = cssPropertiesPlugin(tokens, {
  elementMapping: (tagName) => {
    // Remove prefix and handle special cases
    const baseName = tagName.replace(/^my-/, '')

    // Map specific elements to different token keys
    switch (baseName) {
      case 'btn':
        return 'button' // my-btn -> button tokens
      case 'text-field':
        return 'input' // my-text-field -> input tokens
      case 'card-container':
        return 'card' // my-card-container -> card tokens
      default:
        return baseName // my-button -> button tokens
    }
  },
})

console.log('✅ Plugin examples created successfully!')
console.log('Prefix plugin:', prefixPlugin.name)
console.log('Custom mapping plugin:', customMappingPlugin.name)
