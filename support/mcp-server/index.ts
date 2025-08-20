#!/usr/bin/env node

import { config } from 'dotenv'
import { createServer } from './src/server.js'

// Load environment variables from .env file
config()

async function main() {
  // Log configuration
  console.error('Lime Soda MCP Server starting...')
  console.error('Configuration:')
  console.error(`  Workspace root: ${process.env.WORKSPACE_ROOT || '../../'}`)
  console.error(
    `  Manifest glob: ${process.env.CUSTOM_ELEMENTS_MANIFEST_GLOB || 'packages/*/custom-elements.json'}`,
  )
  console.error(`  Tokens path: ${process.env.TOKENS_PATH || 'support/tokens'}`)

  const server = createServer()
  await server.start()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
