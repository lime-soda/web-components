import { describe, expect, it, vi } from 'vitest';
import type { DisplayRow } from '../../layout/types.js';
import { FlatMembership } from './membership.js';

/**
 * Flat membership is asked what a row stands for once per rendered row, so a
 * scan inside it is a scan per row per render.
 *
 * It scanned. That was invisible at the top of a list and cost about 15ms per
 * instance at fifty thousand rows, because the rows on screen in a flow grid
 * are the ones furthest along — exactly the worst case for a linear search.
 */

const rows = (count: number): DisplayRow[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, rowId: `r${i}`, meta: {} }));

describe('flat membership lookup', () => {
  it('builds its index once for an unchanged projection', () => {
    const projection = rows(100);
    const supplier = vi.fn(() => projection);
    const membership = new FlatMembership(supplier, () => true);

    for (let i = 0; i < 50; i += 1) membership.leavesOf(`r${i}`);

    // The projection is read each time to check identity, but never re-indexed.
    expect(supplier).toHaveBeenCalledTimes(50);
    expect(membership.leavesOf('r99')).toEqual(['r99']);
  });

  it('re-indexes when the projection changes', () => {
    let projection = rows(10);
    const membership = new FlatMembership(
      () => projection,
      () => true,
    );
    expect(membership.leavesOf('r5')).toEqual(['r5']);

    projection = [{ id: 'x', rowId: 'x', meta: {} }];

    expect(membership.leavesOf('x')).toEqual(['x']);
    // r5 is gone from the projection, so it stands only for itself by name.
    expect(membership.leavesOf('r5')).toEqual(['r5']);
  });

  it('does not slow down as rows are added ahead of the one asked for', () => {
    const time = (count: number): number => {
      const projection = rows(count);
      const membership = new FlatMembership(
        () => projection,
        () => true,
      );
      const last = count - 40;
      membership.leavesOf(`r${last}`); // pay for the index once

      const start = performance.now();
      for (let pass = 0; pass < 20; pass += 1) {
        for (let i = 0; i < 40; i += 1) membership.leavesOf(`r${last + i}`);
      }
      return performance.now() - start;
    };

    const small = time(1_000);
    const large = time(50_000);

    // Fifty times the rows. A scan took ~40x longer; an index takes about the
    // same. Loose enough not to flake, tight enough to catch a scan coming back.
    expect(large).toBeLessThan(Math.max(small, 1) * 8);
  });

  it('still refuses a row the consumer excludes', () => {
    const projection = rows(5);
    const membership = new FlatMembership(
      () => projection,
      (rowId) => rowId !== 'r2',
    );

    expect(membership.leavesOf('r1')).toEqual(['r1']);
    expect(membership.leavesOf('r2')).toEqual([]);
  });
});
