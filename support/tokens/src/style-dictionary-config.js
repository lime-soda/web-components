import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'
import { typescriptLitFormat, javascriptLitFormat } from './formats.js'

/**
 * Creates Style Dictionary configuration for a specific mode
 */
function createStyleDictionaryConfig(mode, components) {
  const variablesFilter = (token) => !token.filePath.includes('components')

  const files = [
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
  ]

  // Add complete token export for light mode only
  if (mode === 'light') {
    files.push(
      {
        destination: 'index.js',
        format: 'javascript/esm',
        options: {
          outputReferences: true,
        },
      },
      {
        destination: 'index.d.ts',
        format: 'typescript/module-declarations',
      },
    )
  }

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
        files,
      },
    },
  }
}

/**
 * Creates and configures Style Dictionary instance with custom formats
 */
function createStyleDictionary(mode, components) {
  const config = createStyleDictionaryConfig(mode, components)
  const sd = new StyleDictionary(config, { verbosity: 'verbose' })

  sd.registerFormat({
    name: 'typescript/lit',
    format: typescriptLitFormat,
  })

  sd.registerFormat({
    name: 'javascript/lit',
    format: javascriptLitFormat,
  })

  return sd
}

/**
 * Builds Style Dictionary for a specific mode
 */
export async function buildStyleDictionary(mode, components) {
  try {
    const sd = createStyleDictionary(mode, components)
    await sd.buildAllPlatforms()
  } catch (error) {
    throw new Error(
      `Failed to build Style Dictionary for ${mode} mode: ${error.message}`,
    )
  }
}
