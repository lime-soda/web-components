#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Recursively extracts tokens for a specific component from the token tree
 * @param {Object} tokenTree - The complete token tree from light.js
 * @param {string} componentName - Name of the component (e.g., 'button')
 * @returns {Array} Array of {name, description, type} objects
 */
function extractComponentTokens(tokenTree, componentName) {
  const componentTokens = tokenTree[componentName]
  if (!componentTokens) {
    return []
  }

  const properties = []

  /**
   * Recursively walks the token tree to find leaf tokens
   * @param {Object} obj - Current token object or group
   * @param {Array} path - Current path array
   */
  function walkTokens(obj, path = []) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        // Check if this is a token (has $type and $value)
        if (value.$type && value.$value !== undefined) {
          const cssVarName = `--${componentName}-${path.concat(key).join('-')}`

          properties.push({
            name: cssVarName,
            description: value.$description,
          })
        } else {
          // This is a group, recurse deeper
          walkTokens(value, path.concat(key))
        }
      }
    }
  }

  walkTokens(componentTokens)
  return properties
}

/**
 * Enhances component manifest with CSS properties from design tokens
 * @param {string} componentName - Name of the component (e.g., 'button')
 */
async function enhanceComponentManifest(componentName) {
  const cwd = process.cwd()
  const manifestPath = path.join(cwd, 'custom-elements.json')

  try {
    // Load existing manifest
    const manifestData = await fs.readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(manifestData)

    // Import tokens using the main package export
    const tokensModule = await import('@lime-soda/tokens')
    const tokenTree = tokensModule.default

    // Extract CSS properties from token tree
    const cssProperties = extractComponentTokens(tokenTree, componentName)

    if (cssProperties.length === 0) {
      console.warn(`⚠️ No tokens found for component '${componentName}'`)
      return
    }

    // Find the component declaration
    const declaration = manifest.modules?.[0]?.declarations?.find(
      (decl) => decl.kind === 'class' && decl.customElement,
    )

    if (!declaration) {
      throw new Error(`Could not find component declaration in manifest`)
    }

    // Update CSS properties
    declaration.cssProperties = cssProperties.map((prop) => ({
      name: prop.name,
      description: prop.description,
    }))

    // Write enhanced manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    console.log(
      `✅ Enhanced manifest for ${componentName} with ${cssProperties.length} CSS properties`,
    )
  } catch (error) {
    console.error(
      `❌ Error enhancing manifest for ${componentName}:`,
      error.message,
    )
    process.exit(1)
  }
}

// CLI usage
const componentName = process.argv[2]
if (!componentName) {
  console.error('Usage: enhance-manifest <component-name>')
  process.exit(1)
}

enhanceComponentManifest(componentName)
