import * as tokens from '@lime-soda/tokens/input';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

/**
 * A single-line text input.
 *
 * Deliberately thin. It draws a box, holds a value, and says what it is — and
 * leaves keys alone, because what a key means belongs to whoever put the input
 * somewhere. A cell editor wants Enter, Tab and Escape; a filter box wants the
 * grid never to see them; a form wants neither. An input that tried to own all
 * three would need a mode flag and would be three components wearing one name.
 *
 * Everything visual comes from `--input-*`, and the field itself is exposed as
 * a part. That is what lets a host place this somewhere with its own rules —
 * the grid drops the border and the padding for a cell editor, and keeps them
 * for a column filter — without this component knowing either context exists.
 *
 * @csspart field - The input element itself
 *
 * @cssprop --input-padding - Inside the input, around its text
 * @cssprop --input-radius - Corner radius
 * @cssprop --input-background - The well the text sits in
 * @cssprop --input-text - The text the reader types
 * @cssprop --input-placeholder - The hint shown while the input is empty
 * @cssprop --input-border-width - Thickness of the outline
 * @cssprop --input-border-color - Colour of the outline at rest
 * @cssprop --input-border-color-active - Colour of the outline when `active` is set
 * @cssprop --input-focus-width - Thickness of the focus ring
 * @cssprop --input-focus-offset - Gap between the input and its focus ring
 * @cssprop --input-focus-color - Colour of the focus ring
 *
 * @fires ls-input - The value changed. `detail` is the new value.
 *
 * @customElement ls-input
 */
@customElement('ls-input')
export class Input extends LitElement {
  static override styles = [
    tokens.props,
    css`
      :host {
        display: inline-flex;
        min-width: 0;
      }

      input {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        margin: 0;
        padding: ${tokens.padding};
        border: ${tokens.border.width} solid ${tokens.border.color};
        border-radius: ${tokens.radius};
        background: ${tokens.background};
        color: ${tokens.text};
        font-family: ${tokens.font.family};
        font-size: ${tokens.font.size};
        font-variant-numeric: ${tokens.font.numericVariant};
      }

      input::placeholder {
        color: ${tokens.placeholder};
      }

      input:focus-visible {
        outline: ${tokens.focus.width} solid ${tokens.focus.color};
        outline-offset: ${tokens.focus.offset};
      }

      /* Holding something worth noticing — a filter that is narrowing a list. */
      :host([active]) input {
        border-color: ${tokens.border.colorActive};
      }

      :host([disabled]) {
        opacity: ${tokens.disabled.opacity};
      }
    `,
  ];

  /**
   * Mirrors the input's own `type`, and with it the role it is announced as.
   *
   * A search field is a `searchbox` rather than a `textbox`, which is a real
   * difference to a reader and to anything looking for one, so it is the
   * caller's to state rather than something to fix at `text`.
   */
  @property({ reflect: true })
  accessor type: 'text' | 'search' = 'text';

  @property()
  accessor value = '';

  @property()
  accessor placeholder = '';

  /**
   * The accessible name.
   *
   * Required in practice: this renders a bare input with no visible label of
   * its own, so without one a reader is told "edit text, blank" and left to
   * work out what it is for.
   */
  @property()
  accessor label = '';

  /** Set when the input holds something the host wants to draw attention to. */
  @property({ type: Boolean, reflect: true })
  accessor active = false;

  @property({ type: Boolean, reflect: true })
  accessor disabled = false;

  /*
   * `inputmode` is forwarded from the host's own attribute rather than declared
   * as a property. HTMLElement already has `inputMode`, and shadowing an
   * inherited DOM property with a reactive accessor breaks the element outright
   * — the same trap that stopped `scrollLeft` being used as a property name in
   * the grid. A host writes the attribute; this passes it on.
   */

  @query('input')
  private accessor field!: HTMLInputElement | null;

  override render(): unknown {
    return html`<input
      part="field"
      type=${this.type}
      aria-label=${this.label}
      placeholder=${this.placeholder}
      inputmode=${this.getAttribute('inputmode') ?? nothing}
      ?disabled=${this.disabled}
      .value=${this.value}
      @input=${this.handleInput}
    />`;
  }

  /**
   * Puts the caret in, selecting what is there.
   *
   * Selected rather than placed at the end, because the callers that ask for
   * focus programmatically are the ones where typing should replace: an editor
   * opened on a value means "change this".
   */
  focusInput(): void {
    this.field?.focus();
    this.field?.select();
  }

  private readonly handleInput = (event: Event): void => {
    const next = (event.target as HTMLInputElement).value;
    this.value = next;
    // Re-dispatched from the host: the input's own event stops at this shadow
    // boundary, and a consumer listens where it put the element.
    this.dispatchEvent(new CustomEvent('ls-input', { detail: next }));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-input': Input;
  }
}
