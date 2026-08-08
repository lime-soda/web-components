import { gzipSync } from 'node:zlib';
import { mkdtempSync, rmSync, symlinkSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

/**
 * What a design-system component costs a consumer.
 *
 * A component that grows a kilobyte at a time is the kind of regression nobody
 * notices in review. These are budgets, not measurements: the numbers have
 * headroom, and the point is that crossing them is deliberate.
 *
 * Measured through the package's own `exports` map, from a sandbox that
 * resolves it the way an application would — not through the workspace's source
 * paths, which would measure something no consumer ever downloads.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');

/** Wire size budgets in bytes: minified and gzipped, as it crosses the network. */
const BUDGETS = {
  // The button plus its design tokens. Lit is external: an application pays for
  // it once, no matter how many components it uses.
  button: 3 * 1024,
} as const;

let sandbox: string;

const link = (from: string, to: string): void =>
  symlinkSync(from, join(sandbox, 'node_modules', to));

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'ls-component-bundle-'));
  mkdirSync(join(sandbox, 'node_modules', '@lime-soda'), { recursive: true });
  link(resolve(REPO, 'packages/button'), '@lime-soda/button');
  link(resolve(REPO, 'support/tokens'), '@lime-soda/tokens');
  link(join(REPO, 'node_modules', 'lit'), 'lit');
  link(join(REPO, 'node_modules', '.pnpm'), '.pnpm');
}, 60_000);

afterAll(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

/** Bundles an app that imports the package, and returns the output. */
function bundle(specifier: string, name: string, external: readonly string[] = ['lit']): string {
  const entry = join(sandbox, `${name}.js`);
  writeFileSync(entry, `import '${specifier}';\n`);

  const result = buildSync({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    logLevel: 'error',
    absWorkingDir: sandbox,
    external: [...external],
  });
  return result.outputFiles[0]!.text;
}

const wire = (code: string) => gzipSync(Buffer.from(code, 'utf8')).byteLength;
const kb = (n: number) => `${(n / 1024).toFixed(1)}kB`;

describe('component bundles', () => {
  it('keeps the button within its budget', () => {
    const code = bundle('@lime-soda/button', 'button');
    const size = wire(code);

    // eslint-disable-next-line no-console -- the measurement is the point
    console.log(`${'button'.padEnd(30)}${kb(size).padStart(8)} gz`);

    expect(
      size,
      `button is ${kb(size)} gzipped, over its ${kb(BUDGETS.button)} budget`,
    ).toBeLessThan(BUDGETS.button);
  });

  it('registers the element when imported', () => {
    // The published entry is meant to be the batteries-included one: importing
    // it gives you a working `<ls-button>`. A `sideEffects: false` or a tree
    // shake that dropped the registration would leave the element undefined.
    // The tag name is the marker: `customElements.define` itself lives in Lit's
    // decorator, which is external here.
    const code = bundle('@lime-soda/button', 'button-registration');

    expect(code).toContain('ls-button');
  });

  it('leaves lit for the application to provide', () => {
    // Lit is a peer dependency. Bundling a copy into the component would give an
    // application two runtimes, and two component registries with it.
    const code = bundle('@lime-soda/button', 'button-peer', []);
    const withExternalLit = bundle('@lime-soda/button', 'button-external');

    expect(code.length).toBeGreaterThan(withExternalLit.length);
  });
});
