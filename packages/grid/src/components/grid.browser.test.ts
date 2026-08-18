import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../index.js';
import '../layouts.js';
import { CellRendererElement } from './cell-renderer-element.js';
import type { Grid } from './grid.js';
import type { GridModule } from '../modules/types.js';
import type { ColumnDef } from '../columns/types.js';
import type { GridOptions } from '../controller/grid-controller.js';

interface Quote {
  id: string;
  instrument: string;
  price: number;
}

const columns: ColumnDef<Quote>[] = [
  { field: 'instrument', width: 200 },
  { field: 'price', width: 100, valueFormatter: ({ value }) => (value as number).toFixed(2) },
];

const quotes = (count: number): Quote[] =>
  Array.from({ length: count }, (_, i) => ({ id: `q${i}`, instrument: `INS${i}`, price: 100 + i }));

let host: HTMLDivElement | undefined;

/**
 * Waits for a condition, polling by frame.
 *
 * Mounting depends on ResizeObserver measuring the container and then an
 * IntersectionObserver reporting which instances are near the viewport. Both are
 * delivered asynchronously and neither guarantees a frame count, so waiting a
 * fixed number of frames is a race that a loaded CI box loses.
 */
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

/** Mounts a grid at a fixed size so instance capacity is deterministic. */
async function mount(
  options: Partial<GridOptions<Quote>> = {},
  rows = quotes(25),
  { width = 700, height = 360 } = {},
): Promise<Grid<Quote>> {
  host = document.createElement('div');
  host.style.cssText = `width:${width}px;height:${height}px`;
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Quote>;
  grid.gridOptions = { columns, rowHeight: 32, headerHeight: 40, instanceGap: 16, ...options };
  grid.rowData = rows;
  host.append(grid);

  await grid.updateComplete;
  // Settled means an instance has actually mounted, not merely that the layout
  // produced slots — an empty grid would otherwise let tests pass vacuously.
  await waitFor(() => grid.shadowRoot?.querySelector('ls-grid-instance') !== null, {
    description: 'the first instance to mount',
  });
  await grid.updateComplete;
  return grid;
}

const slots = (grid: Grid<Quote>) =>
  [...(grid.shadowRoot?.querySelectorAll('.instance-slot') ?? [])] as HTMLElement[];

const instances = (grid: Grid<Quote>) =>
  grid.shadowRoot?.querySelectorAll('ls-grid-instance') ?? [];

/**
 * A row's visible text. Each cell keeps its content in its own shadow root, so
 * reading `row.shadowRoot.textContent` returns nothing — the cells have no light
 * DOM. This walks one level further down.
 */
const rowText = (row: Element): string =>
  [...(row.shadowRoot?.querySelectorAll('ls-grid-cell') ?? [])]
    .map((cell) => cell.shadowRoot?.textContent ?? '')
    .join(' ');

const firstRow = (grid: Grid<Quote>): Element =>
  instances(grid)[0]!.shadowRoot!.querySelector('ls-grid-row')!;

afterEach(() => {
  host?.remove();
  host = undefined;
});

/**
 * What the grid does that no gesture reaches.
 *
 * How it lays out, what it draws, how focus moves and what a module contributes
 * to the surface are all driven through the interface in `Grid/Tests/*`. What is
 * left here needs a browser and has no user action behind it: that a value tick
 * never reaches the layout engine, that a repeated row shares one signal with
 * the row it copies, and the events and api calls an application makes.
 */
