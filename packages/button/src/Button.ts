import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

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

  render() {
    return html`
      <button part="button" class="${this.size}">
        <slot></slot>
      </button>
    `
  }

  static styles = css`
    :host {
      --bg-color: var(--button-bg, var(--color-primary-300));
      --text-color: var(--button-text-color, var(--color-black));
    }

    button {
      background: var(--bg-color);
      border-radius: 0.5rem;
      border: none;
      color: var(--text-color);
      cursor: pointer;
      font-weight: 500;
      padding: 0.5rem 1rem;
      transition: background var(--transition-duration-medium, 0.3s);

      &.sm {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
      }

      &.lg {
        font-size: 1.25rem;
        padding: 0.75rem 1.25rem;
      }
    }

    button:hover {
      background: var(--color-orange-400);
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-button': Button
  }
}
