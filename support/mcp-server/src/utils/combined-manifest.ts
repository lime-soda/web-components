import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ComponentInfo } from './manifest.js'

interface CombinedManifest {
  components: ComponentInfo[]
  buildTime: string
}

let combinedManifestCache: CombinedManifest | null = null

export async function loadCombinedManifest(): Promise<CombinedManifest> {
  if (combinedManifestCache) {
    return combinedManifestCache
  }

  const manifestPath = resolve(
    import.meta.dirname,
    '../../combined-manifest.json',
  )

  try {
    const content = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(content) as CombinedManifest
    combinedManifestCache = manifest
    return manifest
  } catch (error) {
    console.error('Failed to load combined manifest:', error)
    console.error(
      'Make sure to run the build process to generate the combined manifest',
    )
    throw new Error('Combined manifest not found. Run build process first.')
  }
}

export function clearCombinedManifestCache(): void {
  combinedManifestCache = null
}

export async function getAllComponents(): Promise<ComponentInfo[]> {
  const manifest = await loadCombinedManifest()
  return manifest.components
}
