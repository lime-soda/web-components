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
 * Extracts component tokens from the tokens package import
 * @param {string} componentName - Name of the component (e.g., 'button')
 * @returns {Promise<Array>} Array of {name, description} objects
 */
async function extractComponentTokens(componentName) {
  try {
    const properties = []

    // Import the main tokens package to get access to the complete token tree
    const tokensModule = await import('@lime-soda/tokens')
    const allTokens = tokensModule.default

    // Look for component-specific tokens at the top level
    const componentTokens = allTokens[componentName]

    if (componentTokens) {
      // Recursively extract tokens from the component section
      function extractTokens(tokenObj) {
        for (const [, value] of Object.entries(tokenObj)) {
          if (value && typeof value === 'object') {
            if (value.$value !== undefined && value.name) {
              // This is a token
              properties.push({
                name: `--${value.name}`,
                description: value.$description || undefined,
              })
            } else {
              // Recurse into nested objects
              extractTokens(value)
            }
          }
        }
      }

      extractTokens(componentTokens)
    } else {
      console.warn(
        `⚠️ No tokens found for component '${componentName}' at top level`,
      )
    }

    return properties
  } catch (error) {
    console.warn(
      `⚠️ Could not load component tokens for '${componentName}': ${error.message}`,
    )
    return []
  }
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
    console.log('🎨 Loading component tokens...')

    // Extract CSS properties from component token export
    const cssProperties = await extractComponentTokens(componentName)

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
