import type { Package, ClassField } from 'custom-elements-manifest/schema.js'

export type CustomElementsManifest = Package

export interface ComponentInfo {
  name: string
  tagName: string
  description?: string
  packageName: string
  packagePath: string
  attributes: Array<{
    name: string
    type?: string
    default?: string
    description?: string
  }>
  slots: Array<{
    name: string
    description?: string
  }>
  cssParts: Array<{
    name: string
    description?: string
  }>
  properties: Array<{
    name: string
    type?: string
    default?: string
    description?: string
  }>
}

export function extractComponentInfo(
  manifest: CustomElementsManifest,
  packageName: string,
  packagePath: string,
): ComponentInfo[] {
  const components: ComponentInfo[] = []

  if (!manifest.modules) {
    return components
  }

  for (const module of manifest.modules) {
    if (!module.declarations) continue

    for (const declaration of module.declarations) {
      // Check if this is a custom element class declaration
      if (
        declaration.kind === 'class' &&
        'customElement' in declaration &&
        declaration.customElement &&
        'tagName' in declaration &&
        declaration.tagName
      ) {
        const component: ComponentInfo = {
          name: declaration.name,
          tagName: declaration.tagName,
          description: declaration.description,
          packageName,
          packagePath,
          attributes:
            declaration.attributes?.map((attr) => ({
              name: attr.name,
              type: attr.type?.text,
              default: attr.default,
              description: attr.description,
            })) || [],
          slots:
            declaration.slots?.map((slot) => ({
              name: slot.name || '',
              description: slot.description,
            })) || [],
          cssParts:
            declaration.cssParts?.map((part) => ({
              name: part.name,
              description: part.description,
            })) || [],
          properties:
            declaration.members
              ?.filter(
                (member): member is ClassField => member.kind === 'field',
              )
              .map((prop) => ({
                name: prop.name,
                type: prop.type?.text,
                default: prop.default,
                description: prop.description,
              })) || [],
        }

        components.push(component)
      }
    }
  }

  return components
}
