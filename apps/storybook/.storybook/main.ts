import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  viteFinal: (config) => ({
    ...config,
    // Resolve flow-grid to source, so a change in the package shows up here
    // without a build step.
    resolve: {
      ...config.resolve,
      conditions: ['development', 'browser', 'import', 'module', 'default'],
    },
    // Standard decorators must be downlevelled; esnext leaves them as native
    // syntax that no browser can parse yet.
    esbuild: { ...config.esbuild, target: 'es2022' },
  }),
};

export default config;
