import tokens from '@lime-soda/tokens'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface TokenValue {
  $value: string
  $type?: string
  $description?: string
  name?: string
  path?: string[]
  attributes?: Record<string, unknown>
  [key: string]: unknown
}

export interface TokenCategory {
  [key: string]: TokenValue | TokenCategory
}

export interface CSSVariable {
  name: string
  value: string
}

let cssVariablesCache: CSSVariable[] | null = null

// Debug logging helper
function debugLog(message: string, data?: unknown): void {
  if (process.env.DEBUG_TOKENS === 'true') {
    console.log(
      `[DEBUG TOKENS] ${message}`,
      data ? JSON.stringify(data, null, 2) : '',
    )
  }
}

function getAllTokens(): Record<string, TokenCategory> {
  debugLog('Loading tokens from package export')

  try {
    // Convert the imported tokens to our expected format
    const categorizedTokens: Record<string, TokenCategory> = {}

    // The tokens are already organized by category (color, font, size, etc.)
    for (const [categoryKey, categoryValue] of Object.entries(tokens)) {
      categorizedTokens[categoryKey] = categoryValue as TokenCategory
    }

    debugLog(
      `Total token categories loaded: ${Object.keys(categorizedTokens).length}`,
      Object.keys(categorizedTokens),
    )

    return categorizedTokens
  } catch (error) {
    console.error('Error in getAllTokens:', error)
    return {}
  }
}

export function listTokenCategories(): string[] {
  try {
    const allTokens = getAllTokens()
    const categories = Object.keys(allTokens).sort()
    debugLog(`Listing ${categories.length} token categories`, categories)
    return categories
  } catch (error) {
    console.error('Error in listTokenCategories:', error)
    return []
  }
}

export function getTokens(
  category?: string,
): Record<string, TokenCategory> | TokenCategory | null {
  try {
    const allTokens = getAllTokens()
    debugLog(`Getting tokens for category: ${category || 'all'}`, {
      availableCategories: Object.keys(allTokens),
      requestedCategory: category,
    })

    if (!category) {
      return allTokens
    }

    const result = allTokens[category] || null
    debugLog(
      `Token lookup result for '${category}':`,
      result ? 'found' : 'not found',
    )
    return result
  } catch (error) {
    console.error('Error in getTokens:', error)
    return null
  }
}

export async function getCssVariables(): Promise<CSSVariable[]> {
  if (cssVariablesCache) {
    debugLog(
      'Returning cached CSS variables',
      `${cssVariablesCache.length} variables`,
    )
    return cssVariablesCache
  }

  try {
    // Try to find the CSS file path from the tokens package
    // First, try to find the package location dynamically
    let cssFilePath: string | null = null

    try {
      // Try to resolve the CSS file from the package exports
      const tokensPackagePath = require.resolve(
        '@lime-soda/tokens/package.json',
      )
      const packageDir = resolve(tokensPackagePath, '..')
      cssFilePath = resolve(packageDir, 'dist/variables.css')
      debugLog('Resolved CSS file path:', cssFilePath)
    } catch {
      // Fallback: generate from tokens if we can't read the CSS file
      debugLog('Could not resolve CSS file, generating from tokens')
    }

    if (cssFilePath) {
      try {
        const cssContent = await readFile(cssFilePath, 'utf-8')
        const variables: CSSVariable[] = []
        const variableRegex = /--([^:]+):\s*([^;]+);/g
        let match

        while ((match = variableRegex.exec(cssContent)) !== null) {
          variables.push({
            name: `--${match[1].trim()}`,
            value: match[2].trim(),
          })
        }

        debugLog(`Parsed ${variables.length} CSS variables from file`)
        cssVariablesCache = variables
        return variables
      } catch (fileError) {
        console.warn(
          'Failed to read CSS file, falling back to token generation:',
          fileError,
        )
      }
    }

    // Fallback: generate CSS variables from the token structure
    debugLog('Generating CSS variables from token structure')
    const allTokens = getAllTokens()
    const variables: CSSVariable[] = []

    function extractCssVariables(
      obj: Record<string, unknown>,
      prefix = '',
    ): void {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          if ('$value' in value && typeof value.$value === 'string') {
            const tokenValue = value as TokenValue
            const cssVarName =
              tokenValue.name || `${prefix}${prefix ? '-' : ''}${key}`
            variables.push({
              name: `--${cssVarName}`,
              value: tokenValue.$value,
            })
          } else {
            extractCssVariables(
              value as Record<string, unknown>,
              prefix ? `${prefix}-${key}` : key,
            )
          }
        }
      }
    }

    extractCssVariables(allTokens)

    debugLog(`Generated ${variables.length} CSS variables from tokens`)
    cssVariablesCache = variables
    return variables
  } catch (error) {
    console.error('Error in getCssVariables:', error)
    return []
  }
}

export function searchTokens(
  query: string,
): Array<{ category: string; path: string; value: TokenValue }> {
  try {
    const allTokens = getAllTokens()
    const results: Array<{
      category: string
      path: string
      value: TokenValue
    }> = []
    const lowerQuery = query.toLowerCase()

    debugLog(`Searching tokens for query: '${query}'`, {
      availableCategories: Object.keys(allTokens),
      totalCategories: Object.keys(allTokens).length,
    })

    function searchInCategory(
      obj: Record<string, unknown>,
      category: string,
      path = '',
    ): void {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key

        if (typeof value === 'object' && value !== null) {
          if ('$value' in value) {
            const tokenValue = value as TokenValue
            const matchesKey = key.toLowerCase().includes(lowerQuery)
            const matchesValue = String(tokenValue.$value)
              .toLowerCase()
              .includes(lowerQuery)
            const matchesDescription = tokenValue.$description
              ?.toLowerCase()
              .includes(lowerQuery)
            const matchesName = tokenValue.name
              ?.toLowerCase()
              .includes(lowerQuery)

            if (
              matchesKey ||
              matchesValue ||
              matchesDescription ||
              matchesName
            ) {
              results.push({ category, path: currentPath, value: tokenValue })
              debugLog(`Found match in ${category}:`, {
                path: currentPath,
                value: tokenValue.$value,
                matchedOn: {
                  key: matchesKey,
                  value: matchesValue,
                  description: matchesDescription,
                  name: matchesName,
                },
              })
            }
          } else {
            searchInCategory(
              value as Record<string, unknown>,
              category,
              currentPath,
            )
          }
        }
      }
    }

    for (const [category, categoryTokens] of Object.entries(allTokens)) {
      if (typeof categoryTokens === 'object' && categoryTokens !== null) {
        debugLog(`Searching in category: ${category}`, {
          hasTokens: Object.keys(categoryTokens).length > 0,
          topLevelKeys: Object.keys(categoryTokens),
        })
        searchInCategory(categoryTokens as Record<string, unknown>, category)
      }
    }

    debugLog(`Search completed. Found ${results.length} results for '${query}'`)
    return results
  } catch (error) {
    console.error('Error in searchTokens:', error)
    return []
  }
}

export function clearCache(): void {
  debugLog('Clearing CSS variables cache')
  cssVariablesCache = null
}

// Helper function to enable debug mode
export function enableDebugMode(): void {
  process.env.DEBUG_TOKENS = 'true'
  console.log('Debug mode enabled for tokens')
}

// Helper function to get cache status
export function getCacheStatus(): { tokens: boolean; cssVariables: boolean } {
  return {
    tokens: true, // Always available from package import
    cssVariables: cssVariablesCache !== null,
  }
}
