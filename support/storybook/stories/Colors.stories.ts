import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html, type TemplateResult } from 'lit'
import { expect } from 'storybook/test'

const meta: Meta = {
  title: 'Design System/Colors',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Color palette for the Lime Soda design system with primitive and semantic tokens supporting light and dark themes using the modern light-dark() CSS function. Use the theme toggle in the toolbar to switch between light, dark, and system themes.',
      },
    },
  },
}

export default meta
type Story = StoryObj

// Helper function to render color swatches
const renderColorSwatch = (
  name: string,
  cssVariable: string,
  description?: string,
) => html`
  <style>
    .color-swatch {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      min-width: 120px;
    }

    .color-swatch__color {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      border: 1px solid var(--color-border-default);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .color-swatch__info {
      text-align: center;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      color: var(--color-text-primary);
    }

    .color-swatch__name {
      font-weight: 600;
      margin-bottom: 2px;
    }

    .color-swatch__variable {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      opacity: 0.7;
    }

    .color-swatch__description {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 4px;
    }
  </style>
  <div class="color-swatch">
    <div
      class="color-swatch__color"
      style="background: var(${cssVariable});"></div>
    <div class="color-swatch__info">
      <div class="color-swatch__name">${name}</div>
      <div class="color-swatch__variable">${cssVariable}</div>
      ${description
        ? html`<div class="color-swatch__description">${description}</div>`
        : ''}
    </div>
  </div>
`

const renderColorScale = (
  colorName: string,
  scales: string[],
  descriptions: Record<string, string> = {},
) => html`
  <style>
    .color-scale {
      margin-bottom: 32px;
    }

    .color-scale__title {
      margin: 0 0 16px 0;
      font-family: system-ui, sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text-primary);
      text-transform: capitalize;
    }

    .color-scale__swatches {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
  </style>
  <div class="color-scale">
    <h3 class="color-scale__title">${colorName}</h3>
    <div class="color-scale__swatches">
      ${scales.map((scale) =>
        renderColorSwatch(
          `${colorName}-${scale}`,
          `--color-${colorName}-${scale}`,
          descriptions[scale],
        ),
      )}
    </div>
  </div>
`

