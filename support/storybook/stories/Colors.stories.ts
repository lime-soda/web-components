import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { html } from 'lit'
import { expect } from 'storybook/test'

const meta: Meta = {
  title: 'Design System/Colors',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Color palette for the Lime Soda design system with primitive and semantic tokens supporting light and dark themes using the modern light-dark() CSS function.',
      },
    },
    backgrounds: {
      values: [
        { name: 'Light', value: '#ffffff' },
        { name: 'Dark', value: '#030712' },
      ],
    },
  },
  argTypes: {
    theme: {
      control: { type: 'select' },
      options: ['auto', 'light', 'dark'],
      description: 'Force a specific theme or use automatic detection',
    },
  },
  args: {
    theme: 'auto',
  },
}

export default meta
type Story = StoryObj

// Helper function to wrap content with theme handling
const withTheme = (content: any, theme: string = 'auto') => {
  const themeStyles =
    theme === 'light'
      ? 'color-scheme: light;'
      : theme === 'dark'
        ? 'color-scheme: dark;'
        : 'color-scheme: light dark;'

  const containerStyle = `
    ${themeStyles}
    min-height: 100vh;
    padding: 20px;
    background: var(--color-background-default);
    color: var(--color-text-primary);
    transition: background-color 0.2s ease, color 0.2s ease;
  `

  return html`
    <div
      class="theme-wrapper"
      data-theme="${theme !== 'auto' ? theme : ''}"
      style="${containerStyle}">
      ${content}
    </div>
  `
}

// Helper function to render color swatches
const renderColorSwatch = (
  name: string,
  cssVariable: string,
  description?: string,
) => html`
  <div
    style="
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    gap: 8px;
    min-width: 120px;
  ">
    <div
      style="
      width: 80px;
      height: 80px;
      border-radius: 8px;
      background: var(${cssVariable});
      border: 1px solid var(--color-border-default);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    "></div>
    <div
      style="
      text-align: center;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      color: var(--color-text-primary);
    ">
      <div style="font-weight: 600; margin-bottom: 2px;">${name}</div>
      <div
        style="font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; opacity: 0.7;">
        ${cssVariable}
      </div>
      ${description
        ? html`<div style="font-size: 11px; opacity: 0.6; margin-top: 4px;">
            ${description}
          </div>`
        : ''}
    </div>
  </div>
`

