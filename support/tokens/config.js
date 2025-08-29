import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'

StyleDictionary.registerTransform({
  name: 'javascript/cssRef',
  type: 'value',
  transform: (token) => {
    console.log(`var(--${token.path.join('-')})`)
    return `var(--${token.path.join('-')})`
  },
})

export default {
  source: ['primitives/**/*.json', 'theme/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      transforms: [transforms.sizeRem],
      buildPath: 'dist/css/',
      files: [
        {
          destination: 'tokens.css',
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
          destination: 'tokens.js',
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
          destination: 'tokens.d.ts',
          format: 'typescript/es6-declarations',
        },
      ],
    },
  },
}
