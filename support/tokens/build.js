import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'

StyleDictionary.registerTransform({
  name: 'javascript/cssRef',
  type: 'value',
  transform: (token) => {
    return `var(--${token.path.join('-')})`
  },
})

const themeModes = ['light', 'dark']

for (const mode of themeModes) {
  await buildTheme(mode)
}

function buildTheme(mode) {
  const sd = new StyleDictionary({
    source: ['primitives/*.json', 'theme/common.json', `theme/${mode}.json`],
    platforms: {
      css: {
        transformGroup: 'css',
        transforms: [transforms.sizeRem],
        buildPath: 'dist/css/',
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
        buildPath: 'dist/',
        files: [
          {
            destination: `${mode}.js`,
            format: 'javascript/es6',
            options: {
              outputReferences: true,
            },
          },
        ],
      },
      types: {
        transformGroup: 'js',
        transforms: [transforms.nameCamel],
        buildPath: 'dist/',
        files: [
          {
            destination: `${mode}.d.ts`,
            format: 'typescript/es6-declarations',
          },
        ],
      },
    },
  })

  return sd.buildAllPlatforms()
}