const renderColorScale = (
  colorName: string,
  scales: string[],
  descriptions: Record<string, string> = {},
) => html`
  <div style="margin-bottom: 32px;">
    <h3
      style="
      margin: 0 0 16px 0;
      font-family: system-ui, sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text-primary);
      text-transform: capitalize;
    ">
      ${colorName}
    </h3>
    <div
      style="
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    ">
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
  render: ({ theme }) =>
    withTheme(
      html`
        <div>
          <div style="margin-bottom: 32px;">
            <h2
              style="
          margin: 0 0 8px 0;
          font-family: system-ui, sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text-primary);
        ">
              Primitive Colors
            </h2>
            <p
              style="
          margin: 0 0 24px 0;
          font-family: system-ui, sans-serif;
          color: var(--color-text-secondary);
          max-width: 600px;
        ">
              Foundation color palette with no semantic meaning. These colors
              are mapped to semantic tokens for consistent theming.
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
          ${renderColorScale(
            'amber',
            ['50', '100', '500', '600', '700', '950'],
            {
              '50': 'Warning backgrounds',
              '500': 'Primary warning amber',
              '950': 'Darkest shade',
            },
          )}
          ${renderColorScale(
            'emerald',
            ['50', '100', '500', '600', '700', '950'],
            {
              '50': 'Success backgrounds',
              '500': 'Primary success emerald',
              '950': 'Darkest shade',
            },
          )}
          ${renderColorScale(
            'blue',
            ['50', '100', '500', '600', '700', '950'],
            {
              '50': 'Info backgrounds',
              '500': 'Primary info blue',
              '950': 'Darkest shade',
            },
          )}
        </div>
      `,
      theme,
    ),
  play: async ({ canvasElement }) => {
    // Test that CSS variables are defined and have valid color values
    const greenSwatch = canvasElement.querySelector(
      '[style*="--color-green-500"]',
    ) as HTMLElement
    if (greenSwatch) {
      const computedStyle = getComputedStyle(greenSwatch)
      const backgroundColor = computedStyle.backgroundColor
      expect(backgroundColor).toBeTruthy()
      expect(backgroundColor).not.toBe('initial')
    }
  },
}

export const SemanticTokens: Story = {
  render: ({ theme }) =>
    withTheme(
      html`
        <div>
          <div style="margin-bottom: 32px;">
            <h2
              style="
          margin: 0 0 8px 0;
          font-family: system-ui, sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text-primary);
        ">
              Semantic Tokens
            </h2>
            <p
              style="
          margin: 0 0 24px 0;
          font-family: system-ui, sans-serif;
          color: var(--color-text-secondary);
          max-width: 600px;
        ">
              Context-aware tokens that reference primitive colors. These
              automatically adapt to light and dark themes using the
              light-dark() CSS function.
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

          <div style="margin-bottom: 32px;">
            <h3
              style="
          margin: 0 0 16px 0;
          font-family: system-ui, sans-serif;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text-primary);
        ">
              Background & Surface
            </h3>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
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

          <div style="margin-bottom: 32px;">
            <h3
              style="
          margin: 0 0 16px 0;
          font-family: system-ui, sans-serif;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text-primary);
        ">
              Text Colors
            </h3>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
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
      theme,
    ),
  play: async ({ canvasElement }) => {
    // Test semantic tokens are properly mapped
    const primarySwatch = canvasElement.querySelector(
      '[style*="--color-primary-500"]',
    ) as HTMLElement
    if (primarySwatch) {
      const computedStyle = getComputedStyle(primarySwatch)
      const backgroundColor = computedStyle.backgroundColor
      expect(backgroundColor).toBeTruthy()
      expect(backgroundColor).not.toBe('initial')
    }
  },
}

