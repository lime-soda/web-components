import { afterEach, describe, expect, it, vi } from 'vitest';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../index.js';
import '../define.js';
import { CellRendererElement } from './cell-renderer-element.js';
import type { FlowGrid } from './grid.js';
import type { GridModule } from '../modules/types.js';
import type { ColumnDef } from '../columns/types.js';
import type { GridOptions } from '../controller/grid-controller.js';
import { KeyboardModule } from '../modules/keyboard/keyboard-module.js';

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
): Promise<FlowGrid<Quote>> {
  host = document.createElement('div');
  host.style.cssText = `width:${width}px;height:${height}px`;
  document.body.append(host);

  const grid = document.createElement('flow-grid') as FlowGrid<Quote>;
  grid.gridOptions = { columns, rowHeight: 32, headerHeight: 40, instanceGap: 16, ...options };
  grid.rowData = rows;
  host.append(grid);

  await grid.updateComplete;
  // Settled means an instance has actually mounted, not merely that the layout
  // produced slots — an empty grid would otherwise let tests pass vacuously.
  await waitFor(() => grid.shadowRoot?.querySelector('flow-instance') !== null, {
    description: 'the first instance to mount',
  });
  await grid.updateComplete;
  return grid;
}

const slots = (grid: FlowGrid<Quote>) =>
  [...(grid.shadowRoot?.querySelectorAll('.instance-slot') ?? [])] as HTMLElement[];

const instances = (grid: FlowGrid<Quote>) =>
  grid.shadowRoot?.querySelectorAll('flow-instance') ?? [];

const cellsOf = (grid: FlowGrid<Quote>) =>
  [...instances(grid)].flatMap((instance) => [
    ...(instance.shadowRoot?.querySelectorAll('flow-row') ?? []),
  ]);

/**
 * A row's visible text. Each cell keeps its content in its own shadow root, so
 * reading `row.shadowRoot.textContent` returns nothing — the cells have no light
 * DOM. This walks one level further down.
 */
const rowText = (row: Element): string =>
  [...(row.shadowRoot?.querySelectorAll('flow-cell') ?? [])]
    .map((cell) => cell.shadowRoot?.textContent ?? '')
    .join(' ');

/**
 * Every cell in the grid. Cells live inside flow-row's shadow root, not
 * flow-instance's, so a single querySelectorAll from the instance finds none.
 */
const allCells = (grid: FlowGrid<Quote>) =>
  [...instances(grid)].flatMap((instance) =>
    [...instance.shadowRoot!.querySelectorAll('flow-row')].flatMap((row) => [
      ...row.shadowRoot!.querySelectorAll('flow-cell'),
    ]),
  );

