import globals from 'globals'
import tseslint, { type ConfigArray } from 'typescript-eslint'
import baseConfig from './index.js'

/**
 * ESLint configuration for Storybook files
 */
const config: ConfigArray = tseslint.config(
  ...baseConfig,
  {
    files: ['**/*.stories.ts', '**/*.stories.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Allow default exports in story files
      'import/prefer-default-export': 'off',
      // Allow any type in story args
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)

export default config