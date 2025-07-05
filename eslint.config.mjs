import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import json from '@eslint/json'
import css from '@eslint/css'

export default tseslint.config(
  {
    ignores: ['**/dist/*', '**/node_modules/*', 'storybook-static'],
  },
  js.configs.recommended,
  json.configs.recommended,
  tseslint.configs.recommended,
  css.configs.recommended,
  {
    files: ['./packages/**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['./tools/**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: globals.node },
  },
)
