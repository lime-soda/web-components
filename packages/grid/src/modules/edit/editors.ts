import * as tokens from '@lime-soda/tokens/grid';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { CellEditorElement } from './cell-editor-element.js';

/**
 * The editors that ship with the module.
 *
 * Both are one input filling the cell, and both are styled from the grid's own
 * tokens rather than from any of their own: an editor is the cell for as long
 * as it is open, and one that does not look like the grid around it reads as a
 * popup that has landed in the wrong place. There is deliberately no
 * `--grid-editor-*` tier yet — nothing here needs to differ from the cell it
 * replaces, and a token nobody varies is a token to maintain for nothing.
 */
const shared = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0 ${tokens.cellPaddingX};
    border: none;
    background: ${tokens.background};
    color: ${tokens.text};
    font: inherit;
    font-family: ${tokens.font};
    font-size: ${tokens.fontSize};
    font-variant-numeric: ${tokens.numericVariant};

    /*
     * The cell already carries the focus ring, and the editor sits inside it.
     * A second ring on the input draws a box within a box.
     */
    outline: none;
  }
`;

@customElement('ls-grid-text-editor')
export class TextEditor extends CellEditorElement<string> {
  static override styles = shared;

  override render(): unknown {
    return html`<input
      type="text"
      part="cell-editor"
      aria-label=${this.label}
      .value=${this.startingText}
      @input=${this.handleInput}
    />`;
  }

  private get startingText(): string {
    if (this.initialInput !== undefined) return this.initialInput;
    return this.value === undefined || this.value === null ? '' : String(this.value);
  }

  private readonly handleInput = (event: Event): void => {
    this.commitValue((event.target as HTMLInputElement).value);
  };
}

/**
 * The same, restricted to numbers.
 *
 * `inputmode` rather than `type="number"`: a number input brings spinners and a
 * browser-specific idea of what counts as valid, and reports an empty string
 * for anything it dislikes — so a typo becomes an erased value rather than a
 * rejected one. Typing is left alone and the parse happens here, where a
 * failure can be reported as "no change" instead.
 */
@customElement('ls-grid-number-editor')
export class NumberEditor extends CellEditorElement<number> {
  static override styles = shared;

  override render(): unknown {
    return html`<input
      type="text"
      inputmode="decimal"
      part="cell-editor"
      aria-label=${this.label}
      .value=${this.startingText}
      @input=${this.handleInput}
    />`;
  }

  private get startingText(): string {
    if (this.initialInput !== undefined) return this.initialInput;
    return this.value === undefined || this.value === null ? '' : String(this.value);
  }

  private readonly handleInput = (event: Event): void => {
    const text = (event.target as HTMLInputElement).value.trim();
    // An empty box is a value being cleared, and is left to the module's
    // `parse` to reject or accept. Anything unparseable simply is not reported,
    // so the last good value stands and the commit is a no-op.
    if (text === '') return;
    const parsed = Number(text);
    if (Number.isNaN(parsed)) return;
    this.commitValue(parsed);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-grid-text-editor': TextEditor;
    'ls-grid-number-editor': NumberEditor;
  }
}
