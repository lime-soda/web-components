import * as tokens from '@lime-soda/tokens/grid';
import { LitElement, css } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * Base class for a cell editor.
 *
 * The counterpart to `CellRendererElement`, and deliberately not a subclass of
 * it. A renderer reads from context and shows a value; an editor is handed the
 * value it starts from and reports back what the reader did. Sharing a base
 * would give an editor context it does not need and a renderer a commit channel
 * it has no use for.
 *
 * An editor's whole contract is the three members below. It does not write to
 * the store, does not know which row it is on, and cannot see the grid — the
 * module owns all of that. That is what keeps an editor testable on its own and
 * replaceable by an application's own element.
 *
 * @example
 * ```ts
 * @customElement('my-currency-editor')
 * class MyCurrencyEditor extends CellEditorElement<number> {
 *   render() {
 *     return html`<input .value=${String(this.value ?? '')} @input=${this.onInput} />`;
 *   }
 *   private onInput = (e: Event) => {
 *     this.commitValue(Number((e.target as HTMLInputElement).value));
 *   };
 * }
 * ```
 */
export abstract class CellEditorElement<TValue = unknown> extends LitElement {
  /**
   * An editor is the cell while it is open, so it fills it.
   *
   * On the base class because it is true of any editor, and because a custom
   * element defaults to `display: inline` — which leaves whatever is inside it
   * sized to its content and floating in the middle of the row. A subclass that
   * declares its own `styles` takes this over and is on its own.
   */
  static override styles = css`
    /*
     * An editor is the cell while it is open, so the input inside it is told to
     * stop looking like an input: no border, no ring, the cell's own padding,
     * the cell's own type scale. Said in the input's custom properties rather
     * than through a variant on the input itself — the component has no reason
     * to know a grid cell exists, and a host that can re-point its tokens does
     * not need it to.
     *
     * The ring in particular: the cell already draws one, and a second inside
     * it is a box within a box.
     */
    ls-input {
      --input-padding: 0 ${tokens.cellPaddingX};
      --input-border-width: 0;
      --input-radius: 0;
      --input-font-size: ${tokens.fontSize};
      --input-focus-width: 0;
      flex: 1;
      min-width: 0;
    }

    :host {
      display: flex;
      width: 100%;
      height: 100%;
      /*
       * Stretch rather than a percentage height. A cell takes its height from
       * the grid's row track, so it has no definite height of its own for a
       * percentage to resolve against — the editor fell back to its content and
       * sat half-height in the middle of the row. Stretching along the cell's
       * cross axis needs no such resolution.
       */
      align-self: stretch;
    }
  `;

  /**
   * The value the edit started from, after `valueGetter` and before formatting.
   *
   * Formatting is deliberately skipped: a formatter exists to make a value
   * readable, and editing `1,234.00` means parsing a display string back into
   * the number it came from, which no formatter promises is possible.
   */
  @property({ attribute: false })
  accessor value: TValue | undefined;

  /**
   * A character that started the edit, when typing was what opened it.
   *
   * Typing over a cell should replace its contents with what was typed, the way
   * a spreadsheet does — not append to a value the reader did not ask to keep.
   * Undefined when the edit was opened by Enter, F2 or a double click, which
   * all mean "change what is here".
   */
  @property({ attribute: false })
  accessor initialInput: string | undefined;

  /**
   * What the reader is editing, for the editor's accessible name.
   *
   * The column's heading. A cell announces itself by its content, and once that
   * content is a text box the announcement is whatever the box is named — so an
   * unnamed one leaves a screen reader user typing into "edit text, blank",
   * with nothing to say which column they are in.
   */
  @property({ attribute: false })
  accessor label = '';

  /**
   * Called by the editor when its value changes. The module keeps the latest.
   *
   * Reported as it changes rather than only at the end, so committing does not
   * have to reach into the editor and ask — which is what lets a commit be
   * triggered by something the editor never sees, such as focus leaving.
   */
  @property({ attribute: false })
  accessor commitValue: (value: TValue) => void = () => {};

  /**
   * Puts the caret where typing should go. Called once the editor is on screen.
   *
   * Default is the first focusable thing in the shadow root, which covers an
   * editor that is one input. Override for anything else.
   */
  focusEditor(): void {
    const focusable = this.shadowRoot?.querySelector<HTMLElement>(
      'input, select, textarea, [tabindex]',
    );
    focusable?.focus();
    if (focusable instanceof HTMLInputElement) focusable.select();
  }
}
