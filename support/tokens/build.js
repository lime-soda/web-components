import StyleDictionary from 'style-dictionary'
import { propertyFormatNames, transforms } from 'style-dictionary/enums'
import { formattedVariables } from 'style-dictionary/utils'
import fs from 'node:fs/promises'
import { glob } from 'glob'

StyleDictionary.registerFormat({
  name: 'typescript/lit',
  format() {
    return `import type { CSSResultGroup } from 'lit';\n\nconst css: CSSResultGroup;\nexport default css;`
  },
})

StyleDictionary.registerFormat({
  name: 'javascript/lit',
  format: async ({ dictionary, options }) => {
    const { outputReferences } = options
    return (
      `import { css } from 'lit';\n\nexport default css\`:host {\n` +
      formattedVariables({
        format: propertyFormatNames.css,
        dictionary,
        outputReferences,
        usesDtcg: true,
      }) +
      '\n}`\n'
    )
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
