# @lime-soda/tokens

Design tokens for the Lime Soda design system, built with Style Dictionary.
Features a modern two-layer token architecture with primitive and semantic
tokens, supporting both light and dark themes with WCAG 2.1 AA accessibility
compliance.

## Overview

This package provides a comprehensive color design system with:

- **🎨 Two-layer Architecture** - Primitive colors + semantic mappings
- **🌓 Theme Support** - Light and dark mode with automatic switching
- **♿ Accessibility First** - All combinations meet WCAG 2.1 AA standards
- **🎯 Modern Colors** - RGB format with future OKLCH/P3 support ready
- **⚡ Multiple Outputs** - Individual theme files + combined responsive CSS

## Token Architecture

### Primitives Layer (`primitives/color.json`)

Foundation color palette with no semantic meaning:

- **Green** (50-950) - Primary brand color
- **Pink** (50-950) - Secondary brand color
- **Gray** (50-950) - Neutral colors for text, borders, surfaces
- **Red** (50-950) - Error/danger states
- **Amber** (50-950) - Warning states
- **Emerald** (50-950) - Success states
- **Blue** (50-950) - Info/focus states

### Semantic Layer (`theme/`)

Context-aware tokens that reference primitives:

- `color-light.json` - Light mode semantic mappings
- `color-dark.json` - Dark mode semantic mappings

**Semantic Categories:**

- `primary-*` / `secondary-*` - Brand colors with full scales
- `background-*` / `surface-*` - Page and component backgrounds
- `text-*` - Typography colors (primary, secondary, tertiary, disabled)
- `border-*` / `outline-*` - Dividers and focus states
- `error-*` / `warning-*` / `success-*` / `info-*` - State colors

## Generated CSS Files

The build generates multiple CSS files for different use cases:

```bash
dist/css/
├── tokens.css           # Combined light + dark using light-dark() function
├── tokens-light.css     # Light mode only
└── tokens-dark.css      # Dark mode only
```

### Example Generated CSS

**Modern approach with `light-dark()` function (tokens.css):**

```css
:root {
  color-scheme: light dark;

  /* Primitive Colors - Foundation palette */
  --color-green-700: #15803d;
  --color-green-400: #4ade80;
  --color-pink-600: #db2777;
  --color-pink-400: #f472b6;

  /* Semantic tokens - Automatic theme switching */
  --color-primary-500: light-dark(#15803d, #4ade80);
  --color-secondary-500: light-dark(#db2777, #f472b6);
  --color-background-default: light-dark(#ffffff, #030712);
  --color-text-primary: light-dark(#111827, #f3f4f6);
}
```

The semantic tokens use the exact hex values from primitives for optimal
performance, while maintaining the two-layer architecture conceptually through
the Style Dictionary token definitions.

**Legacy approach with media queries (for older browsers):**

```css
/* Light mode (default) */
:root {
  --color-primary-500: #15803d; /* Green 700 - accessible */
  --color-secondary-500: #db2777; /* Pink 600 - accessible */
  --color-background-default: #ffffff;
  --color-text-primary: #111827;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary-500: #4ade80; /* Green 400 - bright for dark */
    --color-secondary-500: #f472b6; /* Pink 400 - bright for dark */
    --color-background-default: #030712;
    --color-text-primary: #f3f4f6;
  }
}
```

## Usage

### Automatic Theme Switching (Recommended)

**Modern browsers with `light-dark()` support:**

```ts
// Import combined CSS with light-dark() functions
import '@lime-soda/tokens/tokens.css'

const styles = css`
  .button {
    background: var(
      --color-primary-500
    ); /* Automatically adapts to light/dark */
    color: var(--color-primary-on-primary);
  }
`
```

The `light-dark()` function automatically switches between light and dark values
based on the user's system preference or the `color-scheme` property.

### Manual Theme Control

```html
<html data-theme="light">
  <!-- Force light -->
  <html data-theme="dark">
    <!-- Force dark -->
  </html>
</html>
```

### Individual Theme Files

```ts
// Light mode only
import '@lime-soda/tokens/tokens-light.css'

// Dark mode only
import '@lime-soda/tokens/tokens-dark.css'
```

### Component Usage Examples

```ts
// Button component
const buttonStyles = css`
  .button {
    background: var(--color-primary-500);
    color: var(--color-primary-on-primary);
    border: 1px solid var(--color-border-default);
  }

  .button:hover {
    background: var(--color-primary-600);
  }

  .button--secondary {
    background: var(--color-secondary-500);
    color: var(--color-secondary-on-secondary);
  }
`

// Form validation
const formStyles = css`
  .input--error {
    border-color: var(--color-error-500);
    background: var(--color-error-50);
  }

  .input--success {
    border-color: var(--color-success-500);
    background: var(--color-success-50);
  }
`
```

## Accessibility

All color combinations are tested to meet **WCAG 2.1 AA** standards:

- Normal text: 4.5:1 minimum contrast ratio
- Large text: 3.0:1 minimum contrast ratio

The semantic tokens ensure accessible color usage by default:

- `primary-500` / `secondary-500` on white: ≥4.5:1 contrast
- White text on `primary-500` / `secondary-500`: ≥4.5:1 contrast
- All `text-*` tokens on backgrounds: ≥4.5:1 contrast

## Development

```bash
# Build all token CSS files (includes light-dark() combined version)
pnpm run build

# Build individual themes
pnpm run build:light    # Light mode only
pnpm run build:dark     # Dark mode only
pnpm run build:combined # Generate light-dark() combined tokens only

# Lint tokens
pnpm run lint
```

## File Structure

```
support/tokens/
├── primitives/
│   ├── color.json           # Primitive color palette
│   ├── size.json           # Spacing/sizing values
│   ├── font.json           # Typography tokens
│   ├── border.json         # Border values
│   └── transition.json     # Animation tokens
├── theme/
│   ├── color-light.json    # Light mode semantic colors
│   └── color-dark.json     # Dark mode semantic colors
├── scripts/
│   ├── build-combined.js   # Combines light/dark CSS
│   └── check-accessibility.js # WCAG compliance checker
├── config.json             # Light mode build config
├── config-dark.json        # Dark mode build config
├── config-combined.json    # Combined build config
└── dist/
    └── css/
        ├── tokens.css      # Combined light/dark with media queries
        ├── tokens-light.css # Light mode only
        └── tokens-dark.css  # Dark mode only
```

## Integration

- **Style Dictionary 5.0** - Token transformation and CSS generation
- **Monorepo** - Shared across all Lime Soda component packages via
  `@lime-soda/tokens`
- **MCP Server** - Design tokens accessible via Model Context Protocol for AI
  tools
- **Turbo** - Integrated build pipeline for efficient development
- **Future Ready** - Architecture supports OKLCH and P3 color spaces when
  tooling matures
