import { glob } from 'glob'

/**
 * Discovers available components for light and dark modes
 */
export async function discoverComponents() {
  const components = { light: [], dark: [] }

  try {
    for (const mode of ['light', 'dark']) {
      const componentFiles = await glob(`theme/${mode}/components/*.json`)
      components[mode] = componentFiles.map((filePath) =>
        filePath.replace(/^.*?\/([^/]+)\.json$/, '$1'),
      )
    }
    return components
  } catch (error) {
    throw new Error(`Failed to discover components: ${error.message}`)
  }
}
