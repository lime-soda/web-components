import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../index.js';
import '../layouts.js';
import type { Grid } from '../components/grid.js';
import type { ColumnDef } from './types.js';
import type { GridOptions } from '../controller/grid-controller.js';

/**
 * Pinning, as the browser actually resolves it.
 *
 * `pinning.test.ts` fixes the arithmetic; this checks the part arithmetic cannot
 * see. `position: sticky` fails silently for reasons no unit test would catch —
 * an ancestor with `overflow: hidden`, a missing inset, a stacking context that
 * puts the pinned cell behind the ones it should cover — and the failure looks
 * like a column that simply scrolls away.
 */

interface Quote {
  id: string;
  instrument: string;
  price: number;
  size: number;
  venue: string;
}

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', width: 200, pinned: 'left' },
  { field: 'price', width: 300 },
  { field: 'size', width: 300 },
  { field: 'venue', width: 300 },
];

const quotes = Array.from({ length: 8 }, (_, i) => ({
  id: `q${i}`,
  instrument: `INS${i}`,
  price: 100 + i,
  size: 1000 + i,
  venue: 'XLON',
}));

let host: HTMLDivElement | undefined;

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function mount(options: Partial<GridOptions<Quote>> = {}): Promise<Grid<Quote>> {
  host = document.createElement('div');
  // Narrower than the columns, so there is something to scroll under the pin.
  host.style.cssText = 'width:500px;height:300px';
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Quote>;
  grid.gridOptions = { columns, layout: 'stack', rowHeight: 32, headerHeight: 40, ...options };
  grid.rowData = quotes;
  host.append(grid);

  await grid.updateComplete;
  await frame();
  await frame();
  return grid;
}

afterEach(() => {
  host?.remove();
  host = undefined;
});

const scroller = (grid: Grid<Quote>) => grid.shadowRoot!.querySelector('.scroller') as HTMLElement;

/**
 * The deepest element painted at a point.
 *
 * `document.elementFromPoint` stops at the outermost shadow host, so asking it
 * what covers a cell answers `ls-grid` every time — true, and useless. Each
 * shadow root has to be asked in turn.
 */
const deepestAt = (x: number, y: number): Element | null => {
  let element = document.elementFromPoint(x, y);
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
};

/** Whether a painted element belongs to the given cell, across shadow roots. */
const belongsTo = (owner: Element, node: Element | null): boolean => {
  let current: Element | null = node;
  while (current) {
    if (current === owner) return true;
    current = current.parentElement ?? (current.getRootNode() as ShadowRoot).host ?? null;
  }
  return false;
};

const cellsAt = (grid: Grid<Quote>, colIndex: number) =>
  [...grid.shadowRoot!.querySelectorAll('ls-grid-instance')].flatMap((instance) =>
    [...instance.shadowRoot!.querySelectorAll('ls-grid-row')].map(
      (row) => [...row.shadowRoot!.querySelectorAll('ls-grid-cell')][colIndex] as HTMLElement,
    ),
  );

describe('pinned columns in the browser', () => {
  it('holds the pinned column still while the rest scroll under it', async () => {
    const grid = await mount();
    const pinned = cellsAt(grid, 0)[0]!;
    const scrolling = cellsAt(grid, 1)[0]!;

    const before = {
      pinned: pinned.getBoundingClientRect().left,
      free: scrolling.getBoundingClientRect().left,
    };

    scroller(grid).scrollLeft = 250;
    await frame();
    await frame();

    const after = {
      pinned: pinned.getBoundingClientRect().left,
      free: scrolling.getBoundingClientRect().left,
    };

    // The unpinned column moved by the full scroll; the pinned one stayed put.
    // Within a pixel, because the instance border shifts the first cell by one.
    expect(Math.round(before.free - after.free)).toBe(250);
    expect(Math.abs(after.pinned - before.pinned)).toBeLessThanOrEqual(1);
  });

  it('keeps the header aligned with the cells beneath it', async () => {
    // Separate elements in separate rows: a column that stops in two different
    // places reads as a rendering fault rather than as one pinned column.
    const grid = await mount();
    const header = grid
      .shadowRoot!.querySelector('ls-grid-instance')!
      .shadowRoot!.querySelector('ls-grid-header-cell') as HTMLElement;
    const cell = cellsAt(grid, 0)[0]!;

    scroller(grid).scrollLeft = 250;
    await frame();
    await frame();

    expect(
      Math.abs(header.getBoundingClientRect().left - cell.getBoundingClientRect().left),
    ).toBeLessThanOrEqual(1);
  });

  it('paints over the scrolling cells rather than under them', async () => {
    // A transparent sticky cell shows the rows sliding beneath it. The point of
    // the opaque background, and invisible to any assertion about position.
    const grid = await mount();
    const pinned = cellsAt(grid, 0)[0]!;

    scroller(grid).scrollLeft = 250;
    await frame();

    const style = getComputedStyle(pinned);
    expect(style.position).toBe('sticky');
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    // Whatever is drawn at the pinned column's centre has to be the pinned cell.
    const box = pinned.getBoundingClientRect();
    const painted = deepestAt(box.left + box.width / 2, box.top + box.height / 2);
    expect(belongsTo(pinned, painted)).toBe(true);
  });

  it('leaves the flow layout alone', async () => {
    // Nothing slides out from under the viewport there, so a sticky column would
    // only detach itself from the rows it belongs to.
    const grid = await mount({ layout: 'flow' });
    const pinned = cellsAt(grid, 0)[0]!;

    expect(getComputedStyle(pinned).position).not.toBe('sticky');
    expect(pinned.hasAttribute('data-pinned')).toBe(false);
  });
});
