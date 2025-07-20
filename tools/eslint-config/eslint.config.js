// @ts-check
import config from '@lime-soda/eslint-config/node'

export default [
  ...config,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
]