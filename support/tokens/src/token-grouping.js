import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'

/**
 * Groups tokens by path segments for structured exports
 * Separates single-level tokens from grouped tokens
 */
export function groupTokensByPath(tokens, options) {
  const groups = {}
  const singleLevelTokens = {}

  tokens.forEach((token) => {
    const [, groupKey, ...rest] = token.path
    if (!groupKey) return

    if (rest.length === 0) {
      singleLevelTokens[groupKey] = {
        cssVar: `--${token.path.join('-')}`,
        token,
      }
      return
    }

    if (!groups[groupKey]) {
      groups[groupKey] = []
    }

    const propName = StyleDictionary.hooks.transforms[
      transforms.nameCamel
    ].transform({ path: rest }, options)

    groups[groupKey].push({
      propName,
      cssVar: `--${token.path.join('-')}`,
      token,
    })
  })

  return { groups, singleLevelTokens }
}
