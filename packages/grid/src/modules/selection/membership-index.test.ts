import { describe, expect, it, vi } from 'vite-plus/test';
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

  /**
   * Counts how many times something walks the projection.
   *
   * A scan and an index are told apart by how often the list is traversed, not
   * by how long the traversal takes. This used to be timed — fifty thousand
   * rows against a thousand, with a factor-of-eight allowance — which made the
   * result depend on what else the machine was doing and flaked under a loaded
   * test run.
   */
  const counting = (projection: readonly DisplayRow[]) => {
    let passes = 0;
    const watched = new Proxy(projection, {
      get(target, property, receiver) {
        if (property === Symbol.iterator) passes += 1;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    return { watched, passes: () => passes };
  };

  it('walks the rows once, however many lookups follow', () => {
    const { watched, passes } = counting(rows(50_000));
    const membership = new FlatMembership(
      () => watched,
      () => true,
    );

    membership.leavesOf('r0');
    const afterFirst = passes();
    for (let i = 0; i < 500; i += 1) membership.leavesOf(`r${i}`);

    // The index is paid for once and answers everything after it.
    expect(afterFirst).toBe(1);
    expect(passes()).toBe(afterFirst);
  });

  it('walks it once again when the projection is replaced, and only then', () => {
    // The cache is keyed on the array's identity, so a new projection has to
    // rebuild and an unchanged one must not — a tick produces the same array.
    const first = counting(rows(100));
    const second = counting(rows(100));
    let current: readonly DisplayRow[] = first.watched;
    const membership = new FlatMembership(
      () => current,
      () => true,
    );

    membership.leavesOf('r0');
    membership.leavesOf('r1');
    expect(first.passes()).toBe(1);

    current = second.watched;
    membership.leavesOf('r0');
    membership.leavesOf('r1');

    expect(second.passes()).toBe(1);
    expect(first.passes()).toBe(1);
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
