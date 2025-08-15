import { resolve, basename } from 'node:path'
import { glob } from 'glob'
import {
  getTokensPath,
  readJsonFile,
  readTextFile,
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

async function loadAllTokens(): Promise<Record<string, TokenCategory>> {
  if (tokensCache) {
    return tokensCache
  }

  const tokensPath = getTokensPath()
  const tokens: Record<string, TokenCategory> = {}

  const tokenFiles = await glob('**/*.json', {
    cwd: tokensPath,
    ignore: ['**/node_modules/**', '**/dist/**', 'config.json', 'package.json'],
  })

  for (const tokenFile of tokenFiles) {
    const fullPath = resolve(tokensPath, tokenFile)
    const tokenData = await readJsonFile<TokenCategory>(fullPath)

    if (tokenData) {
      const categoryName = basename(tokenFile, '.json')
      const dirName = basename(resolve(tokensPath, tokenFile, '..'))
      const key =
        dirName === 'tokens' ? categoryName : `${dirName}-${categoryName}`
      tokens[key] = tokenData
    }
  }

  tokensCache = tokens
  return tokens
}

export async function listTokenCategories(): Promise<string[]> {
  const tokens = await loadAllTokens()
  return Object.keys(tokens).sort()
}

export async function getTokens(
  category?: string,
): Promise<Record<string, TokenCategory> | TokenCategory | null> {
  const tokens = await loadAllTokens()

  if (!category) {
    return tokens
  }

  return tokens[category] || null
}

export async function getCssVariables(): Promise<CSSVariable[]> {
  if (cssVariablesCache) {
    return cssVariablesCache
  }

  const tokensPath = getTokensPath()
  const cssFilePath = resolve(tokensPath, 'dist/css/variables.css')
  const cssContent = await readTextFile(cssFilePath)

  if (!cssContent) {
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

  cssVariablesCache = variables
  return variables
}

export async function searchTokens(
  query: string,
): Promise<Array<{ category: string; path: string; value: TokenValue }>> {
  const tokens = await loadAllTokens()
  const results: Array<{ category: string; path: string; value: TokenValue }> =
    []
  const lowerQuery = query.toLowerCase()

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
          if (
            key.toLowerCase().includes(lowerQuery) ||
            tokenValue.$value.toLowerCase().includes(lowerQuery) ||
            tokenValue.$description?.toLowerCase().includes(lowerQuery)
          ) {
            results.push({ category, path: currentPath, value: tokenValue })
          }
        } else {
          searchInCategory(
            value as Record<string, string>,
            category,
            currentPath,
          )
        }
      }
    }
  }

  for (const [category, categoryTokens] of Object.entries(tokens)) {
    if (typeof categoryTokens === 'object' && categoryTokens !== null) {
      searchInCategory(categoryTokens as Record<string, unknown>, category)
    }
  }

  return results
}

export function clearCache(): void {
  tokensCache = null
  cssVariablesCache = null
}
