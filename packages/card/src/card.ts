import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors, spacing } from '@lime-soda/core';

@customElement('ls-card')
export class LsCard extends LitElement {
  @property({ type: String }) variant: 'default' | 'bordered' | 'elevated' = 'default';
  @property({ type: String }) padding: 'sm' | 'md' | 'lg' = 'md';

  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: white;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .default {
      border: 1px solid ${unsafeCSS(colors.neutral[200])};
    }

    .bordered {
      border: 2px solid ${unsafeCSS(colors.neutral[300])};
    }

    .elevated {
      border: 1px solid ${unsafeCSS(colors.neutral[200])};
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    .elevated:hover {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }

    .sm {
      padding: ${unsafeCSS(spacing['4'])};
    }

    .md {
      padding: ${unsafeCSS(spacing['6'])};
    }

    .lg {
      padding: ${unsafeCSS(spacing['8'])};
    }
  `;

  render() {
    return html`
      <div class="card ${this.variant} ${this.padding}">
        <slot></slot>
      </div>
    `;
  }
}