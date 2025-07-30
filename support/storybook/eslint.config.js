import globals from 'globals'
import tseslint from 'typescript-eslint'
import baseConfig from '@lime-soda/eslint-config'

export default tseslint.config(...baseConfig, {
  files: ['**/*.ts'],
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
})
