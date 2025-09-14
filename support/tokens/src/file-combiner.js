import {
  readFile,
  writeFile,
  copyFile,
  createCSSProperties,
  combineLightDarkValues,
} from './utils.js'

/**
 * Combines light and dark component files into unified files with light-dark() values
 */
export async function combineComponentFiles(components) {
  for (const component of components.light) {
    try {
      await copyFile(`dist/light/${component}.d.ts`, `dist/${component}.d.ts`)

      if (!components.dark.includes(component)) {
        await copyFile(`dist/light/${component}.js`, `dist/${component}.js`)
        continue
      }

      const light = await readFile(`dist/light/${component}.js`)
      const dark = await readFile(`dist/dark/${component}.js`)

      const propsPattern = /:host {[\s\S]+?}/
      const lightProps = light.match(propsPattern)?.[0]
      const darkProps = dark.match(propsPattern)?.[0]

      if (!lightProps || !darkProps) {
        throw new Error(
          `Could not find props for light and dark modes in ${component}`,
        )
      }

      const lightDark = combineLightDarkValues(lightProps, darkProps)
      const combinedContent = light.replace(
        propsPattern,
        createCSSProperties(lightDark, ':host'),
      )

      await writeFile(`dist/${component}.js`, combinedContent)
    } catch (error) {
      throw new Error(
        `Failed to combine component files for ${component}: ${error.message}`,
      )
    }
  }
}

/**
 * Combines light and dark CSS variables into a unified file
 */
export async function combineVariableFiles() {
  try {
    const light = await readFile('dist/light/variables.css')
    const dark = await readFile('dist/dark/variables.css')
    const lightDark = combineLightDarkValues(light, dark)
    await writeFile('dist/variables.css', createCSSProperties(lightDark))
  } catch (error) {
    throw new Error(`Failed to combine variable files: ${error.message}`)
  }
}

/**
 * Copies the complete token export files from light mode to root dist
 */
export async function copyTokenExportFiles() {
  try {
    // Copy the complete token export files from light mode to root
    await copyFile('dist/light/index.js', 'dist/index.js')
    await copyFile('dist/light/index.d.ts', 'dist/index.d.ts')
  } catch (error) {
    throw new Error(`Failed to copy token export files: ${error.message}`)
  }
}
