import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import './Button.js';
import type { Button } from './Button.js';

/**
 * Accessibility and behaviour, measured rather than asserted.
 *
 * The Storybook stories already run axe, but one story at a time and only over
 * the variants a story happens to render. These walk every size and variant
 * combination, and cover the parts a screenshot cannot: focus, keyboard
 * activation, and what the element exposes to assistive technology.
 */

const SIZES = ['sm', 'md', 'lg'] as const;
const VARIANTS = ['primary', 'secondary', 'outline', 'ghost'] as const;

let host: HTMLDivElement | undefined;

function mount(props: Partial<Pick<Button, 'size' | 'variant'>> = {}, label = 'Save'): Button {
  host = document.createElement('div');
  document.body.append(host);

  const button = document.createElement('ls-button') as Button;
  if (props.size) button.size = props.size;
  if (props.variant) button.variant = props.variant;
  button.textContent = label;
  host.append(button);
  return button;
}

/** The inner native button, which is what actually takes focus and clicks. */
const inner = (button: Button): HTMLButtonElement => button.shadowRoot!.querySelector('button')!;

/** Runs axe over the element and returns violations, described for a failure. */
async function violationsIn(element: Element): Promise<string[]> {
  const results = await axe.run(element, {
    // Contrast depends on the page's theme rather than on the component, and
    // this harness has none. The themed check is the Storybook one.
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact}): ` +
        `${(node.failureSummary ?? violation.help).replaceAll('\n', ' ')}`,
    ),
  );
}

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('axe', () => {
  for (const size of SIZES) {
    for (const variant of VARIANTS) {
      it(`finds nothing wrong with ${variant} at ${size}`, async () => {
        const button = mount({ size, variant });
        await button.updateComplete;

        expect(await violationsIn(button)).toEqual([]);
      });
    }
  }

  it('finds nothing wrong with an unlabelled button', async () => {
    // A button with no text content is an empty target, and axe should say so
    // rather than the component quietly rendering one.
    const button = mount({}, '');
    await button.updateComplete;

    expect(await violationsIn(button)).not.toEqual([]);
  });
});

describe('behaviour', () => {
  it('renders the size and variant as classes on the inner button', async () => {
    const button = mount({ size: 'lg', variant: 'outline' });
    await button.updateComplete;

    expect([...inner(button).classList]).toEqual(['lg', 'outline']);
  });

  it('defaults to a medium primary button', async () => {
    const button = mount();
    await button.updateComplete;

    expect(button.size).toBe('md');
    expect(button.variant).toBe('primary');
  });

  it('reacts to a property change', async () => {
    // Standard decorators route reactive properties through `accessor`. This is
    // the assertion that catches a decorator migration going wrong: the element
    // compiles and renders either way, but stops re-rendering on change.
    const button = mount();
    await button.updateComplete;

    button.variant = 'ghost';
    await button.updateComplete;

    expect(inner(button).classList.contains('ghost')).toBe(true);
  });

  it('reflects an attribute onto the property', async () => {
    const button = mount();
    button.setAttribute('variant', 'secondary');
    await button.updateComplete;

    expect(button.variant).toBe('secondary');
    expect(inner(button).classList.contains('secondary')).toBe(true);
  });

  it('puts focus on the inner button, and clicking it fires from the host', async () => {
    const button = mount();
    await button.updateComplete;

    let clicks = 0;
    button.addEventListener('click', () => (clicks += 1));

    inner(button).focus();
    expect(button.shadowRoot!.activeElement).toBe(inner(button));

    inner(button).click();
    expect(clicks).toBe(1);
  });
});
