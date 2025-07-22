// @ts-check
import config from '@lime-soda/eslint-config/browser'

/** @type {import('typescript-eslint').ConfigArray} */
const configArr = [
  {
    ignores: ['stories'],
  },
  ...config,
]

export default configArr
