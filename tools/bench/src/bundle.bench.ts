import { gzipSync } from 'node:zlib';
import { mkdtempSync, rmSync, symlinkSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

/**
 * Bundle composition, asserted rather than assumed.
 *
 * Two questions, both of which have been answered wrongly before:
 *
 *  - Does importing the package register its custom elements? A blanket
 *    `sideEffects: false` let bundlers drop the entry outright, so every element
 *    went undefined and `<ls-grid>` rendered nothing at all.
 *  - Does an unused module stay out of the bundle? That is the whole point of
 *    shipping features as separate entry points.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const PACKAGE = resolve(REPO, 'packages/grid');

/** Distinctive strings, each present only if that module was included. */
const MARKERS = {
  tree: 'ls-grid-expander',
  sort: 'ls-grid-sort-indicator',
  filter: 'ls-grid-filter-input',
  selection: 'ls-grid-selection-checkbox',
  // Module ids: string literals, so minification cannot rename them.
  'selection/tree': 'selection-tree',
  'selection/row-range': 'selection-row-range',
  // A page key, not an arrow: arrows are core now, so only the optional half of
  // the ARIA pattern still identifies this module.
  keyboard: 'PageDown',
  'cell-flash': 'getDirection',
  clipboard: 'toDelimitedText',
  columns: 'ls-grid-resize-handle',
  edit: 'ls-grid-text-editor',
  // A class the module writes on cells in the rectangle. String literals, so
  // minification cannot rename them.
  range: 'ls-grid-in-range',
} as const;

type ModuleName = keyof typeof MARKERS;

const ENTRIES: Record<ModuleName, string> = {
  tree: 'TreeModule',
  sort: 'SortModule',
  filter: 'FilterModule',
  selection: 'SelectionModule',
  'selection/tree': 'TreeSelectionModule',
  'selection/row-range': 'RowRangeModule',
  keyboard: 'KeyboardModule',
  'cell-flash': 'CellFlashModule',
  clipboard: 'ClipboardModule',
  columns: 'ColumnsModule',
  edit: 'EditModule',
  range: 'RangeModule',
};

let sandbox: string;

/** Bundles an app importing core plus the named modules, and returns the output. */
function bundle(modules: readonly ModuleName[]): string {
  const imports = modules
    .map((name) => `import { ${ENTRIES[name]} } from '@lime-soda/grid/${name}';`)
    .join('\n');
  const uses = modules.map((name) => `new ${ENTRIES[name]}({ getParentId: () => null })`).join(',');

  // Subpath names contain '/', which is not a filename.
  const slug = modules.join('-').replaceAll('/', '_') || 'core';
  const entry = join(sandbox, `app-${slug}.js`);
  writeFileSync(
    entry,
    `import '@lime-soda/grid/layouts';
${imports}
const grid = document.createElement('ls-grid');
grid.gridOptions = { columns: [{ field: 'a' }], modules: [${uses}] };
document.body.append(grid);
`,
  );

  const result = buildSync({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    logLevel: 'error',
    absWorkingDir: sandbox,
  });
  return result.outputFiles[0]!.text;
}

const bytes = (code: string) => Buffer.byteLength(code, 'utf8');
/** Minified and gzipped — what actually crosses the wire. */
const wire = (code: string) => gzipSync(Buffer.from(code, 'utf8')).byteLength;
const kb = (n: number) => `${(n / 1024).toFixed(1)}kB`;
const report = (label: string, code: string, baseline?: string) => {
  const delta = baseline === undefined ? '' : `  (+${kb(wire(code) - wire(baseline))} gz)`;
  // eslint-disable-next-line no-console -- the measurement is the point
  console.log(
    `${label.padEnd(30)}${kb(bytes(code)).padStart(8)}  ${kb(wire(code)).padStart(8)} gz${delta}`,
  );
};

beforeAll(() => {
  // A sandbox that resolves the grid the way a consumer would, through
  // the package's own exports map rather than the workspace's source paths.
  sandbox = mkdtempSync(join(tmpdir(), 'ls-grid-bundle-'));
  mkdirSync(join(sandbox, 'node_modules', '@lime-soda'), { recursive: true });
  symlinkSync(PACKAGE, join(sandbox, 'node_modules', '@lime-soda', 'grid'));
  symlinkSync(join(REPO, 'node_modules', 'lit'), join(sandbox, 'node_modules', 'lit'));
  symlinkSync(join(REPO, 'node_modules', '.pnpm'), join(sandbox, 'node_modules', '.pnpm'));
}, 60_000);

afterAll(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

describe('bundle composition', () => {
  it('registers the elements through the define entry', () => {
    const code = bundle([]);

    expect(code).toContain('ls-grid');
    expect(code).toContain('customElements');
    expect(code.length).toBeGreaterThan(10_000);
  });

  it('registers nothing when only the classes are imported', () => {
    // Importing a class gives you the class. Registration is a separate,
    // explicit act, so a consumer can subclass, test or substitute an element
    // without one appearing in the registry as a side effect.
    const entry = join(sandbox, 'classes-only.js');
    writeFileSync(
      entry,
      `import { Grid } from '@lime-soda/grid';
console.log(Grid.name);
`,
    );
    const { outputFiles } = buildSync({
      entryPoints: [entry],
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
      logLevel: 'error',
      absWorkingDir: sandbox,
    });

    expect(outputFiles[0]!.text).not.toContain('customElements.define');
  });

  it('leaves every module out when none is imported', () => {
    const code = bundle([]);

    for (const [name, marker] of Object.entries(MARKERS)) {
      expect(code, `${name} leaked into a core-only bundle`).not.toContain(marker);
    }

    report('core only', code);
  });

  it('includes only the module that was imported', () => {
    const core = bundle([]);

    for (const name of Object.keys(MARKERS) as ModuleName[]) {
      const code = bundle([name]);
      expect(code, `${name} was imported but is absent`).toContain(MARKERS[name]);

      for (const other of Object.keys(MARKERS) as ModuleName[]) {
        if (other === name) continue;
        expect(code, `importing ${name} pulled in ${other}`).not.toContain(MARKERS[other]);
      }

      report(`core + ${name}`, code, core);
    }
  });

  it('costs no more than the sum of its parts when everything is imported', () => {
    const names = Object.keys(MARKERS) as ModuleName[];
    const core = bundle([]);
    const all = bundle(names);
    const individually = names.reduce(
      (total, name) => total + (bytes(bundle([name])) - bytes(core)),
      0,
    );

    report('core + all six modules', all, core);

    // Shared code counted once, so the whole is at most the sum.
    expect(bytes(all) - bytes(core)).toBeLessThanOrEqual(individually + 1024);
  });

  it('leaves the stack engine out of a flow-only bundle', () => {
    // The entry point decides which engines a bundle contains. The grid
    // element's own stack chrome — its `.stack-*` rules and `renderStack`
    // branches — is a branch inside a class and stays either way; excluding
    // that would mean splitting the element itself.
    const build = (entryPoint: string, name: string): string => {
      const entry = join(sandbox, `${name}.js`);
      writeFileSync(
        entry,
        `import '@lime-soda/grid/${entryPoint}';
const grid = document.createElement('ls-grid');
grid.gridOptions = { columns: [{ field: 'a' }] };
document.body.append(grid);
`,
      );
      return buildSync({
        entryPoints: [entry],
        bundle: true,
        minify: true,
        format: 'esm',
        write: false,
        logLevel: 'error',
        absWorkingDir: sandbox,
      }).outputFiles[0]!.text;
    };

    const both = build('layouts', 'both-layouts');
    const flowOnly = build('flow', 'flow-only');

    report('both layouts', both);
    report('flow only', flowOnly, both);

    expect(bytes(flowOnly), 'the flow-only entry saved nothing').toBeLessThan(bytes(both));
  });

  it('keeps core within its budget', () => {
    // Generous: this catches a dependency accidentally pulled into core, not a
    // few hundred bytes of drift.
    const core = bytes(bundle([]));

    expect(core).toBeLessThan(140 * 1024);
  });
});
