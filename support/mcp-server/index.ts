#!/usr/bin/env node

import { config } from 'dotenv'
import { createServer } from './src/server.js'

// Load environment variables from .env file
config()

async function main() {
  console.log('Lime Soda MCP Server starting...')
  console.log('Configuration:')
  console.log(`  Workspace root: ${process.env.WORKSPACE_ROOT ?? '../..'}`)
  console.log(
    `  Manifest glob: ${process.env.CUSTOM_ELEMENTS_MANIFEST_GLOB ?? 'packages/*/custom-elements.json'}`,
  )
  console.log(`  Tokens path: ${process.env.TOKENS_PATH ?? 'support/tokens'}`)

  const server = createServer()
  await server.start()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
