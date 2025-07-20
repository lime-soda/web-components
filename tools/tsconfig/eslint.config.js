// @ts-check
import js from '@eslint/js'

export default [
  {
    ignores: ['**/dist/*', '**/node_modules/*'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
]