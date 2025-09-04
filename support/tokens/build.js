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
        buildPath: `dist/css`,
        files: [
          {
            destination: `${theme}.css`,
            format: 'css/variables',
            options: {
              outputReferences: true,
            },
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
            format: 'typescript/module-declarations',
          },
        ],
      },
    },
  })

  return sd.buildAllPlatforms()
}

const darkTheme = await import('./dist/dark/index.js')
const lightTheme = await import('./dist/light/index.js')

function flattenLightDark(light, dark, acc = {}) {
  for (let [key, tokenOrType] of Object.entries(light)) {
    if ('$value' in tokenOrType) {
      const path = tokenOrType.path.join('-')

      acc[key] =
        `--${path}: light-dark(${light[key].$value}, ${dark[key].$value})`
    } else {
      acc = {
        ...acc,
        [key]: { ...flattenLightDark(light[key], dark[key] || acc) },
      }
    }
  }

  return acc
}

console.log(flattenLightDark(lightTheme.default.color, darkTheme.default.color))
