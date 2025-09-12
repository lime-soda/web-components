#!/usr/bin/env node

import { create, ts } from '@custom-elements-manifest/analyzer'
import { litPlugin } from '@custom-elements-manifest/analyzer/src/features/framework-plugins/lit/lit.js'
import { glob } from 'glob'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Detects component name from CLI args, package.json, or directory name
 * @param {string} override - CLI argument override
 * @returns {Promise<string>} Component name
 */
async function detectComponentName(override) {
  if (override) {
    console.log(`📝 Using explicit component name: ${override}`)
    return override
  }

  try {
    // Try package.json name extraction
    const packageData = await fs.readFile('package.json', 'utf-8')
    const pkg = JSON.parse(packageData)

    if (pkg.name?.split('/').length === 2) {
      const componentName = pkg.name.split('/')[1]
      console.log(
        `📦 Detected component name from package.json: ${componentName}`,
      )
      return componentName
    }
  } catch {
    // package.json not found or invalid, continue to directory name
  }

  // Fallback to directory name
  const componentName = path.basename(process.cwd())
  console.log(`📁 Using directory name as component name: ${componentName}`)
  return componentName
}

/**
 * Recursively extracts tokens for a specific component from the token tree
 * @param {Object} tokenTree - The complete token tree from @lime-soda/tokens
 * @param {string} componentName - Name of the component (e.g., 'button')
 * @returns {Array} Array of {name, description} objects
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
 * Runs Custom Elements Manifest analysis programmatically
 * @returns {Promise<Object>} Generated manifest
 */
async function runCEMAnalysis() {
  console.log('🔍 Analyzing TypeScript files...')

  // Find all TypeScript files
  const sourceFiles = await glob('src/**/*.ts')

  if (sourceFiles.length === 0) {
    throw new Error('No TypeScript files found in src/ directory')
  }

  console.log(`📄 Found ${sourceFiles.length} TypeScript files`)

  // Create TypeScript source files
  const modules = await Promise.all(
    sourceFiles.map(async (filePath) => {
      const content = await fs.readFile(filePath, 'utf-8')
      return ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.ES2015,
        true,
      )
    }),
  )

  // Run CEM analysis with Lit support enabled
  const manifest = create({
    modules,
    plugins: [...litPlugin()],
    context: { dev: false, litelement: true },
  })

  console.log('✅ Custom Elements Manifest analysis complete')
  return manifest
}

/**
 * Enhances manifest with CSS properties from design tokens
 * @param {Object} manifest - Base manifest from CEM analysis
 * @param {string} componentName - Component name for token lookup
 * @returns {Promise<Object>} Enhanced manifest
 */
async function enhanceWithTokens(manifest, componentName) {
  try {
    console.log('🎨 Loading design tokens...')

    // Import tokens using the main package export
    const tokensModule = await import('@lime-soda/tokens')
    const tokenTree = tokensModule.default

    // Extract CSS properties from token tree
    const cssProperties = extractComponentTokens(tokenTree, componentName)

    if (cssProperties.length === 0) {
      console.warn(`⚠️ No tokens found for component '${componentName}'`)
      return manifest
    }

    // Find the component declaration
    const declaration = manifest.modules?.[0]?.declarations?.find(
      (decl) => decl.kind === 'class' && decl.customElement,
    )

    if (!declaration) {
      console.warn('⚠️ No custom element declaration found in manifest')
      return manifest
    }

    // Update CSS properties
    declaration.cssProperties = cssProperties

    console.log(
      `🎯 Enhanced manifest with ${cssProperties.length} CSS properties`,
    )
    return manifest
  } catch (error) {
    console.warn(`⚠️ Could not load tokens: ${error.message}`)
    console.warn('📝 Manifest will be generated without token enhancement')
    return manifest
  }
}

/**
 * Main function to build manifest
 */
async function buildManifest() {
  const componentName = process.argv[2]
  const manifestPath = path.join(process.cwd(), 'custom-elements.json')

  try {
    console.log('🚀 Building Custom Elements Manifest...')

    // Detect component name
    const detectedName = await detectComponentName(componentName)

    // Run CEM analysis
    const baseManifest = await runCEMAnalysis()

    // Enhance with design tokens
    const enhancedManifest = await enhanceWithTokens(baseManifest, detectedName)

    // Write final manifest
    await fs.writeFile(manifestPath, JSON.stringify(enhancedManifest, null, 2))

    const tokenCount =
      enhancedManifest.modules?.[0]?.declarations?.[0]?.cssProperties?.length ||
      0

    console.log('✨ Custom Elements Manifest built successfully!')
    console.log(`📁 Written to: ${manifestPath}`)
    if (tokenCount > 0) {
      console.log(`🎨 Includes ${tokenCount} CSS properties from design tokens`)
    }
  } catch (error) {
    console.error('❌ Error building manifest:', error.message)
    process.exit(1)
  }
}

// CLI usage
buildManifest()
