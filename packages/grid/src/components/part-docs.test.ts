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

/**
 * Part names any element actually puts in its markup.
 *
 * Including the ones exposed by renaming. `exportparts="field: cell-editor"`
 * publishes `cell-editor` just as surely as writing `part="cell-editor"` does —
 * a shared component names its part for itself, and whoever puts it somewhere
 * renames it to what the grid calls that place. Counting only the literal form
 * marked both of those as documented-but-never-rendered.
 */
const rendered = new Set([
  ...[...allSource.matchAll(/\bpart="([a-z-]+)"/g)].map((match) => match[1]!),
  ...[...allSource.matchAll(/exportparts="[a-z-]+:\s*([a-z-]+)"/g)].map((match) => match[1]!),
]);

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

  it('forwards every part rendered below the host', () => {
    // A part that stops being forwarded still renders. Nothing looks wrong
    // until a consumer tries to style it and finds their rule does nothing —
    // and since the visual side of this now lives in Chromatic, where a diff
    // waits for a human, this is the check that fails a build.
    //
    // Read from the elements that own them: whatever `ls-grid-cell` marks has
    // to be in CELL_PARTS to escape its shadow root, and so on outwards.
    const partsIn = (file: string): string[] => [
      ...new Set(
        [...readFileSync(join(COMPONENTS, file), 'utf8').matchAll(/part="([a-z-]+)"/g)].map(
          (match) => match[1]!,
        ),
      ),
    ];

    const escapes: [string, string, readonly string[]][] = [
      ['cell.ts', 'CELL_PARTS', CELL_PARTS],
      ['header-cell.ts', 'HEADER_CELL_PARTS', HEADER_CELL_PARTS],
    ];

    for (const [file, name, list] of escapes) {
      // The element's own `part` attribute is put on it by its parent, so only
      // what it marks inside its own shadow root has to be forwarded.
      const missing = partsIn(file).filter((part) => !list.includes(part));
      expect(
        missing,
        `${file} renders ${missing.join(', ')} but ${name} does not carry it`,
      ).toEqual([]);
    }
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
