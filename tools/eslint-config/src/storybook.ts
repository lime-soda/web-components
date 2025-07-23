import globals from 'globals'
import tseslint, { type ConfigArray } from 'typescript-eslint'
import baseConfig from './index.js'

const config: ConfigArray = tseslint.config(...baseConfig, {
  files: ['**/*.stories.ts', '**/*.stories.js'],
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
})

export default config
