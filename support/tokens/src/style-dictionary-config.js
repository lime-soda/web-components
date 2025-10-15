import StyleDictionary from 'style-dictionary'
import { transforms } from 'style-dictionary/enums'
import { typescriptLitFormat, javascriptLitFormat } from './formats.js'

/**
 * Creates Style Dictionary configuration for a specific mode
 */
function createStyleDictionaryConfig(mode, components) {
  // Filter for theme and definition tokens (excludes components)
  const globalVariablesFilter = (token) =>
    !token.filePath.includes('components/') &&
    (token.filePath.includes('definitions/') ||
      token.filePath.includes('theme/'))

  // Filter for component-specific tokens
  const componentFilter = (componentName) => (token) =>
    token.filePath.includes(`components/${componentName}.json`)

  const files = [
    // Global CSS variables (definitions + theme tokens)
    {
      destination: 'variables.css',
      format: 'css/variables',
      options: {
        outputReferences: true,
      },
      filter: globalVariablesFilter,
    },
    // Component-specific JS exports
    ...components.map((component) => ({
      destination: `${component}.js`,
      format: 'javascript/lit',
      options: {
        outputReferences: true,
      },
      filter: componentFilter(component),
    })),
    // Component-specific TypeScript definitions
    ...components.map((component) => ({
      destination: `${component}.d.ts`,
      format: 'typescript/lit',
      filter: componentFilter(component),
    })),
    // Component-specific CSS (isolated component tokens)
    ...components.map((component) => ({
      destination: `${component}.css`,
      format: 'css/variables',
      options: {
        outputReferences: true,
        selector: `:root, :host`,
      },
      filter: componentFilter(component),
    })),
  ]

  // Add complete token export for light mode only
  if (mode === 'light') {
    files.push(
      {
        destination: 'index.js',
        format: 'javascript/esm',
        filter: globalVariablesFilter,
      },
      {
        destination: 'index.d.ts',
        format: 'typescript/module-declarations',
        filter: globalVariablesFilter,
      },
    )
  }

  return {
    source: [
      'definitions/**/*.json', // Tier 1: Raw values
      `theme/${mode}/**/*.json`, // Tier 2: Semantic tokens for this mode
      'components/**/*.json', // Tier 3: Component tokens
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