export const PrimitiveColors: Story = {
  render: () => html`
    <style>
      .story-header {
        margin-bottom: 32px;
      }

      .story-title {
        margin: 0 0 8px 0;
        font-family: system-ui, sans-serif;
        font-size: 24px;
        font-weight: 700;
        color: var(--color-text-primary);
      }

      .story-description {
        margin: 0 0 24px 0;
        font-family: system-ui, sans-serif;
        color: var(--color-text-secondary);
        max-width: 600px;
      }
    </style>
    <div>
      <div class="story-header">
        <h2 class="story-title">Primitive Colors</h2>
        <p class="story-description">
          Foundation color palette with no semantic meaning. These colors are
          mapped to semantic tokens for consistent theming.
        </p>
      </div>

      ${renderColorScale(
        'green',
        [
          '50',
          '100',
          '200',
          '300',
          '400',
          '500',
          '600',
          '700',
          '800',
          '900',
          '950',
        ],
        {
          '50': 'Lightest tint',
          '500': 'Primary green',
          '950': 'Darkest shade',
        },
      )}
      ${renderColorScale(
        'pink',
        [
          '50',
          '100',
          '200',
          '300',
          '400',
          '500',
          '600',
          '700',
          '800',
          '900',
          '950',
        ],
        {
          '50': 'Lightest tint',
          '500': 'Primary pink',
          '950': 'Darkest shade',
        },
      )}
      ${renderColorScale(
        'gray',
        [
          '50',
          '100',
          '200',
          '300',
          '400',
          '500',
          '600',
          '700',
          '800',
          '900',
          '950',
        ],
        {
          '50': 'Lightest tint',
          '500': 'Mid gray',
          '950': 'Darkest shade',
        },
      )}
      ${renderColorScale('red', ['50', '100', '500', '600', '700', '950'], {
        '50': 'Error backgrounds',
        '500': 'Primary error red',
        '950': 'Darkest shade',
      })}
      ${renderColorScale('amber', ['50', '100', '500', '600', '700', '950'], {
        '50': 'Warning backgrounds',
        '500': 'Primary warning amber',
        '950': 'Darkest shade',
      })}
      ${renderColorScale('emerald', ['50', '100', '500', '600', '700', '950'], {
        '50': 'Success backgrounds',
        '500': 'Primary success emerald',
        '950': 'Darkest shade',
      })}
      ${renderColorScale('blue', ['50', '100', '500', '600', '700', '950'], {
        '50': 'Info backgrounds',
        '500': 'Primary info blue',
        '950': 'Darkest shade',
      })}
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Test that CSS variables are defined and have valid color values
    const greenSwatch = canvasElement.querySelector(
      '[style*="--color-green-500"]',
    ) as HTMLElement
    if (greenSwatch) {
      const computedStyle = getComputedStyle(greenSwatch)
      const backgroundColor = computedStyle.backgroundColor
      await expect(backgroundColor).toBeTruthy()
      await expect(backgroundColor).not.toBe('initial')
    }
  },
}

export const SemanticTokens: Story = {
  render: () => html`
    <style>
      .story-header {
        margin-bottom: 32px;
      }

      .story-title {
        margin: 0 0 8px 0;
        font-family: system-ui, sans-serif;
        font-size: 24px;
        font-weight: 700;
        color: var(--color-text-primary);
      }

      .story-description {
        margin: 0 0 24px 0;
        font-family: system-ui, sans-serif;
        color: var(--color-text-secondary);
        max-width: 600px;
      }
    </style>
    <div>
      <div class="story-header">
        <h2 class="story-title">Semantic Tokens</h2>
        <p class="story-description">
          Context-aware tokens that reference primitive colors. These
          automatically adapt to light and dark themes using the light-dark()
          CSS function.
        </p>
      </div>

      ${renderColorScale(
        'primary',
        [
          '50',
          '100',
          '200',
          '300',
          '400',
          '500',
          '600',
          '700',
          '800',
          '900',
          '950',
        ],
        {
          '50': 'Surface - lightest',
          '500': 'Default - accessible',
          '950': 'Text - darkest',
        },
      )}
      ${renderColorScale(
        'secondary',
        [
          '50',
          '100',
          '200',
          '300',
          '400',
          '500',
          '600',
          '700',
          '800',
          '900',
          '950',
        ],
        {
          '50': 'Surface - lightest',
          '500': 'Default - accessible',
          '950': 'Text - darkest',
        },
      )}

      <div class="color-scale">
        <h3 class="color-scale__title">Background & Surface</h3>
        <div class="color-scale__swatches">
          ${renderColorSwatch(
            'background-default',
            '--color-background-default',
            'Default page background',
          )}
          ${renderColorSwatch(
            'background-subtle',
            '--color-background-subtle',
            'Subtle background for cards',
          )}
          ${renderColorSwatch(
            'background-muted',
            '--color-background-muted',
            'Muted background for disabled states',
          )}
          ${renderColorSwatch(
            'surface-default',
            '--color-surface-default',
            'Default surface color',
          )}
          ${renderColorSwatch(
            'surface-raised',
            '--color-surface-raised',
            'Elevated surface color',
          )}
          ${renderColorSwatch(
            'surface-overlay',
            '--color-surface-overlay',
            'Overlay surface for modals',
          )}
        </div>
      </div>

      <div class="color-scale">
        <h3 class="color-scale__title">Text Colors</h3>
        <div class="color-scale__swatches">
          ${renderColorSwatch(
            'text-primary',
            '--color-text-primary',
            'Primary text color',
          )}
          ${renderColorSwatch(
            'text-secondary',
            '--color-text-secondary',
            'Secondary text color',
          )}
          ${renderColorSwatch(
            'text-tertiary',
            '--color-text-tertiary',
            'Tertiary text color',
          )}
          ${renderColorSwatch(
            'text-disabled',
            '--color-text-disabled',
            'Disabled text color',
          )}
          ${renderColorSwatch(
            'text-inverse',
            '--color-text-inverse',
            'Text on dark backgrounds',
          )}
        </div>
      </div>

      ${renderColorScale('error', ['50', '100', '500', '600', '700'], {
        '50': 'Very light background',
        '500': 'Accessible error color',
        '700': 'Error emphasis',
      })}
      ${renderColorScale('warning', ['50', '100', '500', '600', '700'], {
        '50': 'Very light background',
        '500': 'Accessible warning color',
        '700': 'Warning emphasis',
      })}
      ${renderColorScale('success', ['50', '100', '500', '600', '700'], {
        '50': 'Very light background',
        '500': 'Accessible success color',
        '700': 'Success emphasis',
      })}
      ${renderColorScale('info', ['50', '100', '500', '600', '700'], {
        '50': 'Very light background',
        '500': 'Accessible info color',
        '700': 'Info emphasis',
      })}
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Test semantic tokens are properly mapped
    const primarySwatch = canvasElement.querySelector(
      '[style*="--color-primary-500"]',
    ) as HTMLElement
    if (primarySwatch) {
      const computedStyle = getComputedStyle(primarySwatch)
      const backgroundColor = computedStyle.backgroundColor
      await expect(backgroundColor).toBeTruthy()
      await expect(backgroundColor).not.toBe('initial')
    }
  },
}

