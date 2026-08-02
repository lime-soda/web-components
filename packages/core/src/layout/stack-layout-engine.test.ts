import { describe, expect, it } from 'vite-plus/test';
import { StackLayoutEngine } from './stack-layout-engine.js';
import type { DisplayRow, ViewportMetrics } from './types.js';

/** 320px usable, 32px rows: 10 rows visible at a time. */
const viewport = (overrides: Partial<ViewportMetrics> = {}): ViewportMetrics => ({
  width: 500,
  height: 360,
  rowHeight: 32,
  headerHeight: 40,
  instanceWidth: 500,
  instanceGap: 0,
  overscan: 0,
  ...overrides,
});

const rows = (count: number): DisplayRow[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, rowId: `r${i}` }));

describe('StackLayoutEngine', () => {
  const engine = new StackLayoutEngine();

  it('produces a single instance', () => {
    expect(engine.layout(rows(100), viewport()).instances).toHaveLength(1);
  });

  it('produces no instances for no rows', () => {
    const result = engine.layout([], viewport());

    expect(result.instances).toEqual([]);
    expect(result.totalHeight).toBe(0);
  });

  it('windows to the visible rows rather than realising all of them', () => {
    // The whole point: 10,000 rows must not become 10,000 row elements.
    const result = engine.layout(rows(10_000), viewport());

    expect(result.instances[0]!.rows.length).toBeLessThan(15);
    expect(result.instances[0]!.rows[0]!.id).toBe('r0');
  });

  it('moves the window as the scroll offset advances', () => {
    const result = engine.layout(rows(1000), viewport({ scrollOffset: 3200 }));

    expect(result.instances[0]!.rows[0]!.id).toBe('r100');
  });

  it('reports the pixel offset of the first rendered row so the spacer is correct', () => {
    const result = engine.layout(rows(1000), viewport({ scrollOffset: 3200 }));

    expect(result.instances[0]!.offset).toBe(3200);
  });

  it('reports the full content height regardless of how few rows are realised', () => {
    const result = engine.layout(rows(1000), viewport());

    expect(result.totalHeight).toBe(1000 * 32 + 40);
  });

  it('renders extra rows either side when overscan is set', () => {
    const result = engine.layout(rows(1000), viewport({ scrollOffset: 3200, overscan: 3 }));

    expect(result.instances[0]!.rows[0]!.id).toBe('r97');
  });

  it('does not overscan past the start of the list', () => {
    const result = engine.layout(rows(1000), viewport({ scrollOffset: 0, overscan: 5 }));

    expect(result.instances[0]!.rows[0]!.id).toBe('r0');
  });

  it('does not overscan past the end of the list', () => {
    const result = engine.layout(rows(12), viewport({ scrollOffset: 10_000, overscan: 5 }));
    const rendered = result.instances[0]!.rows;

    expect(rendered[rendered.length - 1]!.id).toBe('r11');
  });

  it('honours per-row heights when locating the window', () => {
    const mixed: DisplayRow[] = [
      { id: 'tall', rowId: 'tall', height: 500 },
      ...rows(20).map((r) => ({ ...r, id: `x${r.id}` })),
    ];

    const result = engine.layout(mixed, viewport({ scrollOffset: 500 }));

    expect(result.instances[0]!.rows[0]!.id).toBe('xr0');
  });

  it('clamps a negative scroll offset', () => {
    const result = engine.layout(rows(50), viewport({ scrollOffset: -100 }));

    expect(result.instances[0]!.rows[0]!.id).toBe('r0');
  });
});
