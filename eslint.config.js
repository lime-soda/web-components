// @ts-check
import { globalIgnores } from 'eslint/config'
import config from '@lime-soda/eslint-config/storybook'

export default [
  globalIgnores([
    'tools/**',
    'packages/**',
    '!packages/**/*.stories.ts',
    'support/**',
  ]),
  ...config,
]