describe('<ls-grid>', () => {
  describe('a price tick', () => {
    it('repaints the cell without re-running the layout', async () => {
      const grid = await mount();
      const layoutBefore = grid.api.getLayout();
      const cell = firstRow(grid).shadowRoot!.querySelectorAll('ls-grid-cell')[1]!;

      grid.api.applyTransaction({ update: [{ id: 'q0', instrument: 'INS0', price: 999 }] });
      await cell.updateComplete;

      expect(cell.shadowRoot?.textContent).toContain('999.00');
      // Identical layout object: the tick never reached the engine.
      expect(grid.api.getLayout()).toBe(layoutBefore);
    });

    it('repaints a repeated row in every instance that shows it', async () => {
      // The layouts.md requirement. A parent with more children than fit is
      // repeated atop the continuation; both copies share a rowId and therefore a
      // signal, so one update must reach both.
      const parent: Quote = { id: 'p', instrument: 'GROUP', price: 0 };
      const children = Array.from({ length: 14 }, (_, i) => ({
        id: `c${i}`,
        instrument: `CHILD${i}`,
        price: i,
      }));

      const repeatModule: GridModule<Quote> = {
        id: 'repeat-parent',
        init: (ctx) =>
          ctx.addStage({
            id: 'repeat-parent',
            phase: 'expand',
            run: (rows) => {
              const head = rows[0];
              if (!head) return rows;
              return rows.map((row, index) =>
                index === 0 ? row : { ...row, repeatOnBreak: [head] },
              );
            },
          }),
      };

      const grid = await mount({ modules: [repeatModule] }, [parent, ...children]);

      const copies = [...instances(grid)].flatMap((instance) =>
        [...instance.shadowRoot!.querySelectorAll('ls-grid-row')].filter(
          (row) => (row as { row?: { rowId?: string } }).row?.rowId === 'p',
        ),
      );
      expect(copies.length).toBe(2);

      grid.api.applyTransaction({ update: [{ id: 'p', instrument: 'RENAMED', price: 0 }] });
      await Promise.all(
        copies.flatMap((row) =>
          [...row.shadowRoot!.querySelectorAll('ls-grid-cell')].map((cell) => cell.updateComplete),
        ),
      );

      for (const copy of copies) {
        expect(rowText(copy)).toContain('RENAMED');
      }
    });
  });

  describe('modules', () => {
    it('lets a module contribute a column', async () => {
      const module: GridModule<Quote> = {
        id: 'checkbox',
        provideColumns: () => [{ colId: 'select', headerName: '', width: 40 }],
      };

      const grid = await mount({ modules: [module] });

      expect(instances(grid)[0]!.shadowRoot!.querySelectorAll('ls-grid-header-cell')).toHaveLength(
        3,
      );
    });

    it('lets a module decorate a cell without owning it', async () => {
      const module: GridModule<Quote> = {
        id: 'decorator',
        cellDecorator: ({ column }) =>
          column.field === 'price' ? { classes: ['numeric'], prefix: html`<i>*</i>` } : null,
      };

      const grid = await mount({ modules: [module] });
      const cell = instances(grid)[0]!
        .shadowRoot!.querySelector('ls-grid-row')!
        .shadowRoot!.querySelectorAll('ls-grid-cell')[1]!;

      expect(cell.classList.contains('numeric')).toBe(true);
      expect(cell.shadowRoot?.textContent).toContain('*');
      // The cell still renders its own value: the module bracketed it, not replaced it.
      expect(cell.shadowRoot?.textContent).toContain('100.00');
    });

    it('repaints a header when module state changes', async () => {
      // Module state lives in plain fields, not signals. Without the registry
      // version a sort indicator would render once and then never update — the
      // grid would re-sort while its header still claimed nothing was sorted.
      let flag = false;
      const module: GridModule<Quote> = {
        id: 'toggler',
        headerDecorator: () => ({ attributes: { 'data-flag': String(flag) } }),
        init: (ctx) => {
          toggle = () => {
            flag = !flag;
            ctx.requestRender();
          };
        },
      };
      let toggle = (): void => {};

      const grid = await mount({ modules: [module] });
      const header = instances(grid)[0]!.shadowRoot!.querySelector('ls-grid-header-cell')!;
      expect(header.getAttribute('data-flag')).toBe('false');

      toggle();
      await header.updateComplete;

      expect(header.getAttribute('data-flag')).toBe('true');
    });

    it('merges a module method onto the api', async () => {
      const module: GridModule<Quote> = {
        id: 'counter',
        apiExtension: () => ({ countRows: () => 42 }),
      };

      const grid = await mount({ modules: [module] });

      expect((grid.api as unknown as { countRows(): number }).countRows()).toBe(42);
    });
  });

  describe('api and events', () => {
    it('fires ls-grid-ready with the api', async () => {
      const listener = vi.fn();
      host = document.createElement('div');
      host.style.cssText = 'width:700px;height:360px';
      document.body.append(host);

      const grid = document.createElement('ls-grid') as Grid<Quote>;
      grid.addEventListener('ls-grid-ready', listener);
      grid.gridOptions = { columns };
      host.append(grid);
      await grid.updateComplete;

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0]![0].detail.api).toBe(grid.api);
    });

    it('adds rows through the api and reflows', async () => {
      const grid = await mount({}, quotes(20));
      expect(slots(grid)).toHaveLength(2);

      grid.api.applyTransaction({ add: [{ id: 'new', instrument: 'NEW', price: 1 }] });
      await grid.updateComplete;

      expect(slots(grid)).toHaveLength(3);
    });

    it('scrolls the instance holding a row into view', async () => {
      const grid = await mount({}, quotes(400));
      const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;

      grid.api.scrollToRow('q200');

      expect(scroller.scrollLeft).toBeGreaterThan(0);
    });
  });
});

/** A renderer that reads its value from context rather than from props. */
@customElement('test-price-tag')
export class TestPriceTag extends CellRendererElement<Quote, number> {
  override render(): unknown {
    return this.value === undefined ? nothing : html`<span>${this.value}</span>`;
  }
}
