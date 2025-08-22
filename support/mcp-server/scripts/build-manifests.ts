#!/usr/bin/env tsx

import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { glob } from 'glob'
import type { Package } from 'custom-elements-manifest'
import { readJsonFile } from '../src/utils/filesystem.js'
import {
  extractComponentInfo,
  type ComponentInfo,
} from '../src/utils/manifest.js'

interface CombinedManifest {
  components: ComponentInfo[]
  buildTime: string
}

async function buildCombinedManifest(): Promise<void> {
  console.log('Building combined manifest from custom-elements.json files...')

  const workspaceRoot = resolve(process.cwd(), '../..')
  const manifestPaths = await glob('packages/*/custom-elements.json', {
    cwd: workspaceRoot,
  })

  const components: ComponentInfo[] = []

  for (const manifestPath of manifestPaths) {
    const fullManifestPath = resolve(workspaceRoot, manifestPath)
    const packagePath = dirname(fullManifestPath)
    const packageName = packagePath.split('/').pop() || ''

    console.log(`Processing ${manifestPath}...`)

    const manifest = await readJsonFile<Package>(fullManifestPath)
    if (!manifest) {
      console.warn(`Failed to read manifest: ${fullManifestPath}`)
      continue
    }

    const componentInfos = extractComponentInfo(
      manifest,
      packageName,
      packagePath,
    )
    components.push(...componentInfos)

    console.log(`  Found ${componentInfos.length} components`)
  }

  const combinedManifest: CombinedManifest = {
    components,
    buildTime: new Date().toISOString(),
  }

  const outputDir = resolve(process.cwd(), 'dist')
  const outputPath = resolve(outputDir, 'combined-manifest.json')

  await mkdir(outputDir, { recursive: true })
  await writeFile(outputPath, JSON.stringify(combinedManifest, null, 2))

  console.log(`Combined manifest written to: ${outputPath}`)
  console.log(`Total components: ${components.length}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildCombinedManifest().catch((error) => {
    console.error('Failed to build combined manifest:', error)
    process.exit(1)
  })
}

export { buildCombinedManifest }
