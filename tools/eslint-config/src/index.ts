import css from '@eslint/css'
import js from '@eslint/js'
import json from '@eslint/json'
import tseslint, { type ConfigArray } from 'typescript-eslint'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

const config: ConfigArray = tseslint.config(
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
  eslintPluginPrettierRecommended,
)

export default config
