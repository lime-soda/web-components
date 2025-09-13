import { propertyFormatNames } from 'style-dictionary/enums'
import { formattedVariables } from 'style-dictionary/utils'
import { groupTokensByPath } from './token-grouping.js'

/**
 * TypeScript/Lit format function for component token type declarations
 */
export function typescriptLitFormat({ dictionary, options }) {
  const { groups, singleLevelTokens } = groupTokensByPath(
    dictionary.allTokens,
    options,
  )

  const singleExports = Object.keys(singleLevelTokens).map(
    (tokenKey) => `export const ${tokenKey}: CSSResultGroup;`,
  )

  const groupExports = Object.entries(groups).map(([groupKey, tokens]) => {
    const properties = tokens
      .map(({ propName }) => `  ${propName}: CSSResultGroup`)
      .join(';\n')

    return `export const ${groupKey}: {\n${properties};\n};`
  })

  const allExports = [...singleExports, ...groupExports]

  return `import type { CSSResultGroup } from 'lit';\n\nexport const props: CSSResultGroup;\n\n${allExports.join('\n\n')}\n\nexport default props;`
}

/**
 * JavaScript/Lit format function for component token exports
 */
export function javascriptLitFormat({ dictionary, options }) {
  const { outputReferences } = options
  const propsExport = `export const props = css\`:host {\n${formattedVariables({
    format: propertyFormatNames.css,
    dictionary,
    outputReferences,
    usesDtcg: true,
  })}\n}\``

  const { groups, singleLevelTokens } = groupTokensByPath(
    dictionary.allTokens,
    options,
  )

  const singleExports = Object.entries(singleLevelTokens).map(
    ([tokenKey, { cssVar }]) =>
      `export const ${tokenKey} = css\`var(${cssVar})\`;`,
  )

  const groupExports = Object.entries(groups).map(([groupKey, tokens]) => {
    const properties = tokens
      .map(({ propName, cssVar }) => `  ${propName}: css\`var(${cssVar})\``)
      .join(',\n')

    return `export const ${groupKey} = {\n${properties}\n};`
  })

  const allExports = [...singleExports, ...groupExports]

  return `import { css } from 'lit';\n\n${propsExport}\n\n${allExports.join('\n\n')}`
}
