import globals from 'globals'
import tseslint, { type ConfigArray } from 'typescript-eslint'
import baseConfig from './index.js'

/**
 * ESLint configuration for browser/web component packages
 */
const config: ConfigArray = tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
    ...tseslint.configs.disableTypeChecked,
  },
)

export default config
