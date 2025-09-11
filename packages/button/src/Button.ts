import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import buttonCssProps from '@lime-soda/tokens/button'

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

  static styles = css`
    ${buttonCssProps}

    button {
      border: none;
      cursor: pointer;
      transition: background var(--transition-duration-medium, 0.3s);

      &.sm {
        border-radius: var(--button-sm-border-radius);
        font: var(--button-sm-font);
        padding: var(--button-sm-padding);
      }

      &.md {
        border-radius: var(--button-md-border-radius);
        font: var(--button-md-font);
        padding: var(--button-md-padding);
      }

      &.lg {
        border-radius: var(--button-lg-border-radius);
        font: var(--button-lg-font);
        padding: var(--button-lg-padding);
      }

      &.primary {
        background: var(--button-primary-background-color);
        color: var(--button-primary-color);
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-button': Button
  }
}
