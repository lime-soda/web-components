import { build as esbuild } from 'esbuild'

export default function build(options) {
  return esbuild({
    bundle: true,
    format: 'esm',
    ...options,
  })
}
