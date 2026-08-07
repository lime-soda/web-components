import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      // Errors, not warnings: a warning does not fail a build or refuse a
      // commit, so unused imports and dead locals accumulate exactly as they
      // did when there was no linter at all.
      'no-unused-vars': 'error',
      'typescript/no-unused-vars': 'error',
      // Cannot tell a defensive copy from a pointless one. Every spread it
      // flags here guards an iteration against mutation during the loop.
      'unicorn/no-useless-spread': 'off',
    },
    options: { typeAware: true, typeCheck: true },
  },
  /**
   * Run on the files a commit is about to include, so a fix lands in that
   * commit rather than in a follow-up "lint" commit a week later.
   *
   * Formatting and the fixable lint rules are applied; anything left is a real
   * decision and fails the commit rather than being papered over.
   */
  staged: {
    // Split by what each tool can actually read. Pointing the linter at a
    // markdown-only commit made it fail with "no files found to lint", which
    // refused the commit for having nothing wrong with it.
    '*.{ts,js,mjs,cjs}': ['vp fmt', 'vp lint --fix'],
    '*.{json,css,md}': ['vp fmt'],
  },
  fmt: {
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 100,
    sortPackageJson: false,
    ignorePatterns: [],
  },
});
