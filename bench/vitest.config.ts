import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['development', 'browser', 'import', 'module', 'default'],
  },
  esbuild: { target: 'es2022' },
  test: {
    // Benchmarks are slower than tests and must not be cut short on a loaded CI box.
    testTimeout: 120_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.bench.ts'],
          exclude: ['src/**/*.browser.bench.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.bench.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [
              {
                browser: 'chromium',
                // performance.memory and a forced GC, for the heap benchmark.
                // Cast: `launch` is valid at runtime but missing from the
                // instance type in this Vitest release.
                launch: { args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] },
              } as unknown as { browser: 'chromium' },
            ],
          },
        },
      },
    ],
  },
});
