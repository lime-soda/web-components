import { afterEach, describe, expect, it } from 'vite-plus/test';
// Both layouts: these tests contrast one against the other.
import '../layouts.js';
import type { ColumnDef } from '../columns/types.js';
import type { GridOptions } from '../controller/grid-controller.js';
import type { Grid } from './grid.js';
import { TreeModule } from '../modules/tree/index.js';

/**
 * How the stack layout divides its width between columns.
 *
 * The rest of this layout — the header staying put, the body windowing its
 * rows, the sticky group band following the scroll — is driven through the
 * interface in `Grid/Tests/Stack layout`. What is left here is arithmetic: the
 * share a flexible column takes, the floor it will not go below, and the exact
 * match when every column is fixed. There is no gesture behind any of it, and a
 * pixel wrong in the sum is a column edge that does not line up.
 *
 * Was: The stack (vertical) layout.
 *
 * Its distinguishing requirement is that only the body scrolls. The header sat
 * inside the windowed instance, so it rode down with the spacer that positions
 * the window and scrolled out of view — the whole suite passed while it did,
 * because nothing asserted where the header was after scrolling.
 */

interface Row {
  id: string;
  parentId: string | null;
  name: string;
  price: number;
}

const columns: ColumnDef<Row>[] = [
  { field: 'name', width: 220 },
  { field: 'price', width: 120, valueFormatter: ({ value }) => (value as number).toFixed(2) },
];

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    parentId: null,
    name: `Instrument ${i}`,
    price: 100 + i,
  }));

let host: HTMLDivElement | undefined;

