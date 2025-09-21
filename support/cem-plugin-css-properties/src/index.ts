/**
 * Custom Elements Manifest plugin for adding CSS custom properties from design tokens
 */
import type {
  Package,
  CssCustomProperty,
  CustomElementDeclaration,
} from 'custom-elements-manifest/schema.js'

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
  /** Function to map element tag name to tokens key, or element prefix to remove */
  elementMapping?: ((tagName: string) => string) | string
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
      console.warn(`⚠️ No tokens found for key '${tokenKey}' in tokens object`)
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

    console.log(
      `🎨 Extracted ${properties.length} CSS properties for token key '${tokenKey}'`,
    )
    return properties
  } catch (error) {
    console.warn(
      `⚠️ Could not extract CSS properties for '${tokenKey}': ${(error as Error).message}`,
    )
    return properties
  }
}

/**
 * Default element mapping function that removes a prefix
 * @param prefix - Prefix to remove from element tag names
 * @returns Mapping function
 */
function createPrefixMapper(prefix: string): (tagName: string) => string {
  return (tagName: string) => {
    if (tagName.startsWith(prefix)) {
      return tagName.slice(prefix.length)
    }
    return tagName
  }
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
  // Create mapping function
  const mapElementToTokenKey =
    typeof options.elementMapping === 'function'
      ? options.elementMapping
      : createPrefixMapper(options.elementMapping ?? '')

  return {
    name: 'css-custom-properties',

    packageLinkPhase({
      customElementsManifest,
    }: {
      customElementsManifest: Package
    }) {
      // Find custom element declarations and process each one
      if (customElementsManifest.modules) {
        for (const module of customElementsManifest.modules) {
          if (module.declarations) {
            for (const declaration of module.declarations) {
              if (isCustomElementDeclaration(declaration)) {
                // Map the element tag name to the tokens key
                const tokenKey = mapElementToTokenKey(declaration.tagName!)

                console.log(
                  `🗺️ Mapping element '${declaration.tagName}' to token key '${tokenKey}'`,
                )

                // Extract CSS properties from design tokens
                const cssProperties = extractCssPropertiesFromTokens(
                  tokens,
                  tokenKey,
                )

                if (cssProperties.length === 0) {
                  console.warn(
                    `⚠️ No CSS properties found for element '${declaration.tagName}' (token key: '${tokenKey}')`,
                  )
                  continue
                }

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
