#!/usr/bin/env node

import { build as esbuild } from 'esbuild'
import path from 'node:path'

async function build(options) {
  return esbuild({
    bundle: false,
    format: 'esm',
    ...options,
  })
}

// TODO: get from argv
const args = {}

// TODO: glob from src
const entryPoints = [path.join(process.cwd(), 'src/index.js')]
const outdir = path.join(process.cwd(), 'dist')

await build({ entryPoints, outdir, ...args })
