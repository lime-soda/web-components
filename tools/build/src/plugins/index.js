/**
 * Plugin exports for Custom Elements Manifest analysis
 */

import { cssCustomPropertiesPlugin } from './css-custom-properties-plugin.js'

export { cssCustomPropertiesPlugin }

/**
 * Factory function to create a CSS custom properties plugin with tokens
 * @param {Object} tokens - Design tokens object from @lime-soda/tokens
 * @param {Object} options - Additional plugin options
 * @param {string} [options.elementPrefix='ls-'] - Element prefix to remove
 * @param {string} [options.componentName] - Override component name detection
 * @returns {Object} Configured CEM plugin
 */
export function createCssCustomPropertiesPlugin(tokens, options = {}) {
  return cssCustomPropertiesPlugin({
    tokens,
    ...options,
  })
}
