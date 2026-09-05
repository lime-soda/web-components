import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import './Input.js';
import type { Input } from './Input.js';

/**
 * What the input promises, in a real browser.
 *
 * Its whole reason to exist is to be placed somewhere by a host that has its
 * own rules, so most of these are about the seams rather than the appearance:
 * the value reaching a listener outside the shadow root, the role it announces,
 * and the custom properties a host re-points to make it fit.
 */

let element: Input | undefined;

const mount = (html: string): Input => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  element = host.firstElementChild as Input;
  return element;
};

const inner = (input: Input) => input.shadowRoot!.querySelector('input')!;

afterEach(() => {
  element?.parentElement?.remove();
  element = undefined;
});

describe('axe', () => {
  it('finds nothing wrong with a labelled input', async () => {
    const input = mount('<ls-input label="Instrument"></ls-input>');
    await input.updateComplete;

    const results = await axe.run(input, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe('behaviour', () => {
  it('announces itself as a text box by default', async () => {
    const input = mount('<ls-input label="Instrument"></ls-input>');
    await input.updateComplete;

    expect(inner(input).type).toBe('text');
    expect(inner(input).getAttribute('aria-label')).toBe('Instrument');
  });

  it('announces itself as a search box when asked', async () => {
    // A real difference to a reader, and to anything looking for one, so it is
    // the caller's to state rather than something fixed at text.
    const input = mount('<ls-input type="search" label="Filter"></ls-input>');
    await input.updateComplete;

    expect(inner(input).type).toBe('search');
  });

  it('reports its value where a consumer is listening', async () => {
    // On the host, because the inner input's own event stops at the shadow
    // boundary and a consumer listens where it put the element.
    const input = mount('<ls-input label="Instrument"></ls-input>');
    await input.updateComplete;
    let heard: string | undefined;
    input.addEventListener('ls-input', (event) => {
      heard = (event as CustomEvent<string>).detail;
    });

    inner(input).value = 'UKT';
    inner(input).dispatchEvent(new Event('input', { bubbles: true }));

    expect(heard).toBe('UKT');
    expect(input.value).toBe('UKT');
  });

  it('takes the caret and selects what is there', async () => {
    // Selected rather than placed at the end: a host asking for focus is one
    // where typing should replace, such as an editor opened on a value.
    const input = mount('<ls-input label="Instrument" value="UKT 4%"></ls-input>');
    await input.updateComplete;

    input.focusInput();

    expect(input.shadowRoot!.activeElement).toBe(inner(input));
    expect(inner(input).selectionStart).toBe(0);
    expect(inner(input).selectionEnd).toBe('UKT 4%'.length);
  });

  it('forwards inputmode rather than shadowing the DOM property', async () => {
    // HTMLElement already has inputMode, and a reactive accessor over an
    // inherited DOM property breaks the element outright.
    const input = mount('<ls-input inputmode="decimal" label="Price"></ls-input>');
    await input.updateComplete;

    expect(inner(input).getAttribute('inputmode')).toBe('decimal');
  });

  it('disables the input it holds, not just itself', async () => {
    const input = mount('<ls-input disabled label="Instrument"></ls-input>');
    await input.updateComplete;

    expect(inner(input).disabled).toBe(true);
  });
});

describe('what a host can reach', () => {
  it('exposes the field as a part', async () => {
    // The seam that lets a grid cell drop the border without this component
    // knowing a grid exists.
    const input = mount('<ls-input label="Instrument"></ls-input>');
    await input.updateComplete;

    expect(inner(input).getAttribute('part')).toBe('field');
  });

  it('takes its padding from a custom property a host can re-point', async () => {
    const input = mount('<ls-input label="Instrument"></ls-input>');
    input.style.setProperty('--input-padding', '0px 12px');
    await input.updateComplete;

    expect(getComputedStyle(inner(input)).paddingLeft).toBe('12px');
  });

  it('can have its border removed entirely, which is what a cell editor does', async () => {
    const input = mount('<ls-input label="Instrument"></ls-input>');
    input.style.setProperty('--input-border-width', '0');
    await input.updateComplete;

    expect(getComputedStyle(inner(input)).borderTopWidth).toBe('0px');
  });

  it('marks itself active, so a host can show the input is holding something', async () => {
    const input = mount('<ls-input active label="Filter"></ls-input>');
    await input.updateComplete;

    expect(input.hasAttribute('active')).toBe(true);
    // The active colour differs from the resting one, or the state says nothing.
    const active = getComputedStyle(inner(input)).borderTopColor;
    input.active = false;
    await input.updateComplete;

    expect(getComputedStyle(inner(input)).borderTopColor).not.toBe(active);
  });
});
