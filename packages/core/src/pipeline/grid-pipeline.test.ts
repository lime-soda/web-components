import { describe, expect, it, vi } from 'vitest';
import type { LayoutEngine, ViewportMetrics } from '../layout/types.js';
import { FlowLayoutEngine } from '../layout/flow-layout-engine.js';
import { GridPipeline } from './grid-pipeline.js';

interface Quote {
  id: string;
  instrument: string;
  price: number;
}

/** Fits 10 rows per instance. */
const viewport: ViewportMetrics = {
  width: 1000,
  height: 360,
  rowHeight: 32,
  headerHeight: 40,
  instanceWidth: 500,
  instanceGap: 16,
};

const quotes = (count: number): Quote[] =>
  Array.from({ length: count }, (_, i) => ({ id: `q${i}`, instrument: `INS${i}`, price: 100 + i }));

/** Wraps a real engine so layout invocations can be counted. */
const spyEngine = (): LayoutEngine & { calls: number } => {
  const inner = new FlowLayoutEngine();
  const engine = {
    id: 'flow',
    calls: 0,
    layout(rows: Parameters<LayoutEngine['layout']>[0], metrics: ViewportMetrics) {
      engine.calls += 1;
      return inner.layout(rows, metrics);
    },
  };
  return engine;
};

const setup = (rowCount: number) => {
  const engine = spyEngine();
  const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id, engine, viewport });
  pipeline.store.setRowData(quotes(rowCount));
  return { pipeline, engine };
};

describe('GridPipeline', () => {
  it('lays 25 rows into three instances with no modules registered', () => {
    const { pipeline } = setup(25);

    const result = pipeline.layout.get();

    expect(result.instances.map((i) => i.rows.length)).toEqual([10, 10, 5]);
  });

  describe('a value tick', () => {
    // These four assertions together are the reason the package is shaped this
    // way. On a live desk almost all traffic is value ticks; if any of them
    // reached the projection or the layout, the grid would rebuild its entire
    // structure tens of times a second.
    it('does not re-run the layout engine', () => {
      const { pipeline, engine } = setup(25);
      pipeline.layout.get();
      const before = engine.calls;

      pipeline.store.applyTransaction({
        update: [{ id: 'q0', instrument: 'INS0', price: 999 }],
      });
      pipeline.store.flushSync();
      pipeline.layout.get();

      expect(engine.calls).toBe(before);
    });

    it('does not re-run projection stages', () => {
      const { pipeline } = setup(25);
      const run = vi.fn((rows) => rows);
      pipeline.addStage({ id: 'noop', phase: 'decorate', run });
      pipeline.layout.get();
      const before = run.mock.calls.length;

      pipeline.store.applyTransaction({
        update: [{ id: 'q0', instrument: 'INS0', price: 999 }],
      });
      pipeline.store.flushSync();
      pipeline.layout.get();

      expect(run.mock.calls.length).toBe(before);
    });

    it('keeps the layout result identity stable, so nothing downstream re-renders', () => {
      const { pipeline } = setup(25);
      const before = pipeline.layout.get();

      pipeline.store.applyTransaction({
        update: [{ id: 'q0', instrument: 'INS0', price: 999 }],
      });
      pipeline.store.flushSync();

      expect(pipeline.layout.get()).toBe(before);
    });

    it('still reaches the row signal, so the affected cells do re-render', () => {
      const { pipeline } = setup(25);
      const rowSignal = pipeline.store.rowSignal('q0');

      pipeline.store.applyTransaction({
        update: [{ id: 'q0', instrument: 'INS0', price: 999 }],
      });

      expect(rowSignal.get()?.data.price).toBe(999);
    });
  });

  describe('a structural change', () => {
    it('re-runs the layout', () => {
      const { pipeline, engine } = setup(25);
      pipeline.layout.get();
      const before = engine.calls;

      pipeline.store.applyTransaction({ add: [{ id: 'new', instrument: 'NEW', price: 1 }] });
      pipeline.layout.get();

      expect(engine.calls).toBeGreaterThan(before);
    });

    it('reflows rows across instances', () => {
      const { pipeline } = setup(20);
      expect(pipeline.layout.get().instances).toHaveLength(2);

      pipeline.store.applyTransaction({ add: [{ id: 'extra', instrument: 'X', price: 1 }] });

      expect(pipeline.layout.get().instances).toHaveLength(3);
    });
  });

  describe('viewport changes', () => {
    it('re-lays out when the container is resized', () => {
      const { pipeline } = setup(25);
      expect(pipeline.layout.get().instances).toHaveLength(3);

      // Twice as tall: 20 rows per instance instead of 10.
      pipeline.setViewport({ ...viewport, height: 680 });

      expect(pipeline.layout.get().instances).toHaveLength(2);
    });

    it('does not re-run the engine when the viewport is set to an equal object', () => {
      const { pipeline, engine } = setup(25);
      pipeline.layout.get();
      const before = engine.calls;

      pipeline.setViewport(pipeline.viewport);
      pipeline.layout.get();

      expect(engine.calls).toBe(before);
    });
  });

  it('re-lays out when a module invalidates its config', () => {
    const { pipeline, engine } = setup(25);
    pipeline.addStage({ id: 'noop', phase: 'sort', run: (rows) => rows });
    pipeline.layout.get();
    const before = engine.calls;

    pipeline.projector.invalidate();
    pipeline.layout.get();

    expect(engine.calls).toBeGreaterThan(before);
  });

  it('routes a filter stage through to the layout', () => {
    const { pipeline } = setup(25);

    pipeline.addStage({
      id: 'filter',
      phase: 'filter',
      run: (rows, ctx) => rows.filter((r) => ctx.store.getRow(r.rowId)!.price % 2 === 0),
    });

    const result = pipeline.layout.get();
    expect(result.instances.flatMap((i) => i.rows)).toHaveLength(13);
  });
});
