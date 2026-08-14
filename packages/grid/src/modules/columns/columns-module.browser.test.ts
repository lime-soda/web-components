import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../../index.js';
import '../../layouts.js';
import { ColumnsModule } from './index.js';
import type { Grid } from '../../components/grid.js';
import type { ColumnDef } from '../../columns/types.js';
import type { GridOptions } from '../../controller/grid-controller.js';

/**
 * The header interactions, driven the way a user drives them.
 *
 * A drag is a sequence of pointer events against live geometry, and the parts
 * that break are the ones no unit test reaches: capture that stops tracking as
 * soon as the pointer leaves a 7px handle, a handle positioned against the
 * wrong ancestor, a drop index computed from column widths that disagrees with
 * where the headers actually are.
 */

interface Quote {
  id: string;
  instrument: string;
  price: number;
  size: number;
}

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', width: 200 },
  { field: 'price', width: 150 },
  { field: 'size', width: 150 },
];

const rows = Array.from({ length: 5 }, (_, i) => ({
  id: `q${i}`,
  instrument: `INS${i}`,
  price: 100 + i,
  size: 1000 + i,
}));

let host: HTMLDivElement | undefined;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function mount(options: Partial<GridOptions<Quote>> = {}) {
  host = document.createElement('div');
  host.style.cssText = 'width:700px;height:300px';
  document.body.append(host);

  const module = new ColumnsModule<Quote>();
  const grid = document.createElement('ls-grid') as Grid<Quote>;
  grid.gridOptions = {
    columns,
    layout: 'stack',
    rowHeight: 32,
    headerHeight: 40,
    modules: [module],
    ...options,
  };
  grid.rowData = rows;
  host.append(grid);

  await grid.updateComplete;
  await frame();
  await frame();
  return { grid, module };
}

afterEach(() => {
  host?.remove();
  host = undefined;
});

const headers = (grid: Grid<Quote>) =>
  [...grid.shadowRoot!.querySelectorAll('ls-grid-instance')].flatMap((instance) => [
    ...instance.shadowRoot!.querySelectorAll('ls-grid-header-cell'),
  ]) as HTMLElement[];

const handleIn = (header: HTMLElement, selector: string) =>
  header.shadowRoot!.querySelector(selector) as HTMLElement;

/**
 * A pointer drag: down on the target, move in steps, then up.
 *
 * Capture is stubbed out because `setPointerCapture` rejects a pointerId that
 * never belonged to a real pointer, and a synthetic PointerEvent cannot create
 * one. So these events are delivered to the handle directly — which means the
 * capture call itself is not under test here, only what the handlers do with
 * the positions they receive.
 */
async function drag(element: HTMLElement, fromX: number, toX: number, y: number) {
  const opts = { bubbles: true, composed: true, pointerId: 1, pointerType: 'mouse' };
  element.setPointerCapture = () => {};
  element.releasePointerCapture = () => {};
  element.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: fromX, clientY: y }));
  for (const x of [fromX + (toX - fromX) / 2, toX]) {
    element.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: x, clientY: y }));
    await frame();
  }
  element.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: toX, clientY: y }));
  await frame();
}

describe('column interactions in the browser', () => {
  it('puts a resize handle inside the header it resizes', async () => {
    // Positioned against the header cell, not against whatever ancestor happens
    // to be positioned — the failure there is a handle floating elsewhere.
    const { grid } = await mount();
    const header = headers(grid)[0]!;
    const handle = handleIn(header, '.ls-grid-resize-handle');

    const headerBox = header.getBoundingClientRect();
    const handleBox = handle.getBoundingClientRect();

    expect(handleBox.height).toBeGreaterThan(0);
    // Sits at the header's trailing edge, within a few px of it.
    expect(Math.abs(handleBox.right - headerBox.right)).toBeLessThanOrEqual(4);
  });

  it('widens a column by dragging its handle', async () => {
    const { grid, module } = await mount();
    const header = headers(grid)[0]!;
    const handle = handleIn(header, '.ls-grid-resize-handle');
    const box = handle.getBoundingClientRect();

    await drag(handle, box.left + 3, box.left + 103, box.top + 5);
    await grid.updateComplete;

    const width = module.getColumnState().find((c) => c.colId === 'instrument')?.width;
    expect(width).toBeCloseTo(300, -1);
  });

  it('sizes from the pointer position rather than the handle', async () => {
    // The width has to follow the pointer wherever it goes, including far
    // outside the 7px handle — which is why the real thing captures the pointer.
    // Capture cannot be exercised with synthetic events, so what this pins down
    // is that the handler reads the pointer, not the handle's own bounds.
    const { grid, module } = await mount();
    const handle = handleIn(headers(grid)[0]!, '.ls-grid-resize-handle');
    const box = handle.getBoundingClientRect();

    await drag(handle, box.left + 3, box.left + 250, box.top + 5);

    const width = module.getColumnState().find((c) => c.colId === 'instrument')!.width!;
    expect(width).toBeGreaterThan(400);
  });

  it('resizes from the keyboard', async () => {
    // A drag is not an accessible affordance on its own, and a column of numbers
    // ellipsised to nothing is unreadable rather than merely inconvenient.
    const { grid, module } = await mount();
    const handle = handleIn(headers(grid)[0]!, '.ls-grid-resize-handle');

    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }),
    );
    await grid.updateComplete;

    expect(module.getColumnState().find((c) => c.colId === 'instrument')?.width).toBe(210);
  });

  it('moves a column by dragging its grip', async () => {
    const { grid, module } = await mount();
    const grip = handleIn(headers(grid)[0]!, '.ls-grid-column-grip');
    const third = headers(grid)[2]!.getBoundingClientRect();
    const gripBox = grip.getBoundingClientRect();

    await drag(grip, gripBox.left, third.left + third.width / 2, gripBox.top + 5);
    await grid.updateComplete;
    await frame();

    expect(module.getColumnState().map((c) => c.colId)).toEqual(['price', 'size', 'instrument']);
  });

  it('moves a column from the keyboard', async () => {
    const { grid, module } = await mount();
    const grip = handleIn(headers(grid)[0]!, '.ls-grid-column-grip');

    grip.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }),
    );
    await grid.updateComplete;

    expect(module.getColumnState().map((c) => c.colId)).toEqual(['price', 'instrument', 'size']);
  });

  it('renders no handles when both are turned off', async () => {
    // The affordance has to actually disappear: a visible handle that does
    // nothing is worse than none.
    const { grid } = await mount({
      modules: [new ColumnsModule<Quote>({ resizable: false, reorderable: false })],
    });
    const header = headers(grid)[0]!;

    expect(header.shadowRoot!.querySelector('.ls-grid-resize-handle')).toBeNull();
    expect(header.shadowRoot!.querySelector('.ls-grid-column-grip')).toBeNull();
  });

  it('respects a column that opts out', async () => {
    const { grid } = await mount({
      columns: [{ field: 'instrument', width: 200, resizable: false }, ...columns.slice(1)],
    });

    expect(headers(grid)[0]!.shadowRoot!.querySelector('.ls-grid-resize-handle')).toBeNull();
    expect(headers(grid)[1]!.shadowRoot!.querySelector('.ls-grid-resize-handle')).not.toBeNull();
  });
});
