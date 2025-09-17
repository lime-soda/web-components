#!/usr/bin/env node

import { create, ts } from '@custom-elements-manifest/analyzer'
import { litPlugin } from '@custom-elements-manifest/analyzer/src/features/framework-plugins/lit/lit.js'
import { glob } from 'glob'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createCssCustomPropertiesPlugin } from './src/plugins/index.js'

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
 * Runs Custom Elements Manifest analysis programmatically with CSS custom properties plugin
 * @param {string} componentName - Detected component name for token lookup
 * @returns {Promise<Object>} Generated manifest with CSS properties
 */
async function runCEMAnalysis(componentName) {
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

  // Import design tokens
  let cssPropertiesPlugin = null
  try {
    const tokensModule = await import('@lime-soda/tokens')
    const tokens = tokensModule.default

    // Create CSS custom properties plugin with tokens
    cssPropertiesPlugin = createCssCustomPropertiesPlugin(tokens, {
      elementPrefix: 'ls-',
      componentName,
    })

    console.log('🎨 CSS Custom Properties Plugin configured with design tokens')
  } catch (error) {
    console.warn(`⚠️ Could not load design tokens: ${error.message}`)
    console.warn('📝 Manifest will be generated without CSS custom properties')
  }

  // Prepare plugins array
  const plugins = [...litPlugin()]
  if (cssPropertiesPlugin) {
    plugins.push(cssPropertiesPlugin)
  }

  // Run CEM analysis with plugins enabled
  const manifest = create({
    modules,
    plugins,
    context: { dev: false, litelement: true },
  })

  console.log('✅ Custom Elements Manifest analysis complete')
  return manifest
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

    // Run CEM analysis with CSS custom properties plugin
    const manifest = await runCEMAnalysis(detectedName)

    // Write final manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    const tokenCount =
      manifest.modules?.[0]?.declarations?.[0]?.cssProperties?.length || 0

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
