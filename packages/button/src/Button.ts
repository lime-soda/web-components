import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { colorPrimary300, colorPrimary400 } from '@lime-soda/tokens'

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

  render() {
    return html`
      <button part="button" class="${this.size}">
        <slot></slot>
      </button>
    `
  }

  static styles = css`
    :host {
      --bg-color: var(
        --button-bg,
        light-dark(${colorPrimary300}, ${colorPrimary400})
      );
      --bg-color-hover: var(--button-bg-hover, var(--color-primary-300));
      --text-color: var(--button-text-color, var(--color-text-on-primary));
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
      background: var(--bg-color-hover);
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-button': Button
  }
}
