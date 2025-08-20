# @lime-soda/tokens

Design tokens for the Lime Soda design system, built with Style Dictionary.

## Overview

This package contains the design system's design tokens organized into:

- **Primitives** - Base values (colors, spacing, typography)
- **Themes** - Semantic token mappings

## Token Categories

### Primitives (`primitives/`)

- `color.json` - Color palette (brand colors, grays, etc.)
- `size.json` - Spacing, sizing, and layout values
- `font.json` - Typography scale, weights, and font families
- `border.json` - Border widths, radius values
- `transition.json` - Animation timing and easing

### Themes (`theme/`)

- `color.json` - Semantic color mappings (primary, secondary, error, etc.)

## Generated CSS

The build process generates CSS custom properties:

```css
/* Example generated CSS */
:root {
  --color-orange-50: #fff7ed;
  --color-orange-400: #fb923c;
  --color-orange-900: #9a3412;

  --color-primary: var(--color-orange-400);
  --color-on-primary: white;
}
```

## Usage

### In Components

```ts
// Import CSS in your component
import '@lime-soda/tokens/dist/css/tokens.css'

// Use in styles
const styles = css`
  .button {
    background: var(--color-primary);
    color: var(--color-on-primary);
    padding: var(--size-2) var(--size-4);
    border-radius: var(--border-radius-md);
  }
`
```

### Direct CSS Import

```css
/* Import all tokens */
@import '@lime-soda/tokens/dist/css/tokens.css';

.my-component {
  background: var(--color-surface);
  border: var(--border-width-1) solid var(--color-outline);
}
```

## Development

```bash
# Build tokens (generates CSS)
pnpm run build

# Watch for changes (in development)
pnpm run build --watch
```

## File Structure

```
support/tokens/
├── config.json           # Style Dictionary configuration
├── primitives/           # Base design tokens
│   ├── color.json       # Color palette
│   ├── size.json        # Spacing/sizing
│   ├── font.json        # Typography
│   ├── border.json      # Border values
│   └── transition.json  # Animation
├── theme/               # Semantic tokens
│   └── color.json      # Color mappings
└── dist/               # Generated files
    └── css/
        └── tokens.css  # Generated CSS custom properties
```

## Integration

- **Style Dictionary** - Transforms tokens into CSS custom properties
- **Monorepo** - Shared across all component packages
- **MCP Server** - Accessible via Model Context Protocol for tooling
- **Build system** - Integrated with Turbo for efficient builds
