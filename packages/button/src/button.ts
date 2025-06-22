import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors, spacing } from '@lime-soda/core';

@customElement('ls-button')
export class LsButton extends LitElement {
  @property({ type: String }) variant: 'primary' | 'secondary' | 'outline' = 'primary';
  @property({ type: String }) size: 'sm' | 'md' | 'lg' = 'md';
  @property({ type: Boolean }) disabled = false;

  static styles = css`
    :host {
      display: inline-block;
    }

    button {
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 500;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: ${unsafeCSS(spacing['2'])};
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .primary {
      background: ${unsafeCSS(colors.primary[500])};
      color: white;
    }

    .primary:hover:not(:disabled) {
      background: ${unsafeCSS(colors.primary[600])};
    }

    .secondary {
      background: ${unsafeCSS(colors.secondary[500])};
      color: white;
    }

    .secondary:hover:not(:disabled) {
      background: ${unsafeCSS(colors.secondary[600])};
    }

    .outline {
      background: transparent;
      border: 1px solid ${unsafeCSS(colors.neutral[300])};
      color: ${unsafeCSS(colors.neutral[700])};
    }

    .outline:hover:not(:disabled) {
      background: ${unsafeCSS(colors.neutral[50])};
      border-color: ${unsafeCSS(colors.neutral[400])};
    }

    .sm {
      padding: ${unsafeCSS(spacing['2'])} ${unsafeCSS(spacing['3'])};
      font-size: 0.875rem;
    }

    .md {
      padding: ${unsafeCSS(spacing['2.5'])} ${unsafeCSS(spacing['4'])};
      font-size: 1rem;
    }

    .lg {
      padding: ${unsafeCSS(spacing['3'])} ${unsafeCSS(spacing['6'])};
      font-size: 1.125rem;
    }
  `;

  render() {
    return html`
      <button
        class="${this.variant} ${this.size}"
        ?disabled=${this.disabled}
      >
        <slot></slot>
      </button>
    `;
  }
}