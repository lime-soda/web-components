import { basename } from 'path'
import {
  findCustomElementsManifests,
  readJsonFile,
} from '../utils/filesystem.js'
import {
  type CustomElementsManifest,
  type ComponentInfo,
  extractComponentInfo,
} from '../utils/manifest.js'

let componentsCache: ComponentInfo[] | null = null

async function loadAllComponents(): Promise<ComponentInfo[]> {
  if (componentsCache) {
    return componentsCache
  }

  const components: ComponentInfo[] = []
  const manifests = await findCustomElementsManifests()

  for (const { packagePath, manifestPath } of manifests) {
    const manifest = await readJsonFile<CustomElementsManifest>(manifestPath)
    if (!manifest) continue

    const packageName = basename(packagePath)
    const componentInfos = extractComponentInfo(
      manifest,
      packageName,
      packagePath,
    )
    components.push(...componentInfos)
  }

  componentsCache = components
  return components
}

export async function listComponents(): Promise<
  Array<{
    name: string
    tagName: string
    description?: string
    package: string
  }>
> {
  const components = await loadAllComponents()
  return components.map((comp) => ({
    name: comp.name,
    tagName: comp.tagName,
    description: comp.description,
    package: comp.packageName,
  }))
}

export async function getComponentDetails(
  nameOrTag: string,
): Promise<ComponentInfo | null> {
  const components = await loadAllComponents()
  return (
    components.find(
      (comp) =>
        comp.name.toLowerCase() === nameOrTag.toLowerCase() ||
        comp.tagName.toLowerCase() === nameOrTag.toLowerCase(),
    ) || null
  )
}

export async function searchComponents(
  query: string,
): Promise<ComponentInfo[]> {
  const components = await loadAllComponents()
  const lowerQuery = query.toLowerCase()

  return components.filter(
    (comp) =>
      comp.name.toLowerCase().includes(lowerQuery) ||
      comp.tagName.toLowerCase().includes(lowerQuery) ||
      comp.description?.toLowerCase().includes(lowerQuery) ||
      comp.attributes.some(
        (attr) =>
          attr.name.toLowerCase().includes(lowerQuery) ||
          attr.description?.toLowerCase().includes(lowerQuery),
      ) ||
      comp.properties.some(
        (prop) =>
          prop.name.toLowerCase().includes(lowerQuery) ||
          prop.description?.toLowerCase().includes(lowerQuery),
      ),
  )
}

export function clearCache(): void {
  componentsCache = null
}
