import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { CELL_PARTS, HEADER_CELL_PARTS, INSTANCE_PARTS } from './part-forwarding.js';

/**
 * Every part that can be reached is documented, and everything documented exists.
 *
 * `::part()` is the supported way to restyle structure, and the manifest is what
 * the MCP server and editor integrations read — so a part that works but is
 * undocumented is one nobody finds. The analyser only reports what a `@csspart`
 * tag tells it, and there is nothing to stop the two drifting apart.
 *
 * Asserted against the source rather than against `custom-elements.json`,
 * because that file is a build artefact and these have to pass on a clean
 * checkout.
 */

const COMPONENTS = join(import.meta.dirname);
const MODULES = join(import.meta.dirname, '..', 'modules');

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

const read = (paths: string[]) => paths.map((path) => readFileSync(path, 'utf8')).join('\n');

const componentSource = read(sources(COMPONENTS));
const allSource = componentSource + read(sources(MODULES));

/** Part names any element actually puts in its markup. */
const rendered = new Set([...allSource.matchAll(/part="([a-z-]+)"/g)].map((match) => match[1]!));

/** Part names documented anywhere with a `@csspart` tag. */
const documented = new Set(
  [...componentSource.matchAll(/@csspart\s+([a-z-]+)/g)].map((match) => match[1]!),
);

/** Everything the forwarding chain carries to the host. */
const forwarded = new Set([...INSTANCE_PARTS, ...CELL_PARTS, ...HEADER_CELL_PARTS]);

describe('part documentation', () => {
  it('documents every part the markup renders', () => {
    const missing = [...rendered].filter((part) => !documented.has(part)).sort();

    expect(missing, `rendered but undocumented: ${missing.join(', ')}`).toEqual([]);
  });

  it('documents every part the chain forwards', () => {
    // Forwarding a part is what makes it reachable, so anything in the chain is
    // public whether or not someone remembered to describe it.
    const missing = [...forwarded].filter((part) => !documented.has(part)).sort();

    expect(missing, `forwarded but undocumented: ${missing.join(', ')}`).toEqual([]);
  });

  it('documents nothing that does not exist', () => {
    // The other direction: a renamed part leaves a tag describing something a
    // consumer can never select.
    const phantom = [...documented].filter((part) => !rendered.has(part)).sort();

    expect(phantom, `documented but never rendered: ${phantom.join(', ')}`).toEqual([]);
  });

  it('gathers the child elements’ parts onto the host', () => {
    // A consumer writes `ls-grid::part(cell)`, never
    // `ls-grid-row::part(cell)` — the host is where they look, so the host is
    // where the whole set has to be listed.
    const host = readFileSync(join(COMPONENTS, 'grid.ts'), 'utf8');
    const onHost = new Set([...host.matchAll(/@csspart\s+([a-z-]+)/g)].map((match) => match[1]!));

    const missing = [...forwarded].filter((part) => !onHost.has(part)).sort();

    expect(missing, `forwarded but not listed on ls-grid: ${missing.join(', ')}`).toEqual([]);
  });
});
