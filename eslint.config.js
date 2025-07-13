// ts-check
import css from '@eslint/css'
import js from '@eslint/js'
import json from '@eslint/json'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
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
  {
    files: ['./packages/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['./tools/**', './support/**'],
    languageOptions: {
      globals: globals.node,
    },
  },
)
