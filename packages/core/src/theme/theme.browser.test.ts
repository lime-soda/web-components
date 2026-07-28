import { afterEach, describe, expect, it } from 'vitest';
import '../index.js';
import type { ColumnDef } from '../columns/types.js';
import type { GridOptions } from '../controller/grid-controller.js';
import type { FlowGrid } from '../components/grid.js';
import { TreeModule } from '../modules/tree/index.js';
import { SortModule } from '../modules/sort/index.js';
import { SelectionModule } from '../modules/selection/index.js';
import type { GridTheme } from './tokens.js';

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

/**
 * Proves the theme reaches rendered pixels.
 *
 * Token-level tests confirm the mapping; these confirm that the resulting
 * custom properties actually inherit through every shadow root and win over the
 * component defaults, including for markup a module contributed.
 */

interface Row {
  id: string;
  parentId: string | null;
  name: string;
  price: number;
}

const columns: ColumnDef<Row>[] = [
  { field: 'name', width: 200 },
  { field: 'price', width: 100 },
];

const data: Row[] = [
  { id: 'g', parentId: null, name: 'Group', price: 0 },
  { id: 'g-a', parentId: 'g', name: 'A', price: 1 },
  { id: 'g-b', parentId: 'g', name: 'B', price: 2 },
];

let host: HTMLDivElement | undefined;

