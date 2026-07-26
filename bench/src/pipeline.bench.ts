import { describe, expect, it } from 'vitest';
import { FlowLayoutEngine, GridPipeline, type ViewportMetrics } from '@flowgrid/core';
import { TreeModule } from '@flowgrid/core/tree';
import { SortModule } from '@flowgrid/core/sort';
import { FilterModule } from '@flowgrid/core/filter';
import { ModuleRegistry, resolveColumns } from '@flowgrid/core';
import { measure, report } from './report.js';

/**
 * Budgets from the design, asserted so a regression fails CI.
 *
 * Generous on purpose: these catch an order-of-magnitude regression — an
 * accidental O(n²), a lost memo — not a few milliseconds of noise on a shared
 * runner. The reported medians are the number to watch over time.
 */

interface Bond {
  id: string;
  parentId: string | null;
  instrument: string;
  price: number;
}

const ROWS = 10_000;
const GROUPS = 50;

const generate = (): Bond[] => {
  const rows: Bond[] = [];
  const perGroup = Math.ceil(ROWS / GROUPS);
  for (let g = 0; g < GROUPS; g += 1) {
    rows.push({ id: `g${g}`, parentId: null, instrument: `Group ${g}`, price: 0 });
    for (let i = 0; i < perGroup; i += 1) {
      rows.push({
        id: `g${g}-i${i}`,
        parentId: `g${g}`,
        instrument: `Instrument ${g}-${i}`,
        price: 100 + ((g * 7 + i * 13) % 1000) / 10,
      });
    }
  }
  return rows;
};

const viewport: ViewportMetrics = {
  width: 1920,
  height: 900,
  rowHeight: 28,
  headerHeight: 28,
  instanceWidth: 420,
  instanceGap: 16,
};

const columns = [
  { field: 'instrument', width: 260 },
  { field: 'price', width: 100 },
];

const buildGrid = () => {
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id, viewport });
  const tree = new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true });
  const sort = new SortModule<Bond>();
  const filter = new FilterModule<Bond>();
  const registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () => resolveColumns<Bond>(columns as never),
    dispatch: () => {},
  });
  registry.register(tree);
  registry.register(sort);
  registry.register(filter);
  registry.start();
  pipeline.store.setRowData(generate());
  return { pipeline, sort, filter };
};

describe('pipeline benchmarks', () => {
  it('lays out 10,000 rows within budget', () => {
    const rows = generate().map((row) => ({ id: row.id, rowId: row.id }));
    const engine = new FlowLayoutEngine();

    const result = measure(`flow layout, ${ROWS.toLocaleString()} rows`, 20, () => {
      engine.layout(rows, viewport);
    });
    report(result, 100);

    expect(result.median).toBeLessThan(100);
  });

  it('projects and lays out 10,000 tree rows within budget', () => {
    const { pipeline } = buildGrid();

    const result = measure('projection + layout, tree of 10,000', 10, () => {
      pipeline.projector.invalidate();
      pipeline.layout.get();
    });
    report(result, 100);

    expect(result.median).toBeLessThan(100);
  });

  it('toggles a sort within budget', () => {
    const { pipeline, sort } = buildGrid();
    pipeline.layout.get();
    let ascending = true;

    const result = measure('sort toggle, 10,000 rows', 10, () => {
      sort.setSortModel([{ colId: 'price', direction: ascending ? 'asc' : 'desc' }]);
      ascending = !ascending;
      pipeline.layout.get();
    });
    report(result, 50);

    expect(result.median).toBeLessThan(50);
  });

  it('applies a quick filter within budget', () => {
    const { pipeline, filter } = buildGrid();
    pipeline.layout.get();
    let toggle = true;

    const result = measure('quick filter, 10,000 rows', 10, () => {
      filter.setQuickFilter(toggle ? 'Instrument 1' : 'Instrument 2');
      toggle = !toggle;
      pipeline.layout.get();
    });
    report(result, 100);

    expect(result.median).toBeLessThan(100);
  });

  describe('value ticks', () => {
    it('applies a batch of updates within a frame', () => {
      const { pipeline } = buildGrid();
      pipeline.layout.get();
      const ids = Array.from({ length: 20 }, (_, i) => `g0-i${i}`);
      let tick = 0;

      const result = measure('20 row updates (store only)', 200, () => {
        tick += 1;
        pipeline.store.applyTransaction({
          update: ids.map((id) => ({
            id,
            parentId: 'g0',
            instrument: `Instrument 0-${id}`,
            price: 100 + (tick % 100) / 10,
          })),
        });
      });
      report(result, 16);

      expect(result.median).toBeLessThan(16);
    });

    it('does not re-run projection or layout, however many ticks arrive', () => {
      // The architectural claim, measured rather than asserted: 1,000 batches of
      // 20 updates must leave the layout object identical.
      const { pipeline } = buildGrid();
      const before = pipeline.layout.get();

      for (let batch = 0; batch < 1_000; batch += 1) {
        pipeline.store.applyTransaction({
          update: Array.from({ length: 20 }, (_, i) => ({
            id: `g0-i${i}`,
            parentId: 'g0',
            instrument: `Instrument 0-${i}`,
            price: 100 + batch / 10,
          })),
        });
      }
      pipeline.store.flushSync();

      expect(pipeline.layout.get()).toBe(before);
    });
  });
});
