# @lime-soda/storybook

Storybook configuration and stories for the Lime Soda design system.

## Overview

This package provides:

- Storybook configuration for component documentation
- Interactive component stories and examples
- Visual testing with Chromatic
- Accessibility testing with a11y addon
- Integration testing with Vitest

## Features

### Visual Documentation

- Interactive component playground
- Live code examples
- Props/attributes documentation
- Design token visualization

### Testing Integration

- **Vitest** - Unit and integration tests run within Storybook
- **Accessibility testing** - Automated a11y checks with @storybook/addon-a11y
- **Visual regression** - Chromatic integration for visual testing
- **Cross-browser testing** - Tests across different browser environments

### Development Tools

- **Hot reload** - Instant updates during development
- **TypeScript support** - Full type checking in stories
- **CSS debugging** - Live style editing and inspection

## Usage

### Development

```bash
# Start Storybook development server
pnpm run dev

# Build Storybook for production
pnpm run build

# Run tests
pnpm run test
```

### Writing Stories

Stories are co-located with components:

```ts
// Button.stories.ts
import type { Meta, StoryObj } from '@storybook/web-components'
import { html } from 'lit'
import '../src/index.js'

const meta: Meta = {
  title: 'Components/Button',
  component: 'ls-button',
  parameters: {
    docs: {
      description: {
        component: 'A customizable button component',
      },
    },
  },
}

export default meta

export const Default: StoryObj = {
  render: () => html`<ls-button>Click me</ls-button>`,
}

export const Primary: StoryObj = {
  render: () => html`<ls-button variant="primary">Primary</ls-button>`,
}
```

## Configuration

### Storybook Config

- **Framework**: Web Components with Lit support
- **TypeScript**: Full TypeScript support
- **Addons**: Docs, A11y, Vitest, Chromatic
- **Build tool**: Vite for fast development and building

### Testing Config

- **Vitest**: Browser testing with Playwright
- **Coverage**: Code coverage reporting
- **Accessibility**: Automated a11y testing in stories

## Integration

- **Components** - Imports all component packages
- **Design tokens** - Uses @lime-soda/tokens for styling
- **Build system** - Integrated with Turbo
- **CI/CD** - Automated testing and deployment
- **Chromatic** - Visual regression testing service

## File Structure

```
support/storybook/
├── stories/              # Component stories
│   └── Button.stories.ts
├── chromatic.config.json # Chromatic configuration
├── vitest.config.ts     # Test configuration
└── global.d.ts         # Global type declarations
```
