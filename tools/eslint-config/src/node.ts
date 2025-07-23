import globals from 'globals'
import tseslint, { type ConfigArray } from 'typescript-eslint'
import baseConfig from './index.js'

const config: ConfigArray = tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
)

export default config
