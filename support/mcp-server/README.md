# Lime Soda MCP Server

MCP server for accessing Lime Soda web components and design tokens.

## Configuration

The server can be configured using environment variables. Create a `.env` file
in the mcp-server directory or set environment variables directly.

### Environment Variables

| Variable                        | Default                           | Description                                                               |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `CUSTOM_ELEMENTS_MANIFEST_GLOB` | `packages/*/custom-elements.json` | Glob pattern for finding custom elements manifest files                   |
| `WORKSPACE_ROOT`                | `../../`                          | Base path for resolving relative paths (relative to mcp-server directory) |
| `TOKENS_PATH`                   | `support/tokens`                  | Path to the design tokens directory                                       |

### Example .env file

```bash
# Custom location for manifest files
CUSTOM_ELEMENTS_MANIFEST_GLOB=components/*/manifest.json

# Different workspace structure
WORKSPACE_ROOT=../../../my-workspace

# Custom tokens location
TOKENS_PATH=design-system/tokens
```

## Development

```bash
# Start development server with hot reload
pnpm run dev

# Build for production
pnpm run build

# Run built server
pnpm run start

# Build, then inspect the running server in a web UI
pnpm run build && pnpm run debug
```

### MCP Inspector

`pnpm run debug` runs the built server under the MCP Inspector, a web-based
interface for testing and debugging MCP tools.

It is fetched on demand with `pnpm dlx` rather than installed as a dependency.
Vite arrives here through `vite-plus` → `vitest`, which depends on it across
`^6 || ^7 || ^8`, and pnpm resolves one copy for the whole workspace. The
inspector is a web application that needs Vite as well, so as a dependency it
got a vote on that single version — and its v2 release, which wants `^8.1.5`,
moved the component tests onto a different bundler.

Pinning Vite would only trade the problem: the inspector's web UI needs the
Vite 8 internals `@vitejs/plugin-react` imports, so held at 7 it does not start.
It wants a different Vite than the test suite, and nothing here needs it at
build time, so it stays out of the graph entirely.

The inspector allows you to:

- Test all available tools interactively
- View tool schemas and descriptions
- Debug tool responses and errors
- Monitor server logs and events

## Available Tools

### Component Tools

- `list-components` - List all available web components
- `get-component-details` - Get detailed component information including
  attributes, slots, CSS parts, CSS custom properties, and properties
- `get-component-css-properties` - Get CSS custom properties for a specific
  component
- `search-components` - Search components by name, description, properties,
  slots, CSS parts, or CSS custom properties

### Token Tools

- `list-token-categories` - List design token categories
- `get-tokens` - Get design tokens (optionally filtered)
- `get-css-variables` - Get CSS custom properties
- `search-tokens` - Search tokens by name/value/description
- `get-component-token-exports` - Get all component token exports (JavaScript
  and TypeScript)
- `get-component-token-export` - Get token exports for a specific component
