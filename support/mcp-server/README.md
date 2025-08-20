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
# Start development server with MCP inspector (opens web UI)
pnpm run dev

# Build for production
pnpm run build

# Run built server
pnpm run start
```

### MCP Inspector

The development server includes the MCP Inspector, which provides a web-based
interface for testing and debugging MCP tools. When you run `pnpm run dev`, it
will:

1. Start the MCP server with hot reload
2. Launch the MCP Inspector web interface
3. Automatically connect the inspector to your server

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
