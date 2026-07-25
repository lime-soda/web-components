import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve workspace imports to source during tests, matching the `development`
  // export condition used by Storybook.
  resolve: {
    conditions: ['development', 'browser', 'import', 'module', 'default'],
  },
  // Vite defaults esbuild to `esnext`, which leaves standard decorators as native
  // syntax — and no browser implements them yet, so the served module fails to
  // parse. Pinning the target makes esbuild downlevel them.
  esbuild: {
    target: 'es2022',
  },
  test: {
    projects: [
      {
        // Pure units: stores, projection stages, layout engines. No DOM required,
        // so these stay fast enough to run on every save.
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        // Custom elements, real layout measurement and real IntersectionObserver.
        // jsdom cannot do any of those three, which is why these run in Chromium.
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
