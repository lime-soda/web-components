/**
 * Custom Elements Manifest plugin for adding CSS custom properties from design tokens
 */
import fs from 'fs'
import path from 'path'

/**
 * Extracts CSS custom properties from design tokens for a specific component
 * @param {Object} allTokens - The complete tokens object from @lime-soda/tokens
 * @param {string} componentName - Name of the component (e.g., 'button')
 * @param {string} elementPrefix - Element prefix to remove (e.g., 'ls-')
 * @returns {Array} Array of {name, description, syntax, default} objects
 */
function extractCssPropertiesFromTokens(
  allTokens,
  componentName,
  elementPrefix = 'ls-',
) {
  const properties = []

  try {
    // Look for component-specific tokens at the top level
    const componentTokens = allTokens[componentName]

    if (!componentTokens) {
      console.warn(
        `⚠️ No tokens found for component '${componentName}' at top level`,
      )
      return properties
    }

    // Recursively extract tokens from the component section
    function extractTokens(tokenObj) {
      for (const [, value] of Object.entries(tokenObj)) {
        if (value && typeof value === 'object') {
          if (value.$value !== undefined && value.name) {
            // This is a token - convert to CSS custom property
            properties.push({
              name: `--${value.name}`,
              description: value.$description || undefined,
              syntax: inferSyntaxFromType(value.$type),
              default: value.$value,
            })
          } else {
            // Recurse into nested objects
            extractTokens(value)
          }
        }
      }
    }

    extractTokens(componentTokens)

    console.log(
      `🎨 Extracted ${properties.length} CSS properties for component '${componentName}'`,
    )
    return properties
  } catch (error) {
    console.warn(
      `⚠️ Could not extract CSS properties for '${componentName}': ${error.message}`,
    )
    return properties
  }
}

/**
 * Infers CSS syntax from design token type
 * @param {string} tokenType - The $type field from the design token
 * @returns {string|undefined} CSS syntax string
 */
function inferSyntaxFromType(tokenType) {
  switch (tokenType) {
    case 'color':
      return '<color>'
    case 'dimension':
      return '<length>'
    case 'fontFamily':
      return '<custom-ident>#'
    case 'fontWeight':
      return '<number> | <custom-ident>'
    case 'duration':
      return '<time>'
    case 'transition':
      return '<single-transition>#'
    case 'typography':
      return "<'font'>"
    default:
      return undefined
  }
}

/**
 * CSS Custom Properties Plugin for Custom Elements Manifest
 * Adds CSS custom properties from design tokens during the collect phase
 *
 * @param {Object} options - Plugin configuration
 * @param {Object} options.tokens - Design tokens object from @lime-soda/tokens
 * @param {string} [options.elementPrefix='ls-'] - Element prefix to remove from component names
 * @param {string} [options.componentName] - Override component name (detected automatically if not provided)
 * @returns {Object} CEM plugin object
 */
export function cssCustomPropertiesPlugin(options = {}) {
  const {
    tokens,
    elementPrefix = 'ls-',
    componentName: overrideComponentName,
  } = options

  if (!tokens) {
    console.warn('⚠️ CSS Custom Properties Plugin: No tokens provided')
    return {
      name: 'css-custom-properties',
      collectPhase() {
        // No-op if no tokens provided
      },
    }
  }

  return {
    name: 'css-custom-properties',

    packageLinkPhase({ customElementsManifest }) {
      // Detect component name from context or use override
      let componentName = overrideComponentName

      if (!componentName) {
        // Try to detect from package.json or directory
        try {
          try {
            const packageData = fs.readFileSync('package.json', 'utf-8')
            const pkg = JSON.parse(packageData)

            if (pkg.name?.includes('/')) {
              componentName = pkg.name.split('/')[1]
            }
          } catch {
            // Fall back to directory name
            componentName = path.basename(process.cwd())
          }
        } catch (error) {
          console.warn('⚠️ Could not detect component name:', error.message)
          return
        }
      }

      // Remove element prefix if present
      if (componentName.startsWith(elementPrefix)) {
        componentName = componentName.slice(elementPrefix.length)
      }

      console.log(
        `🔍 CSS Custom Properties Plugin: Processing component '${componentName}'`,
      )

      // Extract CSS properties from design tokens
      const cssProperties = extractCssPropertiesFromTokens(
        tokens,
        componentName,
        elementPrefix,
      )

      if (cssProperties.length === 0) {
        console.warn(
          `⚠️ No CSS properties found for component '${componentName}'`,
        )
        return
      }

      // Find custom element declarations in all modules and add CSS properties
      if (customElementsManifest.modules) {
        for (const module of customElementsManifest.modules) {
          if (module.declarations) {
            for (const declaration of module.declarations) {
              if (declaration.kind === 'class' && declaration.customElement) {
                // Add CSS properties to the custom element declaration
                if (!declaration.cssProperties) {
                  declaration.cssProperties = []
                }

                // Add our token-derived properties
                declaration.cssProperties.push(...cssProperties)

                console.log(
                  `✨ Added ${cssProperties.length} CSS properties to '${declaration.name}' declaration`,
                )
              }
            }
          }
        }
      }
    },
  }
}
