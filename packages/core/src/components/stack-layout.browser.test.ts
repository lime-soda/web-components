import { afterEach, describe, expect, it } from 'vitest';
import '../index.js';
import '../define.js';
import type { ColumnDef } from '../columns/types.js';
import type { GridOptions } from '../controller/grid-controller.js';
import type { FlowGrid } from './grid.js';
import { TreeModule } from '../modules/tree/index.js';
import { SortModule } from '../modules/sort/index.js';

/**
 * The stack (vertical) layout.
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
): Promise<FlowGrid<Row>> {
  host = document.createElement('div');
  host.style.cssText = 'width:600px;height:400px';
  document.body.append(host);

  const grid = document.createElement('flow-grid') as FlowGrid<Row>;
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
    () => grid.shadowRoot?.querySelector('flow-instance[parts="rows"]:not(.stack-sticky)') !== null,
    { description: 'the body instance to render' },
  );
  await grid.updateComplete;
  return grid;
}

const scrollerOf = (grid: FlowGrid<Row>) =>
  grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
const headerOf = (grid: FlowGrid<Row>) =>
  grid.shadowRoot!.querySelector('flow-instance[parts="header"]')!;
const chromeOf = (grid: FlowGrid<Row>) => grid.shadowRoot!.querySelector('.stack-chrome')!;
const viewportOf = (grid: FlowGrid<Row>) =>
  grid.shadowRoot!.querySelector('.viewport') as HTMLElement;
// The sticky group band is also parts="rows", so it must be excluded or it
// matches first and every body assertion reads the wrong element.
const bodyOf = (grid: FlowGrid<Row>) =>
  grid.shadowRoot!.querySelector('flow-instance[parts="rows"]:not(.stack-sticky)')!;
const bodyRows = (grid: FlowGrid<Row>) => [
  ...bodyOf(grid).shadowRoot!.querySelectorAll('flow-row'),
];

/** The first cell's text of the first rendered row. */
const firstRowText = (grid: FlowGrid<Row>): string => {
  const row = bodyRows(grid)[0];
  if (!row) return '';
  const cell = row.shadowRoot!.querySelector('flow-cell');
  return cell?.shadowRoot?.textContent?.trim() ?? '';
};

