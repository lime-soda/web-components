import { glob } from 'glob'

/**
 * Discovers available components from the components directory
 * Components are now theme-agnostic and work for both light and dark modes
 */
export async function discoverComponents() {
  try {
    const componentFiles = await glob('components/*.json')
    const componentNames = componentFiles.map((filePath) =>
      filePath.replace(/^.*?\/([^/]+)\.json$/, '$1'),
    )

    // Return the same component list for both modes since components
    // now reference theme tokens that handle light/dark differences
    return {
      light: componentNames,
      dark: componentNames,
    }
  } catch (error) {
    throw new Error(`Failed to discover components: ${error.message}`)
  }
}
