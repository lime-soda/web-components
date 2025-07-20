import css from '@eslint/css'
import js from '@eslint/js'
import json from '@eslint/json'
import tseslint from 'typescript-eslint'

/**
 * Base ESLint configuration for Lime Soda projects
 */
const config: any = tseslint.config(
  {
    ignores: ['**/dist/*', '**/node_modules/*', 'storybook-static'],
  },
  js.configs.recommended,
  json.configs.recommended,
  css.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
)

export default config