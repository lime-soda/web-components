import globals from 'globals'
import tseslint, { type ConfigArray } from 'typescript-eslint'
import baseConfig from './index.js'

/**
 * ESLint configuration for Node.js packages (tools, support)
 */
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