async function mount(overrides: Partial<GridOptions<Row>> = {}): Promise<FlowGrid<Row>> {
  host = document.createElement('div');
  host.style.cssText = 'width:800px;height:400px';
  document.body.append(host);

  const grid = document.createElement('flow-grid') as FlowGrid<Row>;
  grid.gridOptions = {
    columns,
    rowHeight: 32,
    headerHeight: 32,
    modules: [
      new TreeModule<Row>({ getParentId: (d) => d.parentId, defaultExpanded: true }),
      new SortModule<Row>(),
      new SelectionModule<Row>({ mode: 'multi' }),
    ],
    ...overrides,
  };
  grid.rowData = data;
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

const instance = (grid: FlowGrid<Row>) => grid.shadowRoot!.querySelector('flow-instance')!;
const rows = (grid: FlowGrid<Row>) => [...instance(grid).shadowRoot!.querySelectorAll('flow-row')];
const cellsOf = (row: Element) => [...row.shadowRoot!.querySelectorAll('flow-cell')];

/**
 * A cell by column id rather than position. The selection module prepends its
 * checkbox column, so an index would depend on which modules are installed.
 */
const cellFor = (row: Element, colId: string) =>
  cellsOf(row).find(
    (cell) => (cell as unknown as { column?: { colId: string } }).column?.colId === colId,
  )!;

const headerFor = (grid: FlowGrid<Row>, colId: string) =>
  [...instance(grid).shadowRoot!.querySelectorAll('flow-header-cell')].find(
    (header) => (header as unknown as { column?: { colId: string } }).column?.colId === colId,
  )!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('theming', () => {
  it('applies theme tokens as custom properties on the grid', async () => {
    const theme: GridTheme = { text: 'rgb(0, 128, 0)', background: 'rgb(240, 240, 240)' };
    const grid = await mount({ theme });
    const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;

    expect(scroller.style.getPropertyValue('--flow-text')).toBe('rgb(0, 128, 0)');
    expect(scroller.style.getPropertyValue('--flow-background')).toBe('rgb(240, 240, 240)');
  });

  it('inherits a token through every shadow root down to a cell', async () => {
    const grid = await mount({ theme: { text: 'rgb(0, 128, 0)' } });

    expect(getComputedStyle(cellFor(rows(grid)[1]!, 'name')).color).toBe('rgb(0, 128, 0)');
  });

  it('themes a header through the same tokens', async () => {
    const grid = await mount({ theme: { headerText: 'rgb(128, 0, 0)' } });
    const header = instance(grid).shadowRoot!.querySelector('flow-header-cell')!;

    expect(getComputedStyle(header).color).toBe('rgb(128, 0, 0)');
  });

  it('themes markup a module contributed', async () => {
    // The expander lives in the tree module's stylesheet, adopted into the
    // cell's shadow root — it must still answer to the grid's tokens.
    const grid = await mount({ theme: { textMuted: 'rgb(0, 0, 255)' } });
    const expander = cellFor(rows(grid)[0]!, 'name').shadowRoot!.querySelector(
      '[part="tree-expander"]',
    )!;

    expect(getComputedStyle(expander).color).toBe('rgb(0, 0, 255)');
  });

  it('drives tree indent from a token rather than a computed pixel value', async () => {
    const grid = await mount({ theme: { treeIndent: '40px' } });
    const childIndent = cellFor(rows(grid)[1]!, 'name').shadowRoot!.querySelector(
      '.flow-tree-indent',
    )!;

    // Depth 1 at 40px per level.
    expect(getComputedStyle(childIndent).width).toBe('40px');
  });

  it('themes the selection highlight', async () => {
    const grid = await mount({ theme: { selectionBackground: 'rgb(255, 0, 0)' } });
    grid.api.setRowSelected('g-a', true);
    await settle();

    expect(getComputedStyle(cellFor(rows(grid)[1]!, 'name')).backgroundColor).toBe(
      'rgb(255, 0, 0)',
    );
  });

  it('falls back to the component default for an unset token', async () => {
    const grid = await mount({ theme: { text: 'rgb(0, 128, 0)' } });
    const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;

    // A partial theme is valid; unset tokens simply are not declared.
    expect(scroller.style.getPropertyValue('--flow-border')).toBe('');
  });

  it('updates live when the theme is replaced', async () => {
    const grid = await mount({ theme: { text: 'rgb(0, 128, 0)' } });

    grid.gridOptions = { ...grid.gridOptions!, theme: { text: 'rgb(255, 0, 255)' } };
    await grid.updateComplete;
    await settle();

    expect(getComputedStyle(cellFor(rows(grid)[1]!, 'name')).color).toBe('rgb(255, 0, 255)');
  });

  it('rejects an unknown token rather than dropping it silently', async () => {
    await expect(mount({ theme: { rowHeght: '28px' } as GridTheme })).rejects.toThrow(/rowHeght/);
  });

  it('keeps row height under the layout engine, not the theme', async () => {
    // The engine decided instance capacity from rowHeight; CSS must lay rows out
    // at exactly that height or every instance silently overflows.
    const grid = await mount({ rowHeight: 32, theme: { rowHeight: '999px' } });
    const scroller = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;

    expect(scroller.style.getPropertyValue('--flow-row-height')).toBe('32px');
  });

  describe('no inline styles', () => {
    it('leaves cells with no style attribute of their own', async () => {
      const grid = await mount();

      for (const row of rows(grid)) {
        for (const cell of cellsOf(row)) {
          const style = cell.getAttribute('style') ?? '';
          // Only custom properties are permitted, and only from decorations.
          const declarations = style.split(';').filter((d) => d.trim() !== '');
          for (const declaration of declarations) {
            expect(declaration.trim().startsWith('--'), `unexpected: ${declaration}`).toBe(true);
          }
        }
      }
    });

    it('leaves module-contributed markup with no style attribute', async () => {
      const grid = await mount();
      const treeCell = cellFor(rows(grid)[0]!, 'name');

      for (const element of treeCell.shadowRoot!.querySelectorAll('*')) {
        expect(element.getAttribute('style'), element.tagName).toBeNull();
      }
    });

    it('styles the sort indicator by class, not inline', async () => {
      const grid = await mount();
      grid.api.setSortModel([{ colId: 'price', direction: 'asc' }]);
      await settle();

      const indicator = headerFor(grid, 'price').shadowRoot!.querySelector(
        '[part="sort-indicator"]',
      )!;

      expect(indicator.getAttribute('style')).toBeNull();
      expect(indicator.classList.contains('flow-sort-indicator')).toBe(true);
    });

    it('styles the selection checkbox by class, not inline', async () => {
      const grid = await mount();
      const checkbox = cellFor(rows(grid)[0]!, 'flow-selection').shadowRoot!.querySelector(
        'flow-selection-checkbox',
      )!;
      const input = checkbox.shadowRoot!.querySelector('input')!;

      expect(input.getAttribute('style')).toBeNull();
      expect(input.classList.contains('flow-checkbox')).toBe(true);
    });
  });
});
