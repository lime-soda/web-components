#!/usr/bin/env node

import { createServer } from './src/server.js'

async function main() {
  const server = createServer()
  console.error('Lime Soda MCP Server starting...')
  await server.start()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
