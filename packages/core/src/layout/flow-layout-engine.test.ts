import { describe, expect, it } from 'vitest';
import { FlowLayoutEngine } from './flow-layout-engine.js';
import type { DisplayRow, ViewportMetrics } from './types.js';

/** Viewport fitting exactly 10 rows: (360 - 40) / 32 = 10. */
const viewport = (overrides: Partial<ViewportMetrics> = {}): ViewportMetrics => ({
  width: 1000,
  height: 360,
  rowHeight: 32,
  headerHeight: 40,
  instanceWidth: 500,
  instanceGap: 16,
  ...overrides,
});

const rows = (count: number, prefix = 'r'): DisplayRow[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, rowId: `${prefix}${i}` }));

const ids = (result: { instances: readonly { rows: readonly DisplayRow[] }[] }): string[][] =>
  result.instances.map((instance) => instance.rows.map((row) => row.id));

describe('FlowLayoutEngine', () => {
  const engine = new FlowLayoutEngine();

  describe('capacity', () => {
    it('fills each instance to floor((height - headerHeight) / rowHeight) rows', () => {
      const result = engine.layout(rows(25), viewport());

      expect(ids(result)).toEqual([
        rows(10).map((r) => r.id),
        rows(25)
          .slice(10, 20)
          .map((r) => r.id),
        rows(25)
          .slice(20)
          .map((r) => r.id),
      ]);
    });

    it('produces a single partially filled instance when rows do not fill it', () => {
      const result = engine.layout(rows(3), viewport());

      expect(result.instances).toHaveLength(1);
      expect(result.instances[0]!.rows).toHaveLength(3);
    });

    it('produces no instances for no rows', () => {
      const result = engine.layout([], viewport());

      expect(result.instances).toEqual([]);
      expect(result.totalWidth).toBe(0);
    });

    it('respects per-row heights instead of assuming a uniform row height', () => {
      // 320px usable: a 200px row plus two 32px rows fills 264; the next 200px row breaks.
      const mixed: DisplayRow[] = [
        { id: 'tall', rowId: 'tall', height: 200 },
        { id: 'a', rowId: 'a' },
        { id: 'b', rowId: 'b' },
        { id: 'tall2', rowId: 'tall2', height: 200 },
      ];

      expect(ids(engine.layout(mixed, viewport()))).toEqual([['tall', 'a', 'b'], ['tall2']]);
    });

    it('gives a row taller than the viewport its own instance rather than looping forever', () => {
      const oversized: DisplayRow[] = [
        { id: 'huge', rowId: 'huge', height: 10_000 },
        { id: 'after', rowId: 'after' },
      ];

      expect(ids(engine.layout(oversized, viewport()))).toEqual([['huge'], ['after']]);
    });

    it('always fits at least one row even when the viewport is shorter than a row', () => {
      const result = engine.layout(rows(3), viewport({ height: 41 }));

      expect(ids(result)).toEqual([['r0'], ['r1'], ['r2']]);
    });
  });

  describe('repeatOnBreak', () => {
    // A parent with 12 children: the block cannot fit in one 10-row instance, so
    // the parent has to reappear atop the continuation. This is the behaviour
    // layouts.md specifies and the whole reason the seam exists.
    const parent: DisplayRow = { id: 'p', rowId: 'p', meta: { depth: 0 } };
    const children: DisplayRow[] = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      rowId: `c${i}`,
      repeatOnBreak: [parent],
      meta: { depth: 1 },
    }));

    it('re-emits ancestors at the top of the continuation instance', () => {
      const result = engine.layout([parent, ...children], viewport());

      // Compared by rowId: the repeated `p` deliberately carries a different DOM key.
      expect(result.instances.map((i) => i.rows.map((r) => r.rowId))).toEqual([
        ['p', 'c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'],
        ['p', 'c9', 'c10', 'c11'],
      ]);
    });

    it('marks repeated rows so renderers can tell a repeat from the original', () => {
      const result = engine.layout([parent, ...children], viewport());
      const repeated = result.instances[1]!.rows[0]!;

      expect(repeated.rowId).toBe('p');
      expect(repeated.meta?.['isRepeat']).toBe(true);
      // Shares rowId with the original, so both copies read the same row signal.
      expect(result.instances[0]!.rows[0]!.rowId).toBe(repeated.rowId);
      // ...but carries a distinct DOM key.
      expect(repeated.id).not.toBe(result.instances[0]!.rows[0]!.id);
    });

    it('does not prepend repeats to the first instance', () => {
      const result = engine.layout(children, viewport());

      expect(result.instances[0]!.rows[0]!.id).toBe('c0');
    });

    it('re-emits a multi-level ancestor chain in root-to-leaf order', () => {
      const group: DisplayRow = { id: 'g', rowId: 'g' };
      const instrument: DisplayRow = { id: 'i', rowId: 'i' };
      const orders: DisplayRow[] = Array.from({ length: 12 }, (_, i) => ({
        id: `o${i}`,
        rowId: `o${i}`,
        repeatOnBreak: [group, instrument],
      }));

      const result = engine.layout([group, instrument, ...orders], viewport());

      expect(result.instances[1]!.rows.slice(0, 2).map((r) => r.rowId)).toEqual(['g', 'i']);
    });

    it('truncates an ancestor chain that cannot fit, keeping the nearest ancestors', () => {
      // 10 ancestors + the row itself cannot fit in a 10-row instance. Keeping the
      // deepest ancestors preserves the most useful context.
      const ancestors: DisplayRow[] = Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        rowId: `a${i}`,
      }));
      const leaves: DisplayRow[] = Array.from({ length: 12 }, (_, i) => ({
        id: `l${i}`,
        rowId: `l${i}`,
        repeatOnBreak: ancestors,
      }));

      const result = engine.layout(leaves, viewport());

      // Instance 0 holds l0..l9 with no repeats; l10 triggers the first break.
      const continuation = result.instances[1]!;
      expect(continuation.rows).toHaveLength(10);
      expect(continuation.rows.slice(0, 9).map((r) => r.rowId)).toEqual([
        'a1',
        'a2',
        'a3',
        'a4',
        'a5',
        'a6',
        'a7',
        'a8',
        'a9',
      ]);
      expect(continuation.rows[9]!.rowId).toBe('l10');
    });
  });

  describe('geometry', () => {
    it('positions instances by width plus gap and reports the total scroll width', () => {
      const result = engine.layout(rows(25), viewport());

      expect(result.instances.map((i) => i.offset)).toEqual([0, 516, 1032]);
      // Three instances and two gaps, with no trailing gap.
      expect(result.totalWidth).toBe(500 * 3 + 16 * 2);
      expect(result.totalHeight).toBe(360);
    });

    it('assigns stable index-derived ids', () => {
      const result = engine.layout(rows(25), viewport());

      expect(result.instances.map((i) => i.id)).toEqual(['instance-0', 'instance-1', 'instance-2']);
      expect(result.instances.map((i) => i.index)).toEqual([0, 1, 2]);
    });
  });

  describe('maxInstances', () => {
    it('stops at the cap and reports truncation', () => {
      const result = engine.layout(rows(100), viewport({ maxInstances: 2 }));

      expect(result.instances).toHaveLength(2);
      expect(result.truncated).toBe(true);
    });

    it('does not report truncation when everything fits', () => {
      expect(engine.layout(rows(5), viewport({ maxInstances: 2 })).truncated).toBe(false);
    });
  });

  it('is a pure function of its arguments', () => {
    const input = rows(25);
    const snapshot = structuredClone(input);
    const metrics = viewport();

    const first = engine.layout(input, metrics);
    const second = engine.layout(input, metrics);

    expect(input).toEqual(snapshot);
    expect(ids(first)).toEqual(ids(second));
  });
});
