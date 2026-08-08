import type { CSSResultOrNative } from 'lit';

/**
 * Appends module stylesheets to a shadow root, once.
 *
 * Lit's own `adoptStyles` replaces `adoptedStyleSheets` wholesale, which would
 * discard the component's `static styles`. This appends instead, and remembers
 * what it has already added so repeated renders do not accumulate duplicates.
 *
 * Constructed stylesheets are shared by reference across every shadow root that
 * adopts them, so a module's styles cost one sheet regardless of how many cells
 * are on screen.
 */
const adopted = new WeakMap<ShadowRoot, Set<CSSStyleSheet>>();

export function adoptModuleStyles(
  root: ShadowRoot | null | undefined,
  styles: readonly CSSResultOrNative[],
): void {
  if (!root || styles.length === 0) return;

  let seen = adopted.get(root);
  if (!seen) {
    seen = new Set();
    adopted.set(root, seen);
  }

  const additions: CSSStyleSheet[] = [];
  for (const style of styles) {
    const sheet = style instanceof CSSStyleSheet ? style : style.styleSheet;
    // A CSSResult only has a styleSheet where constructable stylesheets are
    // supported; everywhere modern, that is everywhere.
    if (!sheet || seen.has(sheet)) continue;
    seen.add(sheet);
    additions.push(sheet);
  }

  if (additions.length > 0) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...additions];
  }
}
