import { afterEach, describe, expect, it } from 'vite-plus/test';
import 'flow-grid';
import 'flow-grid/layouts';
import type { ColumnDef, FlowGrid, GridOptions } from 'flow-grid';
import { TreeModule } from 'flow-grid/tree';
import { SortModule } from 'flow-grid/sort';
import { FilterModule } from 'flow-grid/filter';
import { SelectionModule } from 'flow-grid/selection';
import { CellFlashModule } from 'flow-grid/cell-flash';

/**
 * The benchmarks that need a real browser: sustained frame timing under a live
 * feed, and heap behaviour across virtualisation churn. Neither is meaningful in
 * node, and neither is measurable in jsdom.
 */

interface Bond {
  id: string;
  parentId: string | null;
  instrument: string;
  bid: number;
  price: number;
  ask: number;
}

const ROWS = 5_000;
const GROUPS = 25;
/** Shorter than the 60s the design names, so CI stays usable. */
const TICK_SECONDS = 4;
const UPDATES_PER_FRAME = 20;

const columns: ColumnDef<Bond>[] = [
  { field: 'instrument', width: 260 },
  { field: 'bid', width: 100, valueFormatter: ({ value }) => (value as number).toFixed(2) },
  { field: 'price', width: 100, valueFormatter: ({ value }) => (value as number).toFixed(3) },
  { field: 'ask', width: 100, valueFormatter: ({ value }) => (value as number).toFixed(2) },
];

const generate = (): Bond[] => {
  const rows: Bond[] = [];
  const perGroup = Math.ceil(ROWS / GROUPS);
  for (let g = 0; g < GROUPS; g += 1) {
    rows.push({ id: `g${g}`, parentId: null, instrument: `Group ${g}`, bid: 0, price: 0, ask: 0 });
    for (let i = 0; i < perGroup; i += 1) {
      rows.push({
        id: `g${g}-i${i}`,
        parentId: `g${g}`,
        instrument: `Instrument ${g}-${i}`,
        bid: 1000 + i,
        price: 100 + (i % 100) / 10,
        ask: 1000 + i,
      });
    }
  }
  return rows;
};

let host: HTMLDivElement | undefined;

async function mount(): Promise<{ grid: FlowGrid<Bond>; data: Bond[] }> {
  host = document.createElement('div');
  host.style.cssText = 'width:1600px;height:800px';
  document.body.append(host);

  const data = generate();
  const grid = document.createElement('flow-grid') as FlowGrid<Bond>;
  const options: GridOptions<Bond> = {
    columns,
    rowHeight: 28,
    headerHeight: 28,
    modules: [
      new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
      new SortModule<Bond>(),
      new FilterModule<Bond>(),
      new SelectionModule<Bond>({ mode: 'multi' }),
      new CellFlashModule<Bond>(),
    ],
  };
  grid.gridOptions = options;
  grid.rowData = data;
  host.append(grid);

  await grid.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await grid.updateComplete;
  return { grid, data };
}

/** Forces collection when the browser was launched with --expose-gc. */
async function collectGarbage(): Promise<void> {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (gc) {
    gc();
    gc();
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}

const heapBytes = (): number | undefined =>
  (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('live grid benchmarks', () => {
  it(`holds frame rate under ${UPDATES_PER_FRAME} updates per frame for ${TICK_SECONDS}s`, async () => {
    const { grid, data } = await mount();
    const leaves = data.filter((row) => row.parentId !== null);

    const intervals: number[] = [];
    let previous = performance.now();
    let tick = 0;

    await new Promise<void>((resolve) => {
      const step = () => {
        const now = performance.now();
        intervals.push(now - previous);
        previous = now;
        tick += 1;

        grid.api.applyTransaction({
          update: Array.from({ length: UPDATES_PER_FRAME }, (_, i) => {
            const row = leaves[(tick * UPDATES_PER_FRAME + i) % leaves.length]!;
            return { ...row, price: row.price + ((tick % 20) - 10) / 100 };
          }),
        });

        if (intervals.length >= TICK_SECONDS * 60) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    // Drop the first sample: it spans mount rather than a steady-state frame.
    const samples = intervals.slice(1).sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)]!;
    const p95 = samples[Math.floor(samples.length * 0.95)]!;
    const worst = samples[samples.length - 1]!;
    // A frame is dropped when it took long enough for another to have fit inside.
    const dropped = samples.filter((interval) => interval > 32).length;

    // eslint-disable-next-line no-console -- a benchmark's output is its purpose
    console.log(
      `live ticking, ${ROWS.toLocaleString()} rows`.padEnd(46) +
        `median ${median.toFixed(2).padStart(8)}ms  p95 ${p95.toFixed(2).padStart(8)}ms  ` +
        `worst ${worst.toFixed(2).padStart(8)}ms  dropped ${dropped}/${samples.length}`,
    );

    expect(median).toBeLessThan(20);
    // A handful of long frames is scheduling noise on a shared runner; a steady
    // stream of them is a real stall.
    expect(dropped / samples.length).toBeLessThan(0.05);
  });

  it('leaves the layout untouched throughout a tick storm', async () => {
    const { grid, data } = await mount();
    const leaves = data.filter((row) => row.parentId !== null);
    const before = grid.api.getLayout();

    for (let batch = 0; batch < 200; batch += 1) {
      grid.api.applyTransaction({
        update: Array.from({ length: UPDATES_PER_FRAME }, (_, i) => {
          const row = leaves[(batch * UPDATES_PER_FRAME + i) % leaves.length]!;
          return { ...row, price: row.price + 0.01 };
        }),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(grid.api.getLayout()).toBe(before);
  });

  it('does not grow the heap after scrolling through the instances and back', async () => {
    const { grid } = await mount();
    const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
    const total = grid.api.getLayout().totalWidth;

    await collectGarbage();
    const baseline = heapBytes();

    // Out to the far end and back, mounting and unmounting instances all the way.
    for (const fraction of [0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
      scroller.scrollLeft = total * fraction;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    await grid.updateComplete;
    await collectGarbage();
    const after = heapBytes();

    if (baseline === undefined || after === undefined) {
      // eslint-disable-next-line no-console -- explains a skipped assertion
      console.log('heap after scrolling'.padEnd(46) + 'skipped — performance.memory unavailable');
      return;
    }

    const growthMb = (after - baseline) / 1024 / 1024;
    // eslint-disable-next-line no-console -- a benchmark's output is its purpose
    console.log(
      'heap after scrolling 200 instances and back'.padEnd(46) +
        `baseline ${(baseline / 1024 / 1024).toFixed(1)}MB  ` +
        `after ${(after / 1024 / 1024).toFixed(1)}MB  growth ${growthMb.toFixed(1)}MB`,
    );

    // Tight on purpose. This budget is what caught the @lit-labs/signals mixin
    // retaining every element it was ever applied to: growth was ~20MB per pass
    // and perfectly linear. Anything above a few MB here means unmounted
    // instances are being held again.
    expect(growthMb).toBeLessThan(8);
  });

  it('mounts only a fraction of the instances at any scroll position', async () => {
    const { grid } = await mount();
    const mounted = grid.shadowRoot!.querySelectorAll('flow-instance').length;
    const total = grid.api.getLayout().instances.length;

    // eslint-disable-next-line no-console -- a benchmark's output is its purpose
    console.log('instance virtualisation'.padEnd(46) + `${mounted} of ${total} instances mounted`);

    expect(total).toBeGreaterThan(50);
    expect(mounted).toBeLessThan(total / 4);
  });
});