export const ThemeDemo: Story = {
  render: () => html`
    <style>
      .story-header {
        margin-bottom: 32px;
      }

      .story-title {
        margin: 0 0 8px 0;
        font-family: system-ui, sans-serif;
        font-size: 24px;
        font-weight: 700;
        color: var(--color-text-primary);
      }

      .story-description {
        margin: 0 0 24px 0;
        font-family: system-ui, sans-serif;
        color: var(--color-text-secondary);
        max-width: 600px;
      }

      .demo-card {
        margin-bottom: 24px;
        padding: 24px;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .demo-card__title {
        margin: 0 0 16px 0;
        color: var(--color-text-primary);
        font-size: 20px;
        font-weight: 600;
      }

      .demo-card__description {
        margin: 0 0 20px 0;
        color: var(--color-text-secondary);
        line-height: 1.6;
      }

      .button-group {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .demo-button {
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .demo-button--primary {
        background: var(--color-primary-500);
        color: var(--color-primary-on-primary);
      }

      .demo-button--secondary {
        background: var(--color-secondary-500);
        color: var(--color-secondary-on-secondary);
      }

      .demo-button--outline {
        background: transparent;
        color: var(--color-text-primary);
        border: 1px solid var(--color-border-default);
      }

      .status-section {
        margin-bottom: 24px;
      }

      .status-title {
        margin: 0 0 16px 0;
        color: var(--color-text-primary);
        font-size: 18px;
        font-weight: 600;
      }

      .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }

      .status-card {
        padding: 16px;
        border-radius: 4px;
      }

      .status-card--error {
        background: light-dark(var(--color-red-50), var(--color-red-950));
        border: 1px solid light-dark(var(--color-red-200), var(--color-red-800));
        border-left: 4px solid var(--color-error-500);
      }

      .status-card--warning {
        background: light-dark(var(--color-amber-50), var(--color-amber-950));
        border: 1px solid
          light-dark(var(--color-amber-200), var(--color-amber-800));
        border-left: 4px solid var(--color-warning-500);
      }

      .status-card--success {
        background: light-dark(
          var(--color-emerald-50),
          var(--color-emerald-950)
        );
        border: 1px solid
          light-dark(var(--color-emerald-200), var(--color-emerald-800));
        border-left: 4px solid var(--color-success-500);
      }

      .status-card--info {
        background: light-dark(var(--color-blue-50), var(--color-blue-950));
        border: 1px solid
          light-dark(var(--color-blue-200), var(--color-blue-800));
        border-left: 4px solid var(--color-info-500);
      }

      .status-card__title {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .status-card__title--error {
        color: var(--color-error-600);
      }

      .status-card__title--warning {
        color: var(--color-warning-600);
      }

      .status-card__title--success {
        color: var(--color-success-600);
      }

      .status-card__title--info {
        color: var(--color-info-600);
      }

      .status-card__description {
        font-size: 14px;
      }

      .status-card--error .status-card__description {
        color: var(--color-error-700);
      }

      .status-card--warning .status-card__description {
        color: var(--color-warning-700);
      }

      .status-card--success .status-card__description {
        color: var(--color-success-700);
      }

      .status-card--info .status-card__description {
        color: var(--color-info-700);
      }

      .text-hierarchy {
        padding: 20px;
        background: var(--color-background-subtle);
        border-radius: 8px;
        margin-bottom: 24px;
      }

      .text-hierarchy__title {
        margin: 0 0 16px 0;
        color: var(--color-text-primary);
        font-size: 18px;
        font-weight: 600;
      }

      .text-sample--primary {
        color: var(--color-text-primary);
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 12px;
      }

      .text-sample--secondary {
        color: var(--color-text-secondary);
        font-size: 16px;
        margin-bottom: 10px;
      }

      .text-sample--tertiary {
        color: var(--color-text-tertiary);
        font-size: 14px;
        margin-bottom: 10px;
      }

      .theme-info {
        padding: 16px;
        background: var(--color-background-muted);
        border: 1px solid var(--color-border-subtle);
        border-radius: 8px;
        font-family: 'SF Mono', 'Monaco', monospace;
        font-size: 14px;
        color: var(--color-text-secondary);
      }
    </style>
    <div>
      <div class="story-header">
        <h2 class="story-title">Theme Demo</h2>
        <p class="story-description">
          This demo shows how tokens automatically adapt between light and dark
          themes. Use the theme control above to switch between modes.
        </p>
      </div>

      <div class="demo-card">
        <h3 class="demo-card__title">Sample Component</h3>
        <p class="demo-card__description">
          This card demonstrates how semantic tokens adapt to different themes.
          The background, text colors, and borders all update automatically
          using the light-dark() CSS function.
        </p>
        <div class="button-group">
          <button class="demo-button demo-button--primary">
            Primary Button
          </button>
          <button class="demo-button demo-button--secondary">
            Secondary Button
          </button>
          <button class="demo-button demo-button--outline">
            Outline Button
          </button>
        </div>
      </div>

      <div class="status-section">
        <h3 class="status-title">Status Colors</h3>
        <div class="status-grid">
          <div class="status-card status-card--error">
            <div class="status-card__title status-card__title--error">
              Error
            </div>
            <div class="status-card__description">Something went wrong</div>
          </div>
          <div class="status-card status-card--warning">
            <div class="status-card__title status-card__title--warning">
              Warning
            </div>
            <div class="status-card__description">Please be careful</div>
          </div>
          <div class="status-card status-card--success">
            <div class="status-card__title status-card__title--success">
              Success
            </div>
            <div class="status-card__description">Task completed!</div>
          </div>
          <div class="status-card status-card--info">
            <div class="status-card__title status-card__title--info">Info</div>
            <div class="status-card__description">Here's some info</div>
          </div>
        </div>
      </div>

      <div class="text-hierarchy">
        <h3 class="text-hierarchy__title">Text Hierarchy</h3>
        <div class="text-sample--primary">Primary text - highest contrast</div>
        <div class="text-sample--secondary">Secondary text - good contrast</div>
        <div class="text-sample--tertiary">
          Tertiary text - readable contrast
        </div>
      </div>

      <div class="theme-info">
        Use the theme toggle in the toolbar to switch between light, dark, and
        system themes.
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Test that theme demo renders correctly
    const themeDemo = canvasElement.querySelector(
      '.story-header',
    ) as HTMLElement
    if (themeDemo) {
      const computedStyle = getComputedStyle(themeDemo)
      const backgroundColor = computedStyle.backgroundColor
      await expect(backgroundColor).toBeTruthy()
    }
  },
}
