export interface CustomElementsManifest {
  schemaVersion: string
  readme?: string
  modules: Array<{
    kind: string
    path: string
    declarations: Array<{
      kind: string
      name: string
      description?: string
      tagName?: string
      customElement?: boolean
      members?: Array<{
        kind: string
        name: string
        type?: { text: string }
        default?: string
        description?: string
        attribute?: string
      }>
      attributes?: Array<{
        name: string
        type?: { text: string }
        default?: string
        description?: string
        fieldName?: string
      }>
      slots?: Array<{
        name: string
        description?: string
      }>
      cssParts?: Array<{
        name: string
        description?: string
      }>
      superclass?: {
        name: string
        package?: string
      }
    }>
    exports?: Array<{
      kind: string
      name: string
      declaration: {
        name: string
        module: string
      }
    }>
  }>
}

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

  for (const module of manifest.modules) {
    for (const declaration of module.declarations) {
      if (
        declaration.kind === 'class' &&
        declaration.customElement &&
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
              name: slot.name,
              description: slot.description,
            })) || [],
          cssParts:
            declaration.cssParts?.map((part) => ({
              name: part.name,
              description: part.description,
            })) || [],
          properties:
            declaration.members
              ?.filter((member) => member.kind === 'field')
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
