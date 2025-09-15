import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import * as styles from '@lime-soda/tokens/button'

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
  size: 'sm' | 'md' | 'lg' = 'sm'

  /**
   * The color of the button.
   */
  @property({ type: String })
  color: 'primary' | 'secondary' = 'primary'

  render() {
    return html`
      <button part="button" class="${this.size} ${this.color}">
        <slot></slot>
      </button>
    `
  }

  static styles = [
    styles.props,
    css`
      button {
        border: none;
        cursor: pointer;
        transition: background ${styles.transition};

        &.sm {
          border-radius: ${styles.sm.borderRadius};
          font: ${styles.sm.font};
          padding: ${styles.sm.padding};
        }

        &.md {
          border-radius: ${styles.md.borderRadius};
          font: ${styles.md.font};
          padding: ${styles.md.padding};
        }

        &.lg {
          border-radius: ${styles.lg.borderRadius};
          font: ${styles.lg.font};
          padding: ${styles.lg.padding};
        }

        &.primary {
          background: ${styles.primary.backgroundColor};
          color: ${styles.primary.color};

          &:hover {
            background: ${styles.primary.backgroundColorHover};
          }
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
