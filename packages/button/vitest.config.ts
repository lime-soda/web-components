import { playwright } from 'vite-plus/test/browser-playwright';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  // Resolve workspace imports to source, matching the `development` export
  // condition Storybook uses.
  resolve: {
    conditions: ['development', 'browser', 'import', 'module', 'default'],
  },
  // Vite defaults esbuild to `esnext`, which leaves standard decorators and the
  // `accessor` keyword as native syntax — and no browser implements either yet,
  // so the served module fails to parse. Pinning the target downlevels them.
  esbuild: {
    target: 'es2022',
  },
  test: {
    projects: [
      {
        // A custom element needs a real one. There is nothing here that jsdom
        // could answer: shadow DOM, focus and axe all want a browser.
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          setupFiles: ['./vitest.setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
