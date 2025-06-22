import { LitElement, html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { colors, spacing } from '@lime-soda/core'

@customElement('ls-input')
export class LsInput extends LitElement {
  @property({ type: String }) type: 'text' | 'email' | 'password' | 'number' = 'text'
  @property({ type: String }) placeholder = ''
  @property({ type: String }) value = ''
  @property({ type: Boolean }) disabled = false
  @property({ type: Boolean }) required = false

  static styles = css`
    :host {
      display: block;
    }

    input {
      width: 100%;
      padding: ${unsafeCSS(spacing['2.5'])} ${unsafeCSS(spacing['3'])};
      border: 1px solid ${unsafeCSS(colors.neutral[300])};
      border-radius: 6px;
      font-family: inherit;
      font-size: 1rem;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    input:focus {
      outline: none;
      border-color: ${unsafeCSS(colors.primary[500])};
      box-shadow: 0 0 0 3px ${unsafeCSS(colors.primary[100])};
    }

    input:disabled {
      background-color: ${unsafeCSS(colors.neutral[100])};
      cursor: not-allowed;
      opacity: 0.6;
    }

    input::placeholder {
      color: ${unsafeCSS(colors.neutral[400])};
    }
  `

  render() {
    return html`
      <input
        type=${this.type}
        placeholder=${this.placeholder}
        .value=${this.value}
        ?disabled=${this.disabled}
        ?required=${this.required}
        @input=${this._handleInput}
      />
    `
  }

  private _handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    this.value = target.value
    this.dispatchEvent(
      new CustomEvent('input', {
        detail: { value: target.value },
        bubbles: true,
      })
    )
  }
}
