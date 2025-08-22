import { getAllComponents } from '../utils/combined-manifest.js'
import type { ComponentInfo } from '../utils/manifest.js'

async function loadAllComponents(): Promise<ComponentInfo[]> {
  return await getAllComponents()
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
          attr.description?.toLowerCase().includes(lowerQuery) ||
          attr.summary?.toLowerCase().includes(lowerQuery),
      ) ||
      comp.slots.some(
        (slot) =>
          slot.name.toLowerCase().includes(lowerQuery) ||
          slot.description?.toLowerCase().includes(lowerQuery) ||
          slot.summary?.toLowerCase().includes(lowerQuery),
      ) ||
      comp.cssParts.some(
        (part) =>
          part.name.toLowerCase().includes(lowerQuery) ||
          part.description?.toLowerCase().includes(lowerQuery) ||
          part.summary?.toLowerCase().includes(lowerQuery),
      ) ||
      comp.properties.some(
        (prop) =>
          prop.name.toLowerCase().includes(lowerQuery) ||
          prop.description?.toLowerCase().includes(lowerQuery),
      ) ||
      comp.cssProperties.some(
        (cssProp) =>
          cssProp.name.toLowerCase().includes(lowerQuery) ||
          cssProp.description?.toLowerCase().includes(lowerQuery) ||
          cssProp.summary?.toLowerCase().includes(lowerQuery),
      ),
  )
}

export async function getComponentCssProperties(nameOrTag: string): Promise<{
  name: string
  cssProperties: ComponentInfo['cssProperties']
} | null> {
  const component = await getComponentDetails(nameOrTag)
  if (!component) return null

  return {
    name: component.name,
    cssProperties: component.cssProperties,
  }
}

export function clearCache(): void {
  // Cache clearing is now handled by the combined manifest utility
}
