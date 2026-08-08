import type { StorybookConfig } from '@storybook/web-components-vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  viteFinal: (config) => {
    config.plugins?.push(tsconfigPaths());
    // Resolve workspace packages through their `development` condition, which
    // points at source, so a change in a package shows up here without a build
    // step. The grid also uses standard decorators, which must be downlevelled:
    // esnext leaves them as native syntax no browser can parse yet.
    config.resolve = {
      ...config.resolve,
      conditions: ['development', 'browser', 'import', 'module', 'default'],
    };
    config.esbuild = { ...config.esbuild, target: 'es2022' };
    return config;
  },
};

export default config;
