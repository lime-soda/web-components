#!/usr/bin/env node

import { build } from 'esbuild';
import { glob } from 'glob';
import path from 'node:path';

async function buildComponent(options) {
  return build({
    bundle: false,
    format: 'esm',
    packages: 'external',
    // Without a target esbuild emits esnext, which leaves standard decorators
    // and the `accessor` keyword as native syntax. No browser implements either
    // yet, and Rollup cannot even parse `accessor`, so the published output
    // broke every consumer that bundles it.
    target: 'es2022',
    ...options,
  });
}

// TODO: get from argv
const args = {};

const entryPoints = await glob(path.join(process.cwd(), 'src/**/*.ts'));
const outdir = path.join(process.cwd(), 'dist');

await buildComponent({
  entryPoints: ['index.ts', ...entryPoints],
  outdir,
  ...args,
});
