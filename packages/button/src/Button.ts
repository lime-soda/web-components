import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import * as styles from '@lime-soda/tokens/button'

/**
 * Button element.
 *
 * @slot - Default slot for button content
 * @csspart button - The button
 * @cssproperty --button-bg - Background color of the button
 * @cssproperty --button-bg-hover - Background color of the button on hover
 * @cssproperty --button-text-color - Text color of the button
 */
@customElement('ls-button')
export class Button extends LitElement {
  /**
   * The size of the button.
   */
  @property({ type: String })
  size: 'sm' | 'md' | 'lg' = 'sm'

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
        transition: background var(--transition-duration-medium, 0.3s);

        &.sm {
          border-radius: ${styles.buttonSmBorderRadius};
          font: ${styles.buttonSmFont};
          padding: ${styles.buttonSmPadding};
        }

        &.md {
          border-radius: ${styles.buttonMdBorderRadius};
          font: ${styles.buttonMdFont};
          padding: ${styles.buttonMdPadding};
        }

        &.lg {
          border-radius: ${styles.buttonLgBorderRadius};
          font: ${styles.buttonLgFont};
          padding: ${styles.buttonLgPadding};
        }

        &.primary {
          background: ${styles.buttonPrimaryBackgroundColor};
          color: ${styles.buttonPrimaryColor};
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
