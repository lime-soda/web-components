import { CellRendererElement } from '@flow-grid/core';
import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { Bond } from './bond-data.js';

/**
 * A depth bar drawn from the cell's own value.
 *
 * Demonstrates the point of context-based renderers: this element receives no
 * props. It reads its row and column off context, so it repaints when its row
 * ticks and stays inert otherwise.
 */
@customElement('depth-bar')
export class DepthBar extends CellRendererElement<Bond, number> {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }

    .bar {
      position: absolute;
      top: 0;
      bottom: 0;
      opacity: 0.35;
      transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .bar[data-side='bid'] {
      right: 0;
      background: #22c55e;
    }

    .bar[data-side='ask'] {
      left: 0;
      background: #ef4444;
    }
  `;

  override render() {
    // Keyed off the data, not off tree metadata: a renderer that consulted
    // `meta.depth` would draw nothing at all when the tree module is not
    // installed, which is not the same question as "is this a group row".
    if (this.data?.parentId === null) return nothing;

    const value = this.value ?? 0;
    const side = this.column?.field === 'bidDepth' ? 'bid' : 'ask';
    const percentage = Math.min(100, (value / 10_000) * 100);

    return html`<div class="bar" data-side=${side} style="width: ${percentage}%"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'depth-bar': DepthBar;
  }
}