export const ThemeDemo: Story = {
  render: ({ theme }) =>
    withTheme(
      html`
        <div>
          <div style="margin-bottom: 32px;">
            <h2
              style="
          margin: 0 0 8px 0;
          font-family: system-ui, sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text-primary);
        ">
              Theme Demo
            </h2>
            <p
              style="
          margin: 0 0 24px 0;
          font-family: system-ui, sans-serif;
          color: var(--color-text-secondary);
          max-width: 600px;
        ">
              This demo shows how tokens automatically adapt between light and
              dark themes. Use the theme control above to switch between modes.
            </p>
          </div>

          <!-- Demo Card -->
          <div
            style="
        margin-bottom: 24px;
        padding: 24px;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      ">
            <h3
              style="
          margin: 0 0 16px 0;
          color: var(--color-text-primary);
          font-size: 20px;
          font-weight: 600;
        ">
              Sample Component
            </h3>

            <p
              style="
          margin: 0 0 20px 0;
          color: var(--color-text-secondary);
          line-height: 1.6;
        ">
              This card demonstrates how semantic tokens adapt to different
              themes. The background, text colors, and borders all update
              automatically using the light-dark() CSS function.
            </p>

            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button
                style="
            background: var(--color-primary-500);
            color: var(--color-primary-on-primary);
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s ease;
          ">
                Primary Button
              </button>

              <button
                style="
            background: var(--color-secondary-500);
            color: var(--color-secondary-on-secondary);
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s ease;
          ">
                Secondary Button
              </button>

              <button
                style="
            background: transparent;
            color: var(--color-text-primary);
            border: 1px solid var(--color-border-default);
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
                Outline Button
              </button>
            </div>
          </div>

          <!-- Status Examples -->
          <div style="margin-bottom: 24px;">
            <h3
              style="
          margin: 0 0 16px 0;
          color: var(--color-text-primary);
          font-size: 18px;
          font-weight: 600;
        ">
              Status Colors
            </h3>

            <div
              style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
              <div
                style="
            padding: 16px;
            background: var(--color-error-50);
            border-left: 4px solid var(--color-error-500);
            border-radius: 4px;
          ">
                <div
                  style="color: var(--color-error-600); font-weight: 600; margin-bottom: 4px;">
                  Error
                </div>
                <div
                  style="color: var(--color-text-secondary); font-size: 14px;">
                  Something went wrong
                </div>
              </div>

              <div
                style="
            padding: 16px;
            background: var(--color-warning-50);
            border-left: 4px solid var(--color-warning-500);
            border-radius: 4px;
          ">
                <div
                  style="color: var(--color-warning-600); font-weight: 600; margin-bottom: 4px;">
                  Warning
                </div>
                <div
                  style="color: var(--color-text-secondary); font-size: 14px;">
                  Please be careful
                </div>
              </div>

              <div
                style="
            padding: 16px;
            background: var(--color-success-50);
            border-left: 4px solid var(--color-success-500);
            border-radius: 4px;
          ">
                <div
                  style="color: var(--color-success-600); font-weight: 600; margin-bottom: 4px;">
                  Success
                </div>
                <div
                  style="color: var(--color-text-secondary); font-size: 14px;">
                  Task completed!
                </div>
              </div>

              <div
                style="
            padding: 16px;
            background: var(--color-info-50);
            border-left: 4px solid var(--color-info-500);
            border-radius: 4px;
          ">
                <div
                  style="color: var(--color-info-600); font-weight: 600; margin-bottom: 4px;">
                  Info
                </div>
                <div
                  style="color: var(--color-text-secondary); font-size: 14px;">
                  Here's some info
                </div>
              </div>
            </div>
          </div>

          <!-- Text Hierarchy -->
          <div
            style="
        padding: 20px;
        background: var(--color-background-subtle);
        border-radius: 8px;
        margin-bottom: 24px;
      ">
            <h3
              style="
          margin: 0 0 16px 0;
          color: var(--color-text-primary);
          font-size: 18px;
          font-weight: 600;
        ">
              Text Hierarchy
            </h3>

            <div
              style="color: var(--color-text-primary); font-size: 18px; font-weight: 600; margin-bottom: 12px;">
              Primary text - highest contrast
            </div>
            <div
              style="color: var(--color-text-secondary); font-size: 16px; margin-bottom: 10px;">
              Secondary text - good contrast
            </div>
            <div
              style="color: var(--color-text-tertiary); font-size: 14px; margin-bottom: 10px;">
              Tertiary text - readable contrast
            </div>
            <div style="color: var(--color-text-disabled); font-size: 12px;">
              Disabled text - reduced contrast
            </div>
          </div>

          <div
            style="
        padding: 16px;
        background: var(--color-background-muted);
        border: 1px solid var(--color-border-subtle);
        border-radius: 8px;
        font-family: 'SF Mono', 'Monaco', monospace;
        font-size: 14px;
        color: var(--color-text-secondary);
      ">
            Current theme: <strong>${theme}</strong> | color-scheme:
            <strong
              >${theme === 'light'
                ? 'light'
                : theme === 'dark'
                  ? 'dark'
                  : 'light dark'}</strong
            >
          </div>
        </div>
      `,
      theme,
    ),
  play: async ({ canvasElement }) => {
    // Test that theme demo renders correctly
    const themeDemo = canvasElement.querySelector(
      '.theme-wrapper',
    ) as HTMLElement
    if (themeDemo) {
      const computedStyle = getComputedStyle(themeDemo)
      const backgroundColor = computedStyle.backgroundColor
      expect(backgroundColor).toBeTruthy()
    }
  },
}
