import { afterEach, describe, expect, it } from 'vitest';
import '../index.js';
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
    it('stays at the top of the scroller while the body scrolls', async () => {
      const grid = await mount();
      const scrollerTop = scrollerOf(grid).getBoundingClientRect().top;
      const headerTop = () => headerOf(grid).getBoundingClientRect().top;

      expect(Math.round(headerTop())).toBe(Math.round(scrollerTop));

      await scrollTo(grid, 2000);
      expect(Math.round(headerTop())).toBe(Math.round(scrollerTop));

      await scrollTo(grid, 10_000);
      expect(Math.round(headerTop())).toBe(Math.round(scrollerTop));
    });

    it('is never scrolled above the visible area', async () => {
      // The exact failure: the header's bottom went above the scroller's top.
      const grid = await mount();
      await scrollTo(grid, 5000);

      const scroller = scrollerOf(grid).getBoundingClientRect();
      const header = headerOf(grid).getBoundingClientRect();

      expect(header.bottom).toBeGreaterThan(scroller.top);
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

    it('scrolls horizontally with the body, since it pins only vertically', async () => {
      const grid = await mount({ columns: [...columns, { field: 'price', width: 600 }] });
      const scroller = scrollerOf(grid);
      const before = headerOf(grid).getBoundingClientRect().left;

      scroller.scrollLeft = 200;
      await waitFor(() => headerOf(grid).getBoundingClientRect().left !== before, {
        description: 'the header to follow a horizontal scroll',
      });

      expect(headerOf(grid).getBoundingClientRect().left).toBeLessThan(before);
    });

    it('paints over the rows passing beneath it', async () => {
      const grid = await mount();
      await scrollTo(grid, 2000);

      const header = headerOf(grid) as HTMLElement;
      const styles = getComputedStyle(header);

      expect(styles.position).toBe('sticky');
      expect(Number(styles.zIndex)).toBeGreaterThan(0);
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
      const scrollerTop = scrollerOf(grid).getBoundingClientRect().top;

      await scrollTo(grid, 3000);

      expect(Math.round(headerOf(grid).getBoundingClientRect().top)).toBe(Math.round(scrollerTop));
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

    it('pins nothing while the heading itself is in view', async () => {
      // A heading is not in its own ancestor chain, so no duplicate appears.
      const grid = await mountTree();

      expect(stickyOf(grid)).toBeNull();
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

      expect(Math.abs(stickyTop - headerBottom)).toBeLessThan(2);
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
