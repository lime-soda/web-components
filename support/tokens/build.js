import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'
import * as prettier from 'prettier'
import fs from 'node:fs/promises'

StyleDictionary.registerTransform({
  name: 'javascript/cssRef',
  type: 'value',
  transitive: true,
  transform: (token) => {
    return `var(--${token.path.join('-')})`
  },
})

StyleDictionary.registerFormat({
  name: 'javascript/lit',
  format({ dictionary }) {
    return prettier.format(
      `import { css } from 'lit';\n\n${dictionary.allTokens
        .map((token) => `export const ${token.name} = css\`${token.$value}\`;`)
        .join('\n')}`,
      { parser: 'babel' },
    )
  },
})

StyleDictionary.registerFormat({
  name: 'typescript/lit',
  format({ dictionary }) {
    return `import type { CSSResultGroup } from 'lit';\n\n${dictionary.allTokens
      .map((token) => `export const ${token.name}: CSSResultGroup;`)
      .join('\n')}`
  },
})

for (let mode of ['light', 'dark']) {
  const sd = new StyleDictionary(
    {
      source: ['primitives/*.json', 'theme/*.json', `theme/${mode}/*.json`],
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
            },
          ],
        },
        js: {
          transformGroup: 'js',
          transforms: [transforms.nameCamel, 'javascript/cssRef'],
          buildPath: `dist/`,
          files: [
            {
              destination: `${mode}.js`,
              format: 'javascript/lit',
            },
          ],
        },
        ts: {
          transformGroup: 'js',
          transforms: [transforms.nameCamel],
          buildPath: `dist/`,
          files: [
            {
              destination: `${mode}.d.ts`,
              format: 'typescript/lit',
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
dark.matchAll(propertiesPattern).forEach(([, prop, value]) => {
  if (lightDark[prop] && lightDark[prop] !== value) {
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
