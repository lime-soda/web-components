import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { THEME_TOKENS, customPropertyFor } from './tokens.js';

/**
 * Keeps the theme schema honest against the source.
 *
 * A token list is only a contract if nothing can read a property that is not on
 * it. These tests walk the actual source, so adding `var(--grid-something-new)` to
 * a component without declaring the token fails here rather than quietly
 * producing an unthemeable value.
 */

const SRC = join(import.meta.dirname, '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out);
    } else if (/\.(ts|css)$/.test(entry) && !entry.endsWith('.test.ts')) {
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
  '--grid-instance-width',
  '--grid-instance-height',
  '--grid-spacer-height',
  '--grid-column-template',
  '--grid-tree-depth',
  // Height of the pinned group band, so it can be lifted out of the flow.
  '--grid-sticky-height',
  // Body scroll offset and scrollbar width, so the static header can follow the
  // body sideways and reserve the gutter it occupies.
  '--grid-scroll-left',
  '--grid-scrollbar-width',
]);

/** Sub-token knobs a consumer may set but which are not part of the core schema. */
const OPTIONAL = new Set([
  '--grid-tree-expander-size',
  '--grid-tree-expander-font-size',
  '--grid-sort-indicator-font-size',
  '--grid-sort-order-font-size',
  '--grid-filter-input-width',
  '--grid-filter-font-size',
  '--grid-filter-padding',
  '--grid-disabled-opacity',
  // Border of an instance. Read when sizing the slot, so the columns inside
  // fit the content box rather than being clipped by it.
  '--grid-instance-border-width',
]);

const usages = new Map<string, string[]>();
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  // `var(--grid-x)` in CSS, and `'--grid-x'` where a module reads one at runtime
  // through getComputedStyle — the flash colours arrive that way.
  for (const match of source.matchAll(/var\((--grid-[a-z0-9-]+)|'(--grid-[a-z0-9-]+)'/g)) {
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

  it('declares every token in the design system, and nothing else', () => {
    // The defaults are design tokens, not a stylesheet in this package: Style
    // Dictionary turns components/grid.json into the `props` block the host
    // adopts. This is the seam between the two, and it goes wrong in both
    // directions — a token on the type with no design token behind it has
    // nothing to override, and a design token nothing reads is dead weight in
    // a published stylesheet.
    const definitions = JSON.parse(
      readFileSync(join(SRC, '../../../support/tokens/components/grid.json'), 'utf8'),
    ) as { grid: Record<string, unknown> };
    const declared = Object.keys(definitions.grid).filter((key) => !key.startsWith('$'));

    expect([...declared].sort()).toEqual([...THEME_TOKENS].sort());
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