async function scrollTo(grid: FlowGrid<Row>, top: number): Promise<void> {
  const before = firstRowText(grid);
  scrollerOf(grid).scrollTop = top;
  await waitFor(() => firstRowText(grid) !== before, {
    description: `the window to move after scrolling to ${top}`,
  });
  await grid.updateComplete;
}

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('stack layout', () => {
  describe('the header', () => {
    it('does not move while the body scrolls', async () => {
      const grid = await mount();
      // Above the scrolling body, so it sits at the top of the grid itself.
      const gridTop = viewportOf(grid).getBoundingClientRect().top;
      const headerTop = () => headerOf(grid).getBoundingClientRect().top;

      expect(Math.round(headerTop())).toBe(Math.round(gridTop));

      await scrollTo(grid, 2000);
      expect(Math.round(headerTop())).toBe(Math.round(gridTop));

      await scrollTo(grid, 10_000);
      expect(Math.round(headerTop())).toBe(Math.round(gridTop));
    });

    it('sits above the body, which starts beneath it', async () => {
      const grid = await mount();

      const header = headerOf(grid).getBoundingClientRect();
      const scroller = scrollerOf(grid).getBoundingClientRect();

      expect(Math.round(header.bottom)).toBe(Math.round(scroller.top));
    });

    it('is never scrolled out of view', async () => {
      // The original failure: the header's bottom went above the visible area.
      const grid = await mount();
      await scrollTo(grid, 5000);

      const viewport = viewportOf(grid).getBoundingClientRect();
      const header = headerOf(grid).getBoundingClientRect();

      expect(header.bottom).toBeGreaterThan(viewport.top);
      expect(header.top).toBeLessThan(viewport.bottom);
      expect(header.height).toBeGreaterThan(0);
    });

    it('renders exactly one header, not one per window', async () => {
      const grid = await mount();
      await scrollTo(grid, 3000);

      expect(grid.shadowRoot!.querySelectorAll('flow-instance[parts="header"]')).toHaveLength(1);
    });

    it('carries no rows, and the body carries no header', async () => {
      const grid = await mount();

      expect(headerOf(grid).shadowRoot!.querySelectorAll('flow-row')).toHaveLength(0);
      expect(bodyOf(grid).shadowRoot!.querySelectorAll('flow-header-cell')).toHaveLength(0);
    });

    it('keeps its columns aligned with the body', async () => {
      // Two separate elements, so alignment is a real risk rather than a given.
      const grid = await mount();
      await scrollTo(grid, 2000);

      const headerCells = [...headerOf(grid).shadowRoot!.querySelectorAll('flow-header-cell')];
      const bodyCells = [...bodyRows(grid)[0]!.shadowRoot!.querySelectorAll('flow-cell')];

      expect(headerCells).toHaveLength(bodyCells.length);
      for (const [index, headerCell] of headerCells.entries()) {
        const headerRect = headerCell.getBoundingClientRect();
        const bodyRect = bodyCells[index]!.getBoundingClientRect();
        expect(Math.abs(headerRect.left - bodyRect.left), `column ${index} left`).toBeLessThan(1.5);
        expect(Math.abs(headerRect.width - bodyRect.width), `column ${index} width`).toBeLessThan(
          1.5,
        );
      }
    });

    it('follows the body sideways, so the columns stay in line', async () => {
      const grid = await mount({
        columns: [
          { field: 'name', width: 300 },
          { field: 'price', width: 300 },
          { colId: 'extra', headerName: 'Extra', width: 300 },
        ],
      });
      const scroller = scrollerOf(grid);
      const before = headerOf(grid).getBoundingClientRect().left;

      scroller.scrollLeft = 200;
      await waitFor(() => headerOf(grid).getBoundingClientRect().left !== before, {
        description: 'the header to follow a horizontal scroll',
      });

      const headerCell = headerOf(grid).shadowRoot!.querySelectorAll('flow-header-cell')[0]!;
      const bodyCell = bodyRows(grid)[0]!.shadowRoot!.querySelectorAll('flow-cell')[0]!;

      expect(headerOf(grid).getBoundingClientRect().left).toBeCloseTo(before - 200, 0);
      expect(
        Math.abs(headerCell.getBoundingClientRect().left - bodyCell.getBoundingClientRect().left),
      ).toBeLessThan(1.5);
    });

    it('is static, outside the scrolling body', async () => {
      // Not sticky: the browser should not be repositioning it every frame, and
      // it should not live inside the box it is meant to be independent of.
      const grid = await mount();
      await scrollTo(grid, 2000);

      const header = headerOf(grid) as HTMLElement;
      expect(getComputedStyle(header).position).toBe('static');
      expect(scrollerOf(grid).contains(header)).toBe(false);
      expect(chromeOf(grid).contains(header)).toBe(true);
    });

    it('reserves the width the body scrollbar takes', async () => {
      // Zero with overlay scrollbars; with classic ones the header would
      // otherwise sit proud of the body by the scrollbar's width.
      const grid = await mount();
      const scroller = scrollerOf(grid);
      const gutter = scroller.offsetWidth - scroller.clientWidth;

      const reserved = getComputedStyle(chromeOf(grid) as HTMLElement).paddingRight;

      expect(Number.parseFloat(reserved)).toBe(gutter);
    });
  });

  describe('the body', () => {
    it('windows rows rather than rendering all of them', async () => {
      const grid = await mount({}, rows(5000));

      expect(bodyRows(grid).length).toBeLessThan(40);
    });

    it('advances the window as the scroller moves', async () => {
      const grid = await mount();
      const first = firstRowText(grid);

      await scrollTo(grid, 4000);

      expect(firstRowText(grid)).not.toBe(first);
    });

    it('keeps the scroll height of the whole dataset', async () => {
      const grid = await mount({}, rows(1000));

      // 1000 rows at 32px, plus the header.
      expect(scrollerOf(grid).scrollHeight).toBeGreaterThan(1000 * 32);
    });

    it('returns to the first row when scrolled back to the top', async () => {
      const grid = await mount();
      const first = firstRowText(grid);
      await scrollTo(grid, 6000);

      await scrollTo(grid, 0);

      expect(firstRowText(grid)).toBe(first);
    });
  });

  describe('with modules', () => {
    it('keeps the header pinned with tree and sort installed', async () => {
      const data: Row[] = [
        { id: 'g', parentId: null, name: 'Group', price: 0 },
        ...Array.from({ length: 300 }, (_, i) => ({
          id: `c${i}`,
          parentId: 'g',
          name: `Child ${i}`,
          price: i,
        })),
      ];
      const grid = await mount(
        {
          modules: [
            new TreeModule<Row>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
            new SortModule<Row>(),
          ],
        },
        data,
      );
      const gridTop = viewportOf(grid).getBoundingClientRect().top;

      await scrollTo(grid, 3000);

      expect(Math.round(headerOf(grid).getBoundingClientRect().top)).toBe(Math.round(gridTop));
    });

    it('still offers a sortable header while pinned', async () => {
      const grid = await mount({ modules: [new SortModule<Row>()] });
      await scrollTo(grid, 2000);

      const header = headerOf(grid).shadowRoot!.querySelectorAll('flow-header-cell')[1]!;
      (header.shadowRoot!.querySelector('.label') as HTMLElement).click();
      await waitFor(() => grid.api.getSortModel().length > 0, { description: 'the sort to apply' });

      expect(grid.api.getSortModel()[0]!.colId).toBe('price');
    });
  });

  describe('sticky group headings', () => {
    const grouped = (): Row[] => [
      { id: 'g1', parentId: null, name: 'Group One', price: 0 },
      ...Array.from({ length: 100 }, (_, i) => ({
        id: `g1-c${i}`,
        parentId: 'g1',
        name: `One ${i}`,
        price: i,
      })),
      { id: 'g2', parentId: null, name: 'Group Two', price: 0 },
      ...Array.from({ length: 100 }, (_, i) => ({
        id: `g2-c${i}`,
        parentId: 'g2',
        name: `Two ${i}`,
        price: i,
      })),
    ];

    const mountTree = () =>
      mount(
        {
          modules: [new TreeModule<Row>({ getParentId: (d) => d.parentId, defaultExpanded: true })],
        },
        grouped(),
      );

    const stickyOf = (grid: FlowGrid<Row>) => grid.shadowRoot!.querySelector('.stack-sticky');
    const stickyText = (grid: FlowGrid<Row>): string => {
      const band = stickyOf(grid);
      if (!band) return '';
      return [...band.shadowRoot!.querySelectorAll('flow-row')]
        .flatMap((row) => [...row.shadowRoot!.querySelectorAll('flow-cell')])
        .map((cell) => cell.shadowRoot?.textContent ?? '')
        .join(' ');
    };

    it('pins the group from the outset, exactly over its real heading', async () => {
      // Deliberate: hiding the band while the real heading is visible is what
      // made it blink at every boundary. Instead it is always present and, at
      // the top, sits exactly over the heading it duplicates — so it cannot be
      // told apart from it.
      const grid = await mountTree();

      expect(stickyText(grid)).toContain('Group One');

      const band = (stickyOf(grid) as HTMLElement).getBoundingClientRect();
      const heading = bodyRows(grid)[0]!
        .shadowRoot!.querySelector('flow-cell')!
        .getBoundingClientRect();
      expect(Math.abs(band.top - heading.top)).toBeLessThan(1.5);
    });

    it('never blinks out while passing from one group to the next', async () => {
      // The band vanished for one row's worth of scroll at every boundary,
      // because a heading arriving at the top is not in its own ancestor chain.
      const grid = await mountTree();
      const scroller = scrollerOf(grid);

      // Step through the boundary a row at a time, watching for a gap.
      const seen: string[] = [];
      for (let top = 3000; top <= 3600; top += 16) {
        scroller.scrollTop = top;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await grid.updateComplete;
        seen.push(stickyText(grid).includes('Group') ? 'pinned' : 'gap');
      }

      expect(seen).not.toContain('gap');
    });

    it('rebuilds the band only when the pinned rows change', async () => {
      // A fresh instance object per render re-rendered the band on every
      // repaint — a resize, a tick — which reads as a flicker.
      const grid = await mountTree();
      await scrollTo(grid, 1500);
      const band = stickyOf(grid)!;
      const instanceBefore = (band as unknown as { instance: unknown }).instance;

      // Force repaints that leave the pinned group alone.
      grid.api.applyTransaction({
        update: [{ id: 'g1-c0', parentId: 'g1', name: 'One 0', price: 999 }],
      });
      await grid.updateComplete;
      host!.style.width = '640px';
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await grid.updateComplete;

      expect(stickyOf(grid)).toBe(band);
      expect((band as unknown as { instance: unknown }).instance).toBe(instanceBefore);
    });

    it('pins the group once its heading has scrolled out of view', async () => {
      const grid = await mountTree();

      await scrollTo(grid, 800);

      expect(stickyText(grid)).toContain('Group One');
    });

    it('swaps to the next group when the scroll passes into it', async () => {
      const grid = await mountTree();
      await scrollTo(grid, 800);
      expect(stickyText(grid)).toContain('Group One');

      await scrollTo(grid, 4000);

      expect(stickyText(grid)).toContain('Group Two');
      expect(stickyText(grid)).not.toContain('Group One');
    });

    it('sits directly beneath the column header', async () => {
      const grid = await mountTree();
      await scrollTo(grid, 800);

      const headerBottom = headerOf(grid).getBoundingClientRect().bottom;
      const stickyTop = (stickyOf(grid) as HTMLElement).getBoundingClientRect().top;

      // The header is static chrome above the body; the band pins to the body's
      // top edge, which is immediately below it.
      expect(Math.abs(stickyTop - headerBottom)).toBeLessThan(2);
      expect(scrollerOf(grid).contains(stickyOf(grid))).toBe(true);
    });

    it('overlays the rows rather than displacing them', async () => {
      // Taken out of flow by a negative margin: otherwise every row shifts down
      // by the current group depth, and shifts again when that changes.
      const grid = await mountTree();
      await scrollTo(grid, 800);

      const band = stickyOf(grid) as HTMLElement;
      const height = band.getBoundingClientRect().height;
      const margin = getComputedStyle(band).marginBottom;

      expect(height).toBeGreaterThan(0);
      expect(Math.abs(Number.parseFloat(margin) + height)).toBeLessThan(2);
    });

    it('pins nothing at all without a tree module', async () => {
      // Core has no notion of a group; the chain simply arrives empty.
      const grid = await mount();
      await scrollTo(grid, 2000);

      expect(stickyOf(grid)).toBeNull();
    });
  });

  describe('horizontal scrolling', () => {
    it('reaches columns wider than the container', async () => {
      // A full-width band with overflow:hidden clipped them and contributed
      // nothing to the scroller's width, so they were unreachable.
      const grid = await mount({
        columns: [
          { field: 'name', width: 300 },
          { field: 'price', width: 300 },
          { colId: 'extra', headerName: 'Extra', width: 300 },
        ],
      });

      const scroller = scrollerOf(grid);
      expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    });
  });

  describe('column sizing', () => {
    const templateOf = (grid: FlowGrid<Row>) =>
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

      const grid = document.createElement('flow-grid') as FlowGrid<Row>;
      grid.gridOptions = { columns: [{ field: 'name' }, { field: 'price' }], rowHeight: 32 };
      grid.rowData = rows(50);
      host.append(grid);
      await grid.updateComplete;
      await waitFor(() => grid.shadowRoot?.querySelector('flow-instance') !== null, {
        description: 'an instance to mount',
      });

      const instance = grid.shadowRoot!.querySelector('flow-instance')!;
      const template = getComputedStyle(
        instance.shadowRoot!.querySelector('.grid') as HTMLElement,
      ).gridTemplateColumns;

      expect(template).not.toContain('fr');
      expect(instance.hasAttribute('data-flexes')).toBe(false);
    });
  });

  describe('the flow layout is unaffected', () => {
    it('still gives every instance its own header', async () => {
      host = document.createElement('div');
      host.style.cssText = 'width:800px;height:400px';
      document.body.append(host);

      const grid = document.createElement('flow-grid') as FlowGrid<Row>;
      grid.gridOptions = { columns, rowHeight: 32, headerHeight: 32 };
      grid.rowData = rows(50);
      host.append(grid);
      await grid.updateComplete;
      await waitFor(() => grid.shadowRoot?.querySelector('flow-instance') !== null, {
        description: 'an instance to mount',
      });

      const instances = [...grid.shadowRoot!.querySelectorAll('flow-instance')];
      expect(instances.length).toBeGreaterThan(0);
      for (const instance of instances) {
        // `full`, so each carries its own header inline rather than split out.
        expect(instance.getAttribute('parts')).toBe('full');
        expect(instance.shadowRoot!.querySelectorAll('flow-header-cell')).toHaveLength(2);
        expect(instance.shadowRoot!.querySelectorAll('flow-row').length).toBeGreaterThan(0);
      }
    });
  });
});
