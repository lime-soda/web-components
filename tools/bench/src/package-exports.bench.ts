import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

/**
 * Every path a published package points at is actually inside it.
 *
 * The workspace resolves its own packages through a `development` condition
 * that points at TypeScript source, so a package importing another gets source
 * rather than a stale `dist`. Published, that condition is a trap: `src` is not
 * in `files`, and any consumer whose bundler sets `development` — which Vite
 * does in dev — resolves to a file that was never shipped and fails outright.
 *
 * `publishConfig.exports` strips it at pack time. Nothing enforces that the two
 * maps stay in step, though, and the failure is invisible from inside the
 * workspace: everything resolves locally whether or not the tarball would.
 *
 * So this packs each package for real and reads the manifest npm would publish,
 * rather than the one on disk. Slower than inspecting `package.json`, and the
 * only version that can catch a `files` list and an `exports` map disagreeing.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');

/** Everything with a public `exports` map. */
const PACKAGES = ['packages/grid', 'packages/button'] as const;

interface Packed {
  manifest: { exports?: Record<string, Record<string, string>> };
  files: Set<string>;
}

let out: string;
const packed = new Map<string, Packed>();

const pack = (pkg: string): Packed => {
  // pnpm prints the tarball path last. Reading it beats globbing the output
  // directory, which also holds the trees extracted from earlier packages.
  const printed = execFileSync('pnpm', ['pack', '--pack-destination', out], {
    cwd: join(REPO, pkg),
    encoding: 'utf8',
  });
  const tarball = printed.trim().split('\n').at(-1)!.trim();

  const dir = mkdtempSync(join(out, 'x-'));
  execFileSync('tar', ['xzf', tarball, '-C', dir]);

  const listed = execFileSync('tar', ['tzf', tarball], { encoding: 'utf8' });
  return {
    manifest: JSON.parse(readFileSync(join(dir, 'package', 'package.json'), 'utf8')),
    // Entries are `package/<path>`; strip the prefix to match the exports map.
    files: new Set(
      listed
        .split('\n')
        .filter(Boolean)
        .map((entry) => entry.replace(/^package\//, '')),
    ),
  };
};

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'ls-package-exports-'));
  for (const pkg of PACKAGES) packed.set(pkg, pack(pkg));
}, 120_000);

afterAll(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

describe('published exports', () => {
  it.each(PACKAGES)('%s ships every file its exports map points at', (pkg) => {
    const { manifest, files } = packed.get(pkg)!;
    const missing: string[] = [];

    for (const [subpath, conditions] of Object.entries(manifest.exports ?? {})) {
      for (const [condition, target] of Object.entries(conditions)) {
        const path = target.replace(/^\.\//, '');
        if (!files.has(path)) missing.push(`${subpath} [${condition}] -> ${target}`);
      }
    }

    expect(missing, `points outside the tarball:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it.each(PACKAGES)('%s does not publish the development condition', (pkg) => {
    // The one that bit: it resolves to TypeScript source, which is not shipped,
    // and Vite sets it in dev — so the package fails to resolve for exactly the
    // consumers most likely to try it first.
    const { manifest } = packed.get(pkg)!;

    const leaked = Object.entries(manifest.exports ?? {})
      .filter(([, conditions]) => 'development' in conditions)
      .map(([subpath]) => subpath);

    expect(leaked, `development leaked into: ${leaked.join(', ')}`).toEqual([]);
  });
});
