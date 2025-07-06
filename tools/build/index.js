#!/usr/bin/env node

import { build } from 'esbuild'
import { glob } from 'glob'
import path from 'node:path'

async function buildComponent(options) {
  return build({
    bundle: false,
    format: 'esm',
    packages: 'external',
    ...options,
  })
}

// TODO: get from argv
const args = {}

const entryPoints = await glob(path.join(process.cwd(), 'src/**/*.ts'))
const outdir = path.join(process.cwd(), 'dist')

await buildComponent({ entryPoints, outdir, ...args })