const firstRow = (grid: FlowGrid<Quote>): Element =>
  instances(grid)[0]!.shadowRoot!.querySelector('flow-row')!;

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('<flow-grid>', () => {
  describe('layout', () => {
    it('lays rows into instances sized to the measured container', async () => {
      // 360px tall, 40px header, 32px rows: 10 rows per instance, 25 rows -> 3.
      const grid = await mount();

      expect(slots(grid)).toHaveLength(3);
    });

    it('reflows when the container is resized', async () => {
      const grid = await mount();
      expect(slots(grid)).toHaveLength(3);

      host!.style.height = '680px';
      await waitFor(() => slots(grid).length === 2, { description: 'the reflow to 2 instances' });

      expect(slots(grid)).toHaveLength(2);
    });

    it('gives every instance its own header, so far-right columns stay readable', async () => {
      const grid = await mount();
      const mounted = [...instances(grid)];

      // Asserted, because iterating an empty list would pass regardless.
      expect(mounted.length).toBeGreaterThan(0);
      for (const instance of mounted) {
        expect(instance.shadowRoot?.querySelectorAll('flow-header-cell')).toHaveLength(2);
      }
    });

    it('aligns cells to the column widths declared on the definitions', async () => {
      const grid = await mount();
      const gridEl = instances(grid)[0]!.shadowRoot!.querySelector('.grid') as HTMLElement;

      expect(getComputedStyle(gridEl).gridTemplateColumns).toBe('200px 100px');
    });
  });

  describe('virtualisation', () => {
    it('renders only the instances near the viewport', async () => {
      // 700px wide holds two 300px instances; the rest sit beyond the prefetch
      // margin and must stay as placeholders.
      const grid = await mount({}, quotes(400));

      expect(slots(grid).length).toBeGreaterThan(10);
      expect(instances(grid).length).toBeLessThan(slots(grid).length);
    });

    it('keeps a correctly sized placeholder for offscreen instances so the scrollbar is stable', async () => {
      const grid = await mount({}, quotes(400));
      const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
      const widthBefore = scroller.scrollWidth;

      const mountedBefore = [...instances(grid)].map((i) => i.parentElement);
      scroller.scrollLeft = 2000;
      await waitFor(
        () => [...instances(grid)].some((i) => !mountedBefore.includes(i.parentElement)),
        { description: 'the observer to mount a new instance after scrolling' },
      );

      expect(scroller.scrollWidth).toBe(widthBefore);
    });

    it('mounts instances that scroll into view', async () => {
      const grid = await mount({}, quotes(400));
      const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
      const firstId = slots(grid)[0]!.dataset['instanceId'];

      const mountedIds = () =>
        [...instances(grid)].map((i) => (i.parentElement as HTMLElement).dataset['instanceId']);

      scroller.scrollLeft = 4000;
      await waitFor(() => mountedIds().length > 0 && !mountedIds().includes(firstId), {
        description: 'the first instance to unmount after scrolling away',
      });

      const mounted = mountedIds();
      expect(mounted).not.toContain(firstId);
      expect(mounted.length).toBeGreaterThan(0);
    });
  });

  describe('rendering values', () => {
    it('renders the formatted value', async () => {
      const grid = await mount();
      const cell = instances(grid)[0]!
        .shadowRoot!.querySelector('flow-row')!
        .shadowRoot!.querySelectorAll('flow-cell')[1]!;

      expect(cell.shadowRoot?.textContent).toContain('100.00');
    });

    it('renders a custom element cell renderer and gives it the value from context', async () => {
      const grid = await mount({
        columns: [{ field: 'price', width: 120, cellRenderer: 'test-price-tag' }],
      });

      // The renderer lives inside the cell's shadow root, not the row's.
      const renderer = firstRow(grid)
        .shadowRoot!.querySelector('flow-cell')!
        .shadowRoot!.querySelector('test-price-tag');

      expect(renderer?.shadowRoot?.textContent).toContain('100');
    });
  });

  describe('a price tick', () => {
    it('repaints the cell without re-running the layout', async () => {
      const grid = await mount();
      const layoutBefore = grid.api.getLayout();
      const cell = firstRow(grid).shadowRoot!.querySelectorAll('flow-cell')[1]!;

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
        [...instance.shadowRoot!.querySelectorAll('flow-row')].filter(
          (row) => (row as { row?: { rowId?: string } }).row?.rowId === 'p',
        ),
      );
      expect(copies.length).toBe(2);

      grid.api.applyTransaction({ update: [{ id: 'p', instrument: 'RENAMED', price: 0 }] });
      await Promise.all(
        copies.flatMap((row) =>
          [...row.shadowRoot!.querySelectorAll('flow-cell')].map((cell) => cell.updateComplete),
        ),
      );

      for (const copy of copies) {
        expect(rowText(copy)).toContain('RENAMED');
      }
    });
  });

  describe('core without modules', () => {
    it('renders a working grid with nothing installed', async () => {
      const grid = await mount();

      expect(instances(grid).length).toBeGreaterThan(0);
      expect(cellsOf(grid).length).toBeGreaterThan(0);
    });

    it('renders no expander, no checkbox and no sort affordance', async () => {
      const grid = await mount();
      const instance = instances(grid)[0]!;

      expect(instance.shadowRoot?.querySelector('button')).toBeNull();
      expect(instance.shadowRoot?.querySelector('input')).toBeNull();
      expect(instance.shadowRoot?.querySelector('[part="header-slots"]')).toBeNull();
    });
  });

  describe('modules', () => {
    it('lets a module contribute a column', async () => {
      const module: GridModule<Quote> = {
        id: 'checkbox',
        provideColumns: () => [{ colId: 'select', headerName: '', width: 40 }],
      };

      const grid = await mount({ modules: [module] });

      expect(instances(grid)[0]!.shadowRoot!.querySelectorAll('flow-header-cell')).toHaveLength(3);
    });

    it('lets a module decorate a cell without owning it', async () => {
      const module: GridModule<Quote> = {
        id: 'decorator',
        cellDecorator: ({ column }) =>
          column.field === 'price' ? { classes: ['numeric'], prefix: html`<i>*</i>` } : null,
      };

      const grid = await mount({ modules: [module] });
      const cell = instances(grid)[0]!
        .shadowRoot!.querySelector('flow-row')!
        .shadowRoot!.querySelectorAll('flow-cell')[1]!;

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
      const header = instances(grid)[0]!.shadowRoot!.querySelector('flow-header-cell')!;
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

  describe('keyboard navigation', () => {
    it('gives the focused cell DOM focus and a roving tabindex', async () => {
      const grid = await mount({ modules: [new KeyboardModule<Quote>()] });
      const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;

      scroller.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
      );
      await grid.updateComplete;
      await Promise.all(allCells(grid).map((cell) => cell.updateComplete));

      // Exactly one cell is tabbable, and it holds real focus.
      const tabbable = allCells(grid).filter((cell) => cell.tabIndex === 0);
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]!.matches(':focus')).toBe(true);
    });

    it('moves focus across instances, following the layout rather than the DOM order', async () => {
      const grid = await mount({ modules: [new KeyboardModule<Quote>()] });
      const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
      const send = (key: string, init: KeyboardEventInit = {}) =>
        scroller.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, composed: true, ...init }),
        );

      send('ArrowDown');
      send('ArrowRight', { ctrlKey: true });
      await grid.updateComplete;

      expect(grid.controller!.focus.focused.get()?.instanceId).toBe('instance-1');
    });

    it('does nothing without the keyboard module', async () => {
      const grid = await mount();
      const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;

      scroller.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }),
      );
      await grid.updateComplete;

      expect(grid.controller!.focus.focused.get()).toBeNull();
    });
  });

  describe('api and events', () => {
    it('fires flow-grid-ready with the api', async () => {
      const listener = vi.fn();
      host = document.createElement('div');
      host.style.cssText = 'width:700px;height:360px';
      document.body.append(host);

      const grid = document.createElement('flow-grid') as FlowGrid<Quote>;
      grid.addEventListener('flow-grid-ready', listener);
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
