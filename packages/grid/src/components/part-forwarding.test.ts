import { describe, expect, it } from 'vite-plus/test';
import { CELL_PARTS, INSTANCE_PARTS, NONE, ROW_PARTS, forwardedParts } from './part-forwarding.js';

/**
 * The `exportparts` value is computed per row, per cell and per header cell on
 * every render, and changes only when the module set does. These pin the cache
 * by identity rather than by value: a correct-but-rebuilt string would pass an
 * equality check and still allocate on every tick, which is the thing worth
 * preventing.
 */

describe('forwardedParts', () => {
  it('returns the same string, not merely an equal one', () => {
    const moduleParts: readonly string[] = ['tree-expander'];

    const first = forwardedParts(CELL_PARTS, moduleParts);
    const second = forwardedParts(CELL_PARTS, moduleParts);

    expect(second).toBe(first);
  });

  it('recomputes when the module set changes', () => {
    const before = forwardedParts(ROW_PARTS, ['sort-indicator']);
    const after = forwardedParts(ROW_PARTS, ['sort-indicator', 'filter-input']);

    expect(after).not.toBe(before);
    expect(after).toContain('filter-input');
  });

  it('caches each level separately', () => {
    const moduleParts: readonly string[] = ['selection-checkbox'];

    expect(forwardedParts(CELL_PARTS, moduleParts)).not.toBe(
      forwardedParts(INSTANCE_PARTS, moduleParts),
    );
    expect(forwardedParts(CELL_PARTS, moduleParts)).toBe(forwardedParts(CELL_PARTS, moduleParts));
  });

  it('caches the no-own-parts case a renderer uses', () => {
    const moduleParts: readonly string[] = ['tree-expander'];

    expect(forwardedParts(NONE, moduleParts)).toBe(forwardedParts(NONE, moduleParts));
  });

  it('names each part once, however many levels claim it', () => {
    // ROW_PARTS already contains the cell's parts, and a module could name one
    // of them too; `exportparts` should not list anything twice.
    const value = forwardedParts(ROW_PARTS, ['cell-content', 'tree-expander']);
    const names = value.split(', ');

    expect(new Set(names).size).toBe(names.length);
  });
});
