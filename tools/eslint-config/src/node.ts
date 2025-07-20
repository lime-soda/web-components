import globals from 'globals'
import tseslint from 'typescript-eslint'
import baseConfig from './index.js'

/**
 * ESLint configuration for Node.js packages (tools, support)
 */
const config: any = tseslint.config(
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