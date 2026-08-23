import * as tokens from '@lime-soda/tokens/grid';
import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

/** How the field is drawn, which is the only thing its two uses disagree about. */
export type TextFieldAppearance = 'bare' | 'boxed';

/**
 * One text input, for the places the grid needs one.
 *
 * A cell editor and a column filter are the same box and not the same control.
 * What they share is everything visual — the tokens, the sizing, the focus
 * treatment, the accessible name — and none of the behaviour: an editor wants
 * Enter, Tab and Escape, while a filter wants the grid never to see them at all.
 * So this owns the box and the value, and leaves keys entirely to whoever put
 * it there. A single component that tried to own both key models would need a
 * mode flag, and would be two components wearing one name.
 *
 * `type` is passed through rather than fixed. A filter is a search field and is
 * announced as `searchbox`; an editor is a `textbox`. That distinction is real —
 * the story helpers rely on it to tell one from the other — so it is the
 * consumer's to state.
 *
 * @csspart field - The input itself
 *
 * @customElement ls-grid-text-field
 */
@customElement('ls-grid-text-field')
export class TextField extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      min-width: 0;
    }

    input {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      margin: 0;
      font: inherit;
      font-family: ${tokens.font};
      font-variant-numeric: ${tokens.numericVariant};
      color: ${tokens.text};
    }

    /*
     * Bare: the field is the cell for as long as it is open, so it carries no
     * box of its own. The cell already has the focus ring, and a second ring
     * inside it draws a box within a box.
     */
    :host([appearance='bare']) input {
      padding: 0 ${tokens.cellPaddingX};
      border: none;
      background: ${tokens.background};
      font-size: ${tokens.fontSize};
      outline: none;
    }

    /* Fills whatever it was put in, without asking that box for a height. */
    :host([appearance='bare']) {
      flex: 1;
    }

    :host([appearance='bare']) input {
      flex: 1;
    }

    /*
     * Boxed: the field sits among other things and has to look like something
     * you can type into — a filter beside a column heading.
     */
    :host([appearance='boxed']) input {
      padding: ${tokens.filterPadding};
      border: 1px solid ${tokens.border};
      border-radius: ${tokens.radius};
      background: transparent;
      font-size: ${tokens.filterFontSize};
    }

    :host([appearance='boxed']) input:focus-visible {
      outline: ${tokens.focusWidth} solid ${tokens.focus};
      outline-offset: 1px;
    }

    /* Something is set. Worth seeing at a glance across a wide monitor. */
    :host([appearance='boxed'][active]) input {
      border-color: ${tokens.focus};
    }
  `;

  @property({ reflect: true })
  accessor appearance: TextFieldAppearance = 'bare';

  /** Mirrors the input's own `type`, and with it the role it is announced as. */
  @property({ reflect: true })
  accessor type: 'text' | 'search' = 'text';

  @property()
  accessor value = '';

  @property()
  accessor placeholder = '';

  /**
   * The field's accessible name.
   *
   * Required in practice: this renders a bare input with no visible label of
   * its own, so without one a reader is told "edit text, blank" and left to
   * guess which column they are in.
   */
  @property()
  accessor label = '';

  /** Set when the field holds something, for the boxed appearance to show. */
  @property({ type: Boolean, reflect: true })
  accessor active = false;

  @query('input')
  private accessor input!: HTMLInputElement | null;

  override render(): unknown {
    return html`<input
      part="field"
      type=${this.type}
      aria-label=${this.label}
      placeholder=${this.placeholder}
      .value=${this.value}
      @input=${this.handleInput}
    />`;
  }

  /**
   * Puts the caret in, selecting what is there.
   *
   * Selected because both uses want typing to replace rather than append: an
   * editor opened on a value means "change this", and a filter being retyped
   * means a new filter.
   */
  focusField(): void {
    this.input?.focus();
    this.input?.select();
  }

  private readonly handleInput = (event: Event): void => {
    const next = (event.target as HTMLInputElement).value;
    this.value = next;
    // Re-dispatched from the host, because the input's own event stops at this
    // shadow boundary and a consumer listens where it put the element.
    this.dispatchEvent(new CustomEvent('ls-input', { detail: next, bubbles: false }));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-grid-text-field': TextField;
  }
}
