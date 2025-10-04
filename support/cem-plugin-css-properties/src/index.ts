/**
 * Custom Elements Manifest plugin for adding CSS custom properties from design tokens
 */
import debugFn from 'debug'
import type {
  Package,
  CssCustomProperty,
  CustomElementDeclaration,
} from 'custom-elements-manifest/schema.js'

// Create debug instances for different aspects of the plugin
const debug = debugFn('cem-plugin:css-properties')
const debugMapping = debugFn('cem-plugin:css-properties:mapping')
const debugExtraction = debugFn('cem-plugin:css-properties:extraction')

/**
 * Represents a design token with value and metadata
 */
export interface DesignToken {
  $value: string
  $description?: string
  name?: string
}

// Using CssCustomProperty from the schema instead of our custom interface

/**
 * Type guard to check if a declaration is a custom element declaration
 */
function isCustomElementDeclaration(
  declaration: unknown,
): declaration is CustomElementDeclaration {
  return (
    typeof declaration === 'object' &&
    declaration !== null &&
    'kind' in declaration &&
    'customElement' in declaration &&
    'tagName' in declaration &&
    (declaration as Record<string, unknown>).kind === 'class' &&
    (declaration as Record<string, unknown>).customElement === true &&
    typeof (declaration as Record<string, unknown>).tagName === 'string'
  )
}

/**
 * Plugin configuration options
 */
export interface PluginOptions {
  /** Custom function to map elements to tokens */
  mapElementToTokens?: (
    manifest: Package,
    tokens: Record<string, unknown>,
  ) => Map<string, string>
  /** Element prefix to remove for default mapping (e.g., 'ls') */
  prefix?: string
}

/**
 * Extracts CSS custom properties from design tokens for a specific component
 * @param allTokens - The complete tokens object
 * @param tokenKey - Key to look up in the tokens object
 * @returns Array of CSS property objects
 */
function extractCssPropertiesFromTokens(
  allTokens: Record<string, unknown>,
  tokenKey: string,
): CssCustomProperty[] {
  const properties: CssCustomProperty[] = []

  try {
    // Look for component-specific tokens at the specified key
    const componentTokens = allTokens[tokenKey] as
      | Record<string, unknown>
      | undefined

    if (!componentTokens) {
      debugExtraction(
        `⚠️ No tokens found for key '${tokenKey}' in tokens object`,
      )
      return properties
    }

    // Recursively extract tokens from the component section
    function extractTokens(tokenObj: Record<string, unknown>): void {
      for (const [, value] of Object.entries(tokenObj)) {
        if (value && typeof value === 'object') {
          const token = value as DesignToken
          if (token.$value !== undefined && token.name) {
            // This is a token - convert to CSS custom property
            properties.push({
              name: `--${token.name}`,
              description: token.$description,
              default: token.$value,
            })
          } else {
            // Recurse into nested objects
            extractTokens(value as Record<string, unknown>)
          }
        }
      }
    }

    extractTokens(componentTokens)

    debugExtraction(
      `🎨 Extracted ${properties.length} CSS properties for token key '${tokenKey}'`,
    )
    return properties
  } catch (error) {
    debugExtraction(
      `⚠️ Could not extract CSS properties for '${tokenKey}': ${(error as Error).message}`,
    )
    return properties
  }
}

/**
 * Default mapping function that removes element prefix to get token keys
 * @param manifest - The custom elements manifest
 * @param tokens - The design tokens object
 * @param prefix - Prefix to remove from element tag names (dash will be added automatically)
 * @returns Map of element tag names to token keys
 */
function createDefaultElementToTokensMapping(
  manifest: Package,
  tokens: Record<string, unknown>,
  prefix = '',
): Map<string, string> {
  const mapping = new Map<string, string>()

  // Add dash to prefix if provided
  const elementPrefix = prefix ? `${prefix}-` : ''
  // Find all custom element declarations in the manifest
  if (manifest.modules) {
    for (const module of manifest.modules) {
      if (module.declarations) {
        for (const declaration of module.declarations) {
          if (isCustomElementDeclaration(declaration) && declaration.tagName) {
            // Remove prefix to get token key
            let tokenKey = declaration.tagName
            if (elementPrefix && tokenKey.startsWith(elementPrefix)) {
              tokenKey = tokenKey.slice(elementPrefix.length)
            }

            // Only add mapping if the token key exists in tokens
            if (tokenKey in tokens) {
              mapping.set(declaration.tagName, tokenKey)
            }
          }
        }
      }
    }
  }

  return mapping
}

/**
 * Factory function to create a CSS custom properties plugin with tokens
 * @param tokens - Design tokens object
 * @param options - Additional plugin options
 * @returns Configured CEM plugin
 */
export function cssPropertiesPlugin(
  tokens: Record<string, unknown>,
  options: PluginOptions = {},
) {
  return {
    name: 'css-custom-properties',

    packageLinkPhase({
      customElementsManifest,
    }: {
      customElementsManifest: Package
    }) {
      // Create element-to-token mapping using custom function or default
      const elementToTokenMapping = options.mapElementToTokens
        ? options.mapElementToTokens(customElementsManifest, tokens)
        : createDefaultElementToTokensMapping(
            customElementsManifest,
            tokens,
            options.prefix ?? 'ls',
          )

      debugMapping(
        `🗺️ Created mapping for ${elementToTokenMapping.size} element(s)`,
      )

      // Process each mapped element
      for (const [tagName, tokenKey] of elementToTokenMapping) {
        debug(`🔍 Processing element '${tagName}' with token key '${tokenKey}'`)

        // Extract CSS properties from design tokens
        const cssProperties = extractCssPropertiesFromTokens(tokens, tokenKey)

        if (cssProperties.length === 0) {
          debug(
            `⚠️ No CSS properties found for element '${tagName}' (token key: '${tokenKey}')`,
          )
          continue
        }

        // Find the custom element declaration and add properties
        if (customElementsManifest.modules) {
          for (const module of customElementsManifest.modules) {
            if (module.declarations) {
              for (const declaration of module.declarations) {
                if (
                  isCustomElementDeclaration(declaration) &&
                  declaration.tagName === tagName
                ) {
                  // Add CSS properties to the custom element declaration
                  if (!declaration.cssProperties) {
                    declaration.cssProperties = []
                  }

                  // Add our token-derived properties
                  declaration.cssProperties.push(...cssProperties)

                  debug(
                    `✨ Added ${cssProperties.length} CSS properties to '${declaration.name}' declaration`,
                  )
                  break
                }
              }
            }
          }
        }
      }
    },
  }
}
