import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'
import { glob } from 'glob'

StyleDictionary.registerTransform({
  name: 'javascript/cssRef',
  type: 'value',
  transform: (token) => {
    return `var(--${token.path.join('-')})`
  },
})

const themes = (await glob('theme/*/')).map((dir) => dir.replace('theme/', ''))

for (const theme of themes) {
  await buildTheme(theme)
}

function buildTheme(theme) {
  const sd = new StyleDictionary({
    source: ['primitives/*.json', `theme/${theme}/**/*.json`],
    platforms: {
      css: {
        transformGroup: 'css',
        transforms: [transforms.sizeRem],
        buildPath: `dist/${theme}`,
        files: [
          {
            destination: `tokens.css`,
            format: 'css/variables',
            options: {
              outputReferences: true,
            },
          },
        ],
      },
      jsVars: {
        transformGroup: 'js',
        transforms: [transforms.nameCamel, 'javascript/cssRef'],
        buildPath: `dist/${theme}`,
        files: [
          {
            destination: `variables.js`,
            format: 'javascript/es6',
          },
        ],
      },
      js: {
        transformGroup: 'js',
        transforms: [transforms.nameCamel],
        buildPath: `dist/${theme}`,
        files: [
          {
            destination: `index.js`,
            format: 'javascript/esm',
          },
        ],
      },
      types: {
        transformGroup: 'js',
        transforms: [transforms.nameCamel],
        buildPath: `dist/${theme}`,
        files: [
          {
            destination: `index.d.ts`,
            format: 'typescript/es6-declarations',
          },
        ],
      },
    },
  })

  return sd.buildAllPlatforms()
}
