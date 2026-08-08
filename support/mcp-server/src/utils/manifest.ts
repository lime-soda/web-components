import type { Package, ClassField } from 'custom-elements-manifest/schema.js';

export interface ComponentInfo {
  name: string;
  tagName: string;
  description?: string | undefined;
  packageName: string;
  packagePath: string;
  attributes: Array<{
    name: string;
    summary?: string | undefined;
    description?: string | undefined;
    type?: string | undefined;
    default?: string | undefined;
    fieldName?: string | undefined;
    deprecated?: boolean | string | undefined;
  }>;
  slots: Array<{
    name: string;
    summary?: string | undefined;
    description?: string | undefined;
    deprecated?: boolean | string | undefined;
  }>;
  cssParts: Array<{
    name: string;
    summary?: string | undefined;
    description?: string | undefined;
    deprecated?: boolean | string | undefined;
  }>;
  cssProperties: Array<{
    name: string;
    syntax?: string | undefined;
    default?: string | undefined;
    summary?: string | undefined;
    description?: string | undefined;
    deprecated?: boolean | string | undefined;
  }>;
  properties: Array<{
    name: string;
    type?: string | undefined;
    default?: string | undefined;
    description?: string | undefined;
  }>;
}

export function extractComponentInfo(
  manifest: Package,
  packageName: string,
  packagePath: string,
): ComponentInfo[] {
  const components: ComponentInfo[] = [];

  if (!manifest.modules) {
    return components;
  }

  for (const module of manifest.modules) {
    if (!module.declarations) continue;

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
              summary: attr.summary,
              description: attr.description,
              type: attr.type?.text,
              default: attr.default,
              fieldName: attr.fieldName,
              deprecated: attr.deprecated,
            })) || [],
          slots:
            declaration.slots?.map((slot) => ({
              name: slot.name || '',
              summary: slot.summary,
              description: slot.description,
              deprecated: slot.deprecated,
            })) || [],
          cssParts:
            declaration.cssParts?.map((part) => ({
              name: part.name,
              summary: part.summary,
              description: part.description,
              deprecated: part.deprecated,
            })) || [],
          cssProperties:
            declaration.cssProperties?.map((prop) => ({
              name: prop.name,
              syntax: prop.syntax,
              default: prop.default,
              summary: prop.summary,
              description: prop.description,
              deprecated: prop.deprecated,
            })) || [],
          properties:
            declaration.members
              ?.filter((member): member is ClassField => member.kind === 'field')
              .map((prop) => ({
                name: prop.name,
                type: prop.type?.text,
                default: prop.default,
                description: prop.description,
              })) || [],
        };

        components.push(component);
      }
    }
  }

  return components;
}