async function waitFor(
  condition: () => boolean,
  { timeout = 4000, description = 'condition' } = {},
): Promise<void> {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${description}.`);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

async function mount(
  options: Partial<GridOptions<Row>> = {},
  data = rows(500),
): Promise<Grid<Row>> {
  host = document.createElement('div');
  host.style.cssText = 'width:600px;height:400px';
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Row>;
  grid.gridOptions = {
    columns,
    layout: 'stack',
    rowHeight: 32,
    headerHeight: 32,
    ...options,
  };
  grid.rowData = data;
  host.append(grid);

  await grid.updateComplete;
  await waitFor(
    () =>
      grid.shadowRoot?.querySelector('ls-grid-instance[parts="rows"]:not(.stack-sticky)') !== null,
    { description: 'the body instance to render' },
  );
  await grid.updateComplete;
  return grid;
}

const scrollerOf = (grid: Grid<Row>) => grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
const headerOf = (grid: Grid<Row>) =>
  grid.shadowRoot!.querySelector('ls-grid-instance[parts="header"]')!;
const bodyOf = (grid: Grid<Row>) =>
  grid.shadowRoot!.querySelector('ls-grid-instance[parts="rows"]')!;

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('stack layout', () => {
  describe('column sizing', () => {
    const templateOf = (grid: Grid<Row>) =>
      getComputedStyle(headerOf(grid).shadowRoot!.querySelector('.grid') as HTMLElement)
        .gridTemplateColumns;

    it('flexes a column that declares no width, filling the container', async () => {
      const grid = await mount({ columns: [{ field: 'name' }, { field: 'price', width: 120 }] });

      const box = headerOf(grid).getBoundingClientRect();
      expect(Math.round(box.width)).toBe(scrollerOf(grid).clientWidth);

      // name takes the leftover; price stays pinned.
      const [nameTrack, priceTrack] = templateOf(grid).split(' ');
      expect(Number.parseFloat(priceTrack!)).toBe(120);
      expect(Number.parseFloat(nameTrack!)).toBeGreaterThan(120);
    });

    it('divides the leftover by the declared shares', async () => {
      const grid = await mount({
        columns: [
          { field: 'name', flex: 3 },
          { colId: 'other', flex: 1 },
        ],
      });

      const [first, second] = templateOf(grid)
        .split(' ')
        .map((track) => Number.parseFloat(track));

      expect(first! / second!).toBeCloseTo(3, 1);
    });

    it('honours a floor on a flexible column', async () => {
      const grid = await mount(
        {
          columns: [
            { field: 'name', minWidth: 500 },
            { field: 'price', minWidth: 500 },
          ],
        },
        rows(50),
      );

      // Together they exceed the 600px container, so both hold their floor and
      // the grid scrolls rather than crushing them.
      for (const track of templateOf(grid).split(' ')) {
        expect(Number.parseFloat(track)).toBeGreaterThanOrEqual(500);
      }
      expect(scrollerOf(grid).scrollWidth).toBeGreaterThan(scrollerOf(grid).clientWidth);
    });

    it('matches the columns exactly when every one is fixed', async () => {
      // No dead space beside the last column: the box is the sum of the columns.
      const grid = await mount({
        columns: [
          { field: 'name', width: 150 },
          { field: 'price', width: 100 },
        ],
      });

      // clientWidth, so the instance's own 1px border is not counted as a column.
      expect((headerOf(grid) as HTMLElement).clientWidth).toBe(250);
      expect(scrollerOf(grid).clientWidth).toBeGreaterThan(250);
    });

    it('keeps the body the same width as the header either way', async () => {
      const fixed = await mount({
        columns: [
          { field: 'name', width: 150 },
          { field: 'price', width: 100 },
        ],
      });
      expect(Math.round(bodyOf(fixed).getBoundingClientRect().width)).toBe(
        Math.round(headerOf(fixed).getBoundingClientRect().width),
      );
      host!.remove();

      const flexible = await mount({ columns: [{ field: 'name' }, { field: 'price' }] });
      expect(Math.round(bodyOf(flexible).getBoundingClientRect().width)).toBe(
        Math.round(headerOf(flexible).getBoundingClientRect().width),
      );
    });

    it('leaves the flow layout on fixed pixel tracks', async () => {
      // A flow instance is a fixed-width block; there is no leftover for a
      // fraction to divide, so a flexible column falls back to its width.
      host = document.createElement('div');
      host.style.cssText = 'width:800px;height:400px';
      document.body.append(host);

      const grid = document.createElement('ls-grid') as Grid<Row>;
      grid.gridOptions = { columns: [{ field: 'name' }, { field: 'price' }], rowHeight: 32 };
      grid.rowData = rows(50);
      host.append(grid);
      await grid.updateComplete;
      await waitFor(() => grid.shadowRoot?.querySelector('ls-grid-instance') !== null, {
        description: 'an instance to mount',
      });

      const instance = grid.shadowRoot!.querySelector('ls-grid-instance')!;
      const template = getComputedStyle(
        instance.shadowRoot!.querySelector('.grid') as HTMLElement,
      ).gridTemplateColumns;

      expect(template).not.toContain('fr');
      expect(instance.hasAttribute('data-flexes')).toBe(false);
    });
  });
});

describe('the pinned group band and focus', () => {
  // The band is a copy of rows that are also in the body, drawn over them. It
  // used to be a synthesised instance with an id of its own, which the layout
  // did not contain — so clicking a cell in it put focus somewhere the
  // controller could not locate, every arrow key went unhandled, and the
  // browser scrolled the body instead of the grid moving.
  const rows: Row[] = [
    { id: 'g', parentId: null, name: 'Group', price: 0 },
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      parentId: 'g',
      name: `Row ${i}`,
      price: i,
    })),
  ];

  const mountGrouped = () =>
    mount(
      { modules: [new TreeModule<Row>({ getParentId: (d) => d.parentId, defaultExpanded: true })] },
      rows,
    );

  const bandOf = (grid: Grid<Row>) =>
    grid.shadowRoot!.querySelector('ls-grid-instance.stack-sticky') as HTMLElement | null;

  const cellIn = (instance: HTMLElement) =>
    instance
      .shadowRoot!.querySelector('ls-grid-row')!
      .shadowRoot!.querySelector('ls-grid-cell') as HTMLElement;

  it('leaves focus somewhere the arrows can move from', async () => {
    const grid = await mountGrouped();
    const band = bandOf(grid);
    expect(band, 'no pinned band rendered').not.toBeNull();

    cellIn(band!).focus();
    expect(
      grid.controller!.focus.focused.get(),
      'clicking the band focused nothing',
    ).not.toBeNull();

    // The whole point: the position has to be one the layout contains.
    expect(
      grid.controller!.focus.moveRow(1),
      'focus was stranded on an instance the layout does not have',
    ).toBe(true);
  });

  it('keeps the band out of the tab order', async () => {
    // The row it mirrors is tabbable already; two stops for one row is one too
    // many.
    const grid = await mountGrouped();

    expect(cellIn(bandOf(grid)!).tabIndex).toBe(-1);
  });
});
