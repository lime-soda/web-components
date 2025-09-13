#!/usr/bin/env node

import { discoverComponents } from './src/component-discovery.js'
import { buildStyleDictionary } from './src/style-dictionary-config.js'
import {
  combineComponentFiles,
  combineVariableFiles,
} from './src/file-combiner.js'

/**
 * Main build process for design tokens
 */
async function build() {
  try {
    console.log('🚀 Building design tokens...')

    const components = await discoverComponents()
    console.log(
      `📦 Discovered ${components.light.length} light components, ${components.dark.length} dark components`,
    )

    for (const mode of ['light', 'dark']) {
      await buildStyleDictionary(mode, components[mode])
      console.log(`✅ Built ${mode} mode tokens`)
    }

    await combineComponentFiles(components)
    console.log('✅ Combined component files')

    await combineVariableFiles()
    console.log('✅ Combined variable files')

    console.log('🎉 Design tokens build complete!')
  } catch (error) {
    console.error('❌ Build failed:', error.message)
    process.exit(1)
  }
}

build()
