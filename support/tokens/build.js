import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'
import { glob } from 'glob'
import * as prettier from 'prettier'

StyleDictionary.registerTransform({
  name: 'javascript/litRef',
  type: 'value',
  transitive: true,
  transform: (token) => {
    return `css\`var(--${token.path.join('-')})\``
  },
})

StyleDictionary.registerTransform({
  name: 'css/mode',
  type: 'value',
  transitive: true,
  transform: (token) => {
    if (token.$extensions?.['org.lime-soda']?.modes?.dark) {
      return `light-dark(${token.$value}, ${token.$extensions['org.lime-soda'].modes.dark.$value})`
    }

    return token.$value
  },
})

StyleDictionary.registerFormat({
  name: 'javascript/lit',
  format({ dictionary }) {
    return prettier.format(
      `import { css } from 'lit';\n\n${dictionary.allTokens.map((token) => `export const ${token.name} = ${token.$value};`).join('\n')}`,
      { parser: 'babel' },
    )
  },
})

StyleDictionary.registerFormat({
  name: 'typescript/lit',
  format({ dictionary }) {
    return `import type { CSSResultGroup } from 'lit';\n\n${dictionary.allTokens.map((token) => `export const ${token.name}: CSSResultGroup;`).join('\n')}`
  },
})

const themes = (await glob('theme/*/')).map((dir) => dir.replace('theme/', ''))

for (const theme of themes) {
  await buildTheme(theme)
}

async function buildTheme(theme) {
  const sd = new StyleDictionary({
    source: ['primitives/*.json', `theme/${theme}/**/*.json`],
    platforms: {
      css: {
        transformGroup: 'css',
        transforms: [transforms.sizeRem, 'css/mode'],
        buildPath: `dist/css`,
        files: [
          {
            destination: `${theme}.css`,
            format: 'css/variables',
            options: {
              // outputReferences: true,
            },
          },
        ],
      },
      js: {
        transformGroup: 'js',
        transforms: [transforms.nameCamel, 'javascript/litRef'],
        buildPath: `dist/${theme}`,
        files: [
          {
            destination: `index.js`,
            format: 'javascript/lit',
            options: {
              outputReferences: true,
            },
          },
        ],
      },
      typescript: {
        transformGroup: 'js',
        transforms: [transforms.nameCamel],
        buildPath: `dist/${theme}`,
        files: [
          {
            destination: `index.d.ts`,
            format: 'typescript/lit',
          },
        ],
      },
    },
  })

  await sd.buildAllPlatforms()
}
