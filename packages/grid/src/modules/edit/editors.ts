import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../../components/text-field.js';
import type { TextField } from '../../components/text-field.js';
import { CellEditorElement } from './cell-editor-element.js';

/**
 * The editors that ship with the module.
 *
 * Both are one text field filling the cell. The field is shared with the filter
 * module rather than each writing its own input, so a change to how the grid
 * draws something you type into happens once — and so the accessible name is
 * plumbed the same way in both, which is where the editors were wrong before.
 *
 * What is not shared is the keys. An editor's Enter, Tab and Escape belong to
 * the edit module, and the field never sees them.
 */

@customElement('ls-grid-text-editor')
export class TextEditor extends CellEditorElement<string> {
  override render(): unknown {
    return html`<ls-grid-text-field
      exportparts="field: cell-editor"
      appearance="bare"
      .label=${this.label}
      .value=${this.startingText}
      @ls-input=${this.handleInput}
    ></ls-grid-text-field>`;
  }

  private get startingText(): string {
    if (this.initialInput !== undefined) return this.initialInput;
    return this.value === undefined || this.value === null ? '' : String(this.value);
  }

  private readonly handleInput = (event: CustomEvent<string>): void => {
    this.commitValue(event.detail);
  };

  override focusEditor(): void {
    this.shadowRoot?.querySelector<TextField>('ls-grid-text-field')?.focusField();
  }
}

/**
 * The same, restricted to numbers.
 *
 * Still a text field rather than `type="number"`: a number input brings spinners
 * and a browser-specific idea of what counts as valid, and reports an empty
 * string for anything it dislikes — so a typo becomes an erased value rather
 * than a rejected one. Typing is left alone and the parse happens here, where a
 * failure can be reported as no change instead.
 */
@customElement('ls-grid-number-editor')
export class NumberEditor extends CellEditorElement<number> {
  override render(): unknown {
    return html`<ls-grid-text-field
      exportparts="field: cell-editor"
      appearance="bare"
      inputmode="decimal"
      .label=${this.label}
      .value=${this.startingText}
      @ls-input=${this.handleInput}
    ></ls-grid-text-field>`;
  }

  private get startingText(): string {
    if (this.initialInput !== undefined) return this.initialInput;
    return this.value === undefined || this.value === null ? '' : String(this.value);
  }

  private readonly handleInput = (event: CustomEvent<string>): void => {
    const text = event.detail.trim();
    // An empty box is left to the module to accept or reject. Anything
    // unparseable is simply not reported, so the last good value stands and the
    // commit is a no-op.
    if (text === '') return;
    const parsed = Number(text);
    if (Number.isNaN(parsed)) return;
    this.commitValue(parsed);
  };

  override focusEditor(): void {
    this.shadowRoot?.querySelector<TextField>('ls-grid-text-field')?.focusField();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-grid-text-editor': TextEditor;
    'ls-grid-number-editor': NumberEditor;
  }
}
