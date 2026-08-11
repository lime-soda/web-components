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

/** Every package that gets published. */
const PACKAGES = [
  'packages/grid',
  'packages/button',
  'support/tokens',
  'support/mcp-server',
  'support/cem-plugin-css-properties',
] as const;

/** Where provenance expects each package to say it came from. */
const REPOSITORY = 'https://github.com/lime-soda/web-components';

/** A subpath maps either straight to a file or to a set of conditions. */
type ExportEntry = string | Record<string, string>;

interface Packed {
  manifest: {
    exports?: Record<string, ExportEntry>;
    repository?: { url?: string; directory?: string };
  };
  files: Set<string>;
}

const conditionsOf = (entry: ExportEntry): Record<string, string> =>
  typeof entry === 'string' ? { default: entry } : entry;

const escape = (segment: string): string => segment.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether the tarball holds something a target can resolve to.
 *
 * A subpath pattern stands for a set of files rather than one, so `*` has to
 * match a run of path segments. Requiring at least one hit is the useful
 * assertion: a pattern resolving to nothing at all is the same mistake as a
 * literal path that was never shipped.
 */
const shipped = (target: string, files: Set<string>): boolean => {
  const path = target.replace(/^\.\//, '');
  if (!path.includes('*')) return files.has(path);

  const pattern = new RegExp(`^${path.split('*').map(escape).join('.+')}$`);
  return [...files].some((file) => pattern.test(file));
};

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

    for (const [subpath, entry] of Object.entries(manifest.exports ?? {})) {
      for (const [condition, target] of Object.entries(conditionsOf(entry))) {
        if (!shipped(target, files)) missing.push(`${subpath} [${condition}] -> ${target}`);
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
      .filter(([, entry]) => 'development' in conditionsOf(entry))
      .map(([subpath]) => subpath);

    expect(leaked, `development leaked into: ${leaked.join(', ')}`).toEqual([]);
  });

  it.each(PACKAGES)('%s says where it came from', (pkg) => {
    // Publishing from CI signs a provenance statement naming the repository that
    // built it, and npm rejects the upload if the manifest disagrees. A missing
    // `repository` reads as "" and fails the comparison — which only surfaces at
    // the publish itself, after the version bump and tags have already landed.
    const { manifest } = packed.get(pkg)!;

    expect(manifest.repository?.url ?? '').toContain(REPOSITORY);
    // Without it npm points every package at the repository root.
    expect(manifest.repository?.directory).toBe(pkg);
  });
});
