import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'

/**
 * Creates Style Dictionary configuration for a specific mode
 */
export function createStyleDictionaryConfig(mode, components) {
  const variablesFilter = (token) => !token.filePath.includes('components')

  return {
    source: [
      'primitives/**/*.json',
      'globals/**/*.json',
      `theme/${mode}/**/*.json`,
    ],
    platforms: {
      css: {
        transformGroup: 'css',
        transforms: [transforms.sizeRem],
        buildPath: `dist/${mode}/`,
        files: [
          {
            destination: 'variables.css',
            format: 'css/variables',
            options: {
              outputReferences: true,
            },
            filter: variablesFilter,
          },
          ...components.map((component) => ({
            destination: `${component}.js`,
            format: 'javascript/lit',
            options: {
              outputReferences: true,
            },
            filter: (token) =>
              token.filePath.includes(`components/${component}.json`),
          })),
          ...components.map((component) => ({
            destination: `${component}.d.ts`,
            format: 'typescript/lit',
            filter: (token) =>
              token.filePath.includes(`components/${component}.json`),
          })),
        ],
      },
    },
  }
}

/**
 * Builds Style Dictionary for a specific mode
 */
export async function buildStyleDictionary(mode, components) {
  try {
    const config = createStyleDictionaryConfig(mode, components)
    const sd = new StyleDictionary(config, { verbosity: 'verbose' })
    await sd.buildAllPlatforms()
  } catch (error) {
    throw new Error(
      `Failed to build Style Dictionary for ${mode} mode: ${error.message}`,
    )
  }
}
