import globals from 'globals'
import tseslint from 'typescript-eslint'
import storybook from 'eslint-plugin-storybook'
import baseConfig from '@lime-soda/eslint-config'

export default tseslint.config(
  baseConfig,
  {
    files: ['**/*.stories.ts', '**/*.stories.js'],
    ignores: ['!.storybook'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  storybook.configs['flat/recommended'],
)
