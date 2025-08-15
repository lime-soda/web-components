import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import * as components from './tools/components.js'
import * as tokens from './tools/tokens.js'

export function createServer() {
  const server = new McpServer({
    name: 'lime-soda-mcp-server',
    version: '0.0.0',
  })

  server.registerTool(
    'list-components',
    {
      title: 'List Components',
      description: 'List all available web components in the packages',
    },
    async () => {
      const componentList = await components.listComponents()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(componentList, null, 2),
          },
        ],
      }
    },
  )

  server.registerTool(
    'get-component-details',
    {
      title: 'Get Component Details',
      description:
        'Get detailed information about a specific component by name or tag',
      inputSchema: {
        nameOrTag: z.string(),
      },
    },
    async ({ nameOrTag }: { nameOrTag: string }) => {
      const component = await components.getComponentDetails(nameOrTag)

      if (!component) {
        return {
          content: [
            {
              type: 'text',
              text: `Component "${nameOrTag}" not found`,
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(component, null, 2),
          },
        ],
      }
    },
  )

  server.registerTool(
    'search-components',
    {
      title: 'Search Components',
      description: 'Search components by name, description, or properties',
      inputSchema: {
        query: z
          .string()
          .describe(
            'Search query to match against component names, descriptions, or properties',
          ),
      },
    },
    async ({ query }: { query: string }) => {
      const matchingComponents = await components.searchComponents(query)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(matchingComponents, null, 2),
          },
        ],
      }
    },
  )

  server.registerTool(
    'list-token-categories',
    {
      title: 'List Token Categories',
      description: 'List all available design token categories',
    },
    async () => {
      const categories = await tokens.listTokenCategories()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(categories, null, 2),
          },
        ],
      }
    },
  )

  server.registerTool(
    'get-tokens',
    {
      title: 'Get Tokens',
      description: 'Get design tokens, optionally filtered by category',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe('Optional category name to filter tokens'),
      },
    },
    async ({ category }: { category?: string }) => {
      const tokenData = await tokens.getTokens(category)

      if (category && !tokenData) {
        return {
          content: [
            {
              type: 'text',
              text: `Token category "${category}" not found`,
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tokenData, null, 2),
          },
        ],
      }
    },
  )

  server.registerTool(
    'get-css-variables',
    {
      title: 'Get CSS Variables',
      description: 'Get all available CSS custom properties with their values',
    },
    async () => {
      const variables = await tokens.getCssVariables()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(variables, null, 2),
          },
        ],
      }
    },
  )

  server.registerTool(
    'search-tokens',
    {
      title: 'Search Tokens',
      description: 'Search design tokens by name, value, or description',
      inputSchema: {
        query: z
          .string()
          .describe(
            'Search query to match against token names, values, or descriptions',
          ),
      },
    },
    async ({ query }: { query: string }) => {
      const matchingTokens = await tokens.searchTokens(query)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(matchingTokens, null, 2),
          },
        ],
      }
    },
  )

  return {
    async start() {
      const transport = new StdioServerTransport()
      await server.connect(transport)
    },
  }
}
