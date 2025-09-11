import StyleDictionary from 'style-dictionary'
import { propertyFormatNames, transforms } from 'style-dictionary/enums'
import { formattedVariables } from 'style-dictionary/utils'
import fs from 'node:fs/promises'
import { glob } from 'glob'

function groupTokensByPath(tokens, options) {
  const groups = {}
  const singleLevelTokens = {}

  tokens.forEach((token) => {
    // Skip the component name (first path segment) and group by the next segment
    const [, groupKey, ...rest] = token.path
    if (!groupKey) return

    // If there are no remaining path segments, this is a single-level token
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

    // Create property name from remaining path segments
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

StyleDictionary.registerFormat({
  name: 'typescript/lit',
  format({ dictionary, options }) {
    const { groups, singleLevelTokens } = groupTokensByPath(
      dictionary.allTokens,
      options,
    )

    // Generate single-level token exports
    const singleExports = Object.keys(singleLevelTokens).map(
      (tokenKey) => `export const ${tokenKey}: CSSResultGroup;`,
    )

    // Generate grouped type declarations
    const groupExports = Object.entries(groups).map(([groupKey, tokens]) => {
      const properties = tokens
        .map(({ propName }) => `  ${propName}: CSSResultGroup`)
        .join(';\n')

      return `export const ${groupKey}: {\n${properties};\n};`
    })

    const allExports = [...singleExports, ...groupExports]

    return `import type { CSSResultGroup } from 'lit';\n\nexport const props: CSSResultGroup;\n\n${allExports.join('\n\n')}\n\nexport default props;`
  },
})

StyleDictionary.registerFormat({
  name: 'javascript/lit',
  format: async ({ dictionary, options }) => {
    const { outputReferences } = options
    const propsExport = `export const props = css\`:host {\n${formattedVariables(
      {
        format: propertyFormatNames.css,
        dictionary,
        outputReferences,
        usesDtcg: true,
      },
    )}\n}\``

    const { groups, singleLevelTokens } = groupTokensByPath(
      dictionary.allTokens,
      options,
    )

    // Generate single-level token exports
    const singleExports = Object.entries(singleLevelTokens).map(
      ([tokenKey, { cssVar }]) =>
        `export const ${tokenKey} = css\`var(${cssVar})\`;`,
    )

    // Generate grouped exports
    const groupExports = Object.entries(groups).map(([groupKey, tokens]) => {
      const properties = tokens
        .map(({ propName, cssVar }) => `  ${propName}: css\`var(${cssVar})\``)
        .join(',\n')

      return `export const ${groupKey} = {\n${properties}\n};`
    })

    const allExports = [...singleExports, ...groupExports]

    return `import { css } from 'lit';\n\n${propsExport}\n\n${allExports.join('\n\n')}`
  },
})

for (let mode of ['light', 'dark']) {
  const components = (await glob(`theme/${mode}/components/*.json`)).map((c) =>
    c.replace(/^.*?\/([^/]+)\.json$/, '$1'),
  )

  const variablesFilter = (token) => !token.filePath.includes('components')

  const sd = new StyleDictionary(
    {
      source: ['primitives/*.json', 'theme/*.json', `theme/${mode}/**/*.json`],
      platforms: {
        css: {
          transformGroup: 'css',
          transforms: [transforms.sizeRem],
          buildPath: `dist/`,
          files: [
            {
              destination: `${mode}.css`,
              format: 'css/variables',
              options: {
                outputReferences: true,
              },
              filter: variablesFilter,
            },
            ...components.map((component) => ({
              destination: `${component}.js`,
              format: 'javascript/lit',
              options: {
                outputReferences: true,
              },
              filter: (token) =>
                token.filePath.includes(`components/${component}.json`),
            })),
            ...components.map((component) => ({
              destination: `${component}.d.ts`,
              format: 'typescript/lit',
              filter: (token) =>
                token.filePath.includes(`components/${component}.json`),
            })),
          ],
        },
        ts: {
          transformGroup: 'js',
          transforms: [transforms.nameCamel],
          buildPath: `dist/`,
          files: [
            {
              destination: `${mode}.js`,
              format: 'javascript/esm',
            },
            {
              destination: `${mode}.d.ts`,
              format: 'typescript/module-declarations',
            },
          ],
        },
      },
    },
    { verbosity: 'verbose' },
  )

  await sd.buildAllPlatforms()
}

// Combine light and dark CSS variables into one file
const light = await fs.readFile('dist/light.css', 'utf-8')
const dark = await fs.readFile('dist/dark.css', 'utf-8')

const propertiesPattern = /(--[^:]+?):\s*([^;]+?);/g
const lightDark = {}

light.matchAll(propertiesPattern).forEach(([, prop, value]) => {
  lightDark[prop] = value
})

// Any dark values that are not in light are added and any that
// are different are combined into light-dark()
dark.matchAll(propertiesPattern).forEach(([, prop, value]) => {
  if (!lightDark[prop]) {
    lightDark[prop] = value
  } else if (lightDark[prop] !== value) {
    lightDark[prop] = `light-dark(${lightDark[prop]}, ${value})`
  }
})

await fs.writeFile(
  'dist/variables.css',
  `:root {\n${Object.entries(lightDark)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n')}\n}`,
  'utf-8',
)
