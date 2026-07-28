import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_TOKENS, customPropertyFor } from './tokens.js';

/**
 * Keeps the theme schema honest against the source.
 *
 * A token list is only a contract if nothing can read a property that is not on
 * it. These tests walk the actual source, so adding `var(--tf-something-new)` to
 * a component without declaring the token fails here rather than quietly
 * producing an unthemeable value.
 */

const SRC = join(import.meta.dirname, '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out);
    } else if (/\.(ts|css)$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

const files = sourceFiles(SRC);
const declaredProperties = new Set(THEME_TOKENS.map(customPropertyFor));

/**
 * Properties that are internal plumbing rather than theme tokens: a component
 * writes them and a component reads them, and a consumer has no business setting
 * them. Each is either measured geometry or a per-cell value.
 */
const INTERNAL = new Set([
  '--tf-instance-width',
  '--tf-instance-height',
  '--tf-spacer-height',
  '--tf-column-template',
  '--tf-tree-depth',
]);

/** Sub-token knobs a consumer may set but which are not part of the core schema. */
const OPTIONAL = new Set([
  '--tf-tree-expander-size',
  '--tf-tree-expander-font-size',
  '--tf-sort-indicator-font-size',
  '--tf-sort-order-font-size',
  '--tf-filter-input-width',
  '--tf-filter-font-size',
  '--tf-filter-padding',
  '--tf-disabled-opacity',
]);

const usages = new Map<string, string[]>();
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  // `var(--tf-x)` in CSS, and `'--tf-x'` where a module reads one at runtime
  // through getComputedStyle — the flash colours arrive that way.
  for (const match of source.matchAll(/var\((--tf-[a-z0-9-]+)|'(--tf-[a-z0-9-]+)'/g)) {
    const property = (match[1] ?? match[2])!;
    usages.set(property, [...(usages.get(property) ?? []), file]);
  }
}

describe('theme coverage', () => {
  it('reads only properties that are declared tokens or explicitly internal', () => {
    const undeclared = [...usages.keys()].filter(
      (property) =>
        !declaredProperties.has(property) && !INTERNAL.has(property) && !OPTIONAL.has(property),
    );

    expect(undeclared, `undeclared custom properties: ${undeclared.join(', ')}`).toEqual([]);
  });

  it('gives every declared token a default in the stylesheet', () => {
    // Otherwise a token would exist on the type but have nothing to override.
    const stylesheet = readFileSync(join(SRC, 'themes/tradeflow.css'), 'utf8');
    const missing = THEME_TOKENS.map(customPropertyFor).filter(
      (property) => !stylesheet.includes(`${property}:`),
    );

    expect(missing, `tokens absent from the stylesheet: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no inline style attributes with literal declarations in components', () => {
    // styleMap is allowed — it is how dynamic geometry reaches CSS. A literal
    // `style="color: red"` is not.
    const offenders: string[] = [];

    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/style="[^"]*:[^"]*"/g)) {
        // The doc comment on CellRendererElement shows consumer code, not ours.
        const line = source.slice(0, match.index).split('\n').length;
        const context = source.split('\n')[line - 1] ?? '';
        if (context.trimStart().startsWith('*')) continue;
        offenders.push(`${file}:${line} ${match[0].slice(0, 60)}`);
      }
    }

    expect(offenders, `inline styles found:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('exposes every token the components actually read', () => {
    // The converse of the first test: a declared token nothing reads is dead
    // weight in the public type.
    const unread = THEME_TOKENS.map(customPropertyFor).filter((property) => !usages.has(property));

    expect(unread, `declared but never read: ${unread.join(', ')}`).toEqual([]);
  });
});
