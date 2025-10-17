import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import * as tokens from '@lime-soda/tokens/button'

/**
 * Button element.
 *
 * @slot - Default slot for button content
 * @csspart button - The button
 */
@customElement('ls-button')
export class Button extends LitElement {
  /**
   * The size of the button.
   */
  @property({ type: String })
  size: 'sm' | 'md' | 'lg' = 'md'

  /**
   * The variant of the button.
   */
  @property({ type: String })
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' = 'primary'

  render() {
    return html`
      <button part="button" class="${this.size} ${this.variant}">
        <slot></slot>
      </button>
    `
  }

  static styles = [
    tokens.props,
    css`
      button {
        cursor: pointer;
        transition: all ${tokens.motion.transition};
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        outline: none;

        /* Size variants */
        &.sm {
          font: ${tokens.size.smTypography};
          padding: ${tokens.size.smPadding};
          border-radius: ${tokens.size.smBorderRadius};
        }

        &.md {
          font: ${tokens.size.mdTypography};
          padding: ${tokens.size.mdPadding};
          border-radius: ${tokens.size.mdBorderRadius};
        }

        &.lg {
          font: ${tokens.size.lgTypography};
          padding: ${tokens.size.lgPadding};
          border-radius: ${tokens.size.lgBorderRadius};
        }

        /* Color variants */
        &.primary {
          background: ${tokens.variant.primaryBackground};
          color: ${tokens.variant.primaryText};
          border: ${tokens.variant.primaryBorder};

          &:hover {
            background: ${tokens.variant.primaryBackgroundHover};
          }

          &:active {
            background: ${tokens.variant.primaryBackgroundActive};
          }
        }

        &.secondary {
          background: ${tokens.variant.secondaryBackground};
          color: ${tokens.variant.secondaryText};
          border: ${tokens.variant.secondaryBorder};

          &:hover {
            background: ${tokens.variant.secondaryBackgroundHover};
          }

          &:active {
            background: ${tokens.variant.secondaryBackgroundActive};
          }
        }

        &.outline {
          background: ${tokens.variant.outlineBackground};
          color: ${tokens.variant.outlineText};
          border: ${tokens.variant.outlineBorder};

          &:hover {
            background: ${tokens.variant.outlineBackgroundHover};
          }

          &:active {
            background: ${tokens.variant.outlineBackgroundActive};
          }
        }

        &.ghost {
          background: ${tokens.variant.ghostBackground};
          color: ${tokens.variant.ghostText};
          border: ${tokens.variant.ghostBorder};

          &:hover {
            background: ${tokens.variant.ghostBackgroundHover};
          }

          &:active {
            background: ${tokens.variant.ghostBackgroundActive};
          }
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &:focus-visible {
          outline: 2px solid ${tokens.variant.primaryBackground};
          outline-offset: 2px;
        }
      }
    `,
  ]
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-button': Button
  }
}
