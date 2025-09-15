import { resolve } from 'node:path'
import {
  getTokensPath,
  readJsonFile,
  readTextFile,
  getWorkspaceRoot,
} from '../utils/filesystem.js'

export interface TokenValue {
  $value: string
  $type?: string
  $description?: string
}

export interface TokenCategory {
  [key: string]: TokenValue | TokenCategory
}

export interface CSSVariable {
  name: string
  value: string
}

let tokensCache: Record<string, TokenCategory> | null = null
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

async function loadAllTokens(): Promise<Record<string, TokenCategory>> {
  if (tokensCache) {
    debugLog('Returning cached tokens', Object.keys(tokensCache))
    return tokensCache
  }

  try {
    const tokensPath = getTokensPath()
    debugLog('Environment variables:', {
      WORKSPACE_ROOT: process.env.WORKSPACE_ROOT,
      TOKENS_PATH: process.env.TOKENS_PATH,
      workspaceRoot: getWorkspaceRoot(),
      tokensPath,
      cwd: process.cwd(),
    })

    const tokens: Record<string, TokenCategory> = {}

    const tokenFiles = await glob('**/*.json', {
      cwd: tokensPath,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        'config.json',
        'package.json',
      ],
    })

    debugLog(`Found ${tokenFiles.length} token files`, tokenFiles)

    for (const tokenFile of tokenFiles) {
      try {
        const fullPath = resolve(tokensPath, tokenFile)
        const tokenData = await readJsonFile<TokenCategory>(fullPath)

        if (tokenData) {
          // Create a more descriptive key that includes the directory structure
          const pathParts = tokenFile.split('/')
          const fileName = basename(tokenFile, '.json')

          // Create hierarchical key: theme-light-color, primitives-color, etc.
          let key: string
          if (pathParts.length > 1) {
            const dirParts = pathParts.slice(0, -1)
            key = [...dirParts, fileName].join('-')
          } else {
            key = fileName
          }

          tokens[key] = tokenData
          debugLog(`Loaded token file: ${tokenFile} as key: ${key}`, {
            hasColorProperty: 'color' in tokenData,
            topLevelKeys: Object.keys(tokenData),
          })
        } else {
          console.warn(`Failed to load token data from ${tokenFile}`)
        }
      } catch (error) {
        console.error(`Error processing token file ${tokenFile}:`, error)
      }
    }

    debugLog(
      `Total tokens loaded: ${Object.keys(tokens).length}`,
      Object.keys(tokens),
    )
    tokensCache = tokens
    return tokens
  } catch (error) {
    console.error('Error in loadAllTokens:', error)
    return {}
  }
}

export async function listTokenCategories(): Promise<string[]> {
  try {
    const tokens = await loadAllTokens()
    const categories = Object.keys(tokens).sort()
    debugLog(`Listing ${categories.length} token categories`, categories)
    return categories
  } catch (error) {
    console.error('Error in listTokenCategories:', error)
    return []
  }
}

export async function getTokens(
  category?: string,
): Promise<Record<string, TokenCategory> | TokenCategory | null> {
  try {
    const tokens = await loadAllTokens()
    debugLog(`Getting tokens for category: ${category || 'all'}`, {
      availableCategories: Object.keys(tokens),
      requestedCategory: category,
    })

    if (!category) {
      return tokens
    }

    const result = tokens[category] || null
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
    const tokensPath = getTokensPath()
    const cssFilePath = resolve(tokensPath, 'dist/variables.css')
    debugLog('Reading CSS variables from:', cssFilePath)

    const cssContent = await readTextFile(cssFilePath)

    if (!cssContent) {
      console.warn('No CSS content found in variables.css')
      return []
    }

    const variables: CSSVariable[] = []
    const variableRegex = /--([^:]+):\s*([^;]+);/g
    let match

    while ((match = variableRegex.exec(cssContent)) !== null) {
      variables.push({
        name: `--${match[1].trim()}`,
        value: match[2].trim(),
      })
    }

    debugLog(`Parsed ${variables.length} CSS variables`)
    cssVariablesCache = variables
    return variables
  } catch (error) {
    console.error('Error in getCssVariables:', error)
    return []
  }
}

export async function searchTokens(
  query: string,
): Promise<Array<{ category: string; path: string; value: TokenValue }>> {
  try {
    const tokens = await loadAllTokens()
    const results: Array<{
      category: string
      path: string
      value: TokenValue
    }> = []
    const lowerQuery = query.toLowerCase()

    debugLog(`Searching tokens for query: '${query}'`, {
      availableCategories: Object.keys(tokens),
      totalCategories: Object.keys(tokens).length,
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

            if (matchesKey || matchesValue || matchesDescription) {
              results.push({ category, path: currentPath, value: tokenValue })
              debugLog(`Found match in ${category}:`, {
                path: currentPath,
                value: tokenValue.$value,
                matchedOn: {
                  key: matchesKey,
                  value: matchesValue,
                  description: matchesDescription,
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

    for (const [category, categoryTokens] of Object.entries(tokens)) {
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
  debugLog('Clearing all caches')
  tokensCache = null
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
    tokens: tokensCache !== null,
    cssVariables: cssVariablesCache !== null,
  }
}
