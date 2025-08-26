#!/usr/bin/env node

/**
 * Combines light and dark mode tokens into a single CSS file using the light-dark() function.
 * This script reads the generated light and dark CSS files and creates a combined file
 * that uses the modern CSS light-dark() function for automatic theme switching.
 *
 * Style Dictionary with outputReferences: true handles primitive references automatically.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist', 'css')

const LIGHT_CSS_FILE = path.join(distDir, 'tokens-light.css')
const DARK_CSS_FILE = path.join(distDir, 'tokens-dark.css')
const OUTPUT_FILE = path.join(distDir, 'tokens.css')

/**
 * Parses CSS file and extracts CSS custom properties
 * @param {string} filePath - Path to CSS file
 * @returns {Map<string, string>} Map of variable names to values
 */
function parseCSSVariables(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const variables = new Map()

  // Extract CSS custom properties using regex
  const cssVarRegex = /--([^:]+):\s*([^;]+);/g
  let match

  while ((match = cssVarRegex.exec(content)) !== null) {
    const varName = match[1].trim()
    const varValue = match[2].trim()

    // Remove comments from the value
    const cleanValue = varValue.replace(/\/\*.*?\*\//g, '').trim()
    variables.set(varName, cleanValue)
  }

  return variables
}

/**
 * Generates combined CSS using light-dark() function
 * @param {Map<string, string>} lightVars - Light mode variables
 * @param {Map<string, string>} darkVars - Dark mode variables
 * @returns {string} Combined CSS content
 */
function generateCombinedCSS(lightVars, darkVars) {
  const header = `/**
 * Design Tokens - Combined Light & Dark Mode using light-dark() function
 * Do not edit directly, this file was auto-generated.
 *
 * Uses the CSS light-dark() function for automatic theme switching.
 * Requires color-scheme property to be set on html or :root.
 */

:root {
`

  let cssContent = header

  // Get all unique variable names from both light and dark modes
  const allVarNames = new Set([...lightVars.keys(), ...darkVars.keys()])

  // Sort variables for consistent output
  const sortedVarNames = Array.from(allVarNames).sort()

  // Group variables by category for better organization
  const categories = {
    primitives: [],
    semantic: [],
    other: [],
  }

  sortedVarNames.forEach((varName) => {
    if (
      varName.startsWith('color-') &&
      /^color-(green|pink|gray|red|amber|emerald|blue|black|white)-/.test(
        varName,
      )
    ) {
      categories.primitives.push(varName)
    } else if (varName.startsWith('color-')) {
      categories.semantic.push(varName)
    } else {
      categories.other.push(varName)
    }
  })

  // Generate CSS for each category
  if (categories.primitives.length > 0) {
    cssContent += '\n  /* Primitive Colors */\n'
    categories.primitives.forEach((varName) => {
      const lightValue = lightVars.get(varName)
      const darkValue = darkVars.get(varName)

      if (lightValue && darkValue && lightValue !== darkValue) {
        // For primitives, keep hex values since they are the foundation
        cssContent += `  --${varName}: light-dark(${lightValue}, ${darkValue});\n`
      } else if (lightValue) {
        // If no dark variant or they're the same, use light value
        cssContent += `  --${varName}: ${lightValue};\n`
      }
    })
  }

  if (categories.semantic.length > 0) {
    cssContent += '\n  /* Semantic Color Tokens */\n'
    categories.semantic.forEach((varName) => {
      const lightValue = lightVars.get(varName)
      const darkValue = darkVars.get(varName)

      if (lightValue && darkValue && lightValue !== darkValue) {
        // Style Dictionary already provides proper var() references
        cssContent += `  --${varName}: light-dark(${lightValue}, ${darkValue});\n`
      } else if (lightValue) {
        // Single value (no theme variation)
        cssContent += `  --${varName}: ${lightValue};\n`
      }
    })
  }

  if (categories.other.length > 0) {
    cssContent += '\n  /* Other Design Tokens */\n'
    categories.other.forEach((varName) => {
      const lightValue = lightVars.get(varName)
      const darkValue = darkVars.get(varName)

      if (lightValue && darkValue && lightValue !== darkValue) {
        cssContent += `  --${varName}: light-dark(${lightValue}, ${darkValue});\n`
      } else if (lightValue) {
        // If no dark variant or they're the same, use light value
        cssContent += `  --${varName}: ${lightValue};\n`
      }
    })
  }

  cssContent += '}\n'

  return cssContent
}

/**
 * Main execution function
 */
function main() {
  try {
    console.log('🎨 Building combined light-dark tokens...')

    // Check if source files exist
    if (!fs.existsSync(LIGHT_CSS_FILE)) {
      throw new Error(`Light CSS file not found: ${LIGHT_CSS_FILE}`)
    }

    if (!fs.existsSync(DARK_CSS_FILE)) {
      throw new Error(`Dark CSS file not found: ${DARK_CSS_FILE}`)
    }

    // Parse CSS variables from both files
    console.log('📖 Reading light mode tokens...')
    const lightVars = parseCSSVariables(LIGHT_CSS_FILE)
    console.log(`   Found ${lightVars.size} light mode variables`)

    console.log('📖 Reading dark mode tokens...')
    const darkVars = parseCSSVariables(DARK_CSS_FILE)
    console.log(`   Found ${darkVars.size} dark mode variables`)

    // Generate combined CSS
    console.log('🔄 Generating combined CSS with light-dark() functions...')
    const combinedCSS = generateCombinedCSS(lightVars, darkVars)

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })

    // Write combined CSS file
    fs.writeFileSync(OUTPUT_FILE, combinedCSS, 'utf-8')

    console.log(
      `✅ Successfully created: ${path.relative(rootDir, OUTPUT_FILE)}`,
    )
    console.log(
      `   File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)}KB`,
    )

    // Show some statistics
    const allVars = new Set([...lightVars.keys(), ...darkVars.keys()])
    const variantCount = Array.from(allVars).filter((varName) => {
      const lightVal = lightVars.get(varName)
      const darkVal = darkVars.get(varName)
      return lightVal && darkVal && lightVal !== darkVal
    }).length

    const primitiveCount = Array.from(allVars).filter((varName) => {
      return (
        varName.startsWith('color-') &&
        /^color-(green|pink|gray|red|amber|emerald|blue|black|white)-/.test(
          varName,
        )
      )
    }).length

    const semanticCount = Array.from(allVars).filter((varName) => {
      return (
        varName.startsWith('color-') &&
        !/^color-(green|pink|gray|red|amber|emerald|blue|black|white)-/.test(
          varName,
        )
      )
    }).length

    console.log(`   Total variables: ${allVars.size}`)
    console.log(`   Variables with light/dark variants: ${variantCount}`)
    console.log(`   Primitive color tokens: ${primitiveCount}`)
    console.log(`   Semantic color tokens: ${semanticCount}`)
  } catch (error) {
    console.error('❌ Error building combined tokens:', error.message)
    process.exit(1)
  }
}

// Run the script
main()
