import { afterEach, describe, expect, it } from 'vite-plus/test';
import '../layouts.js';
import { SelectionModule } from '../modules/selection/index.js';
import { KeyboardModule } from '../modules/keyboard/index.js';
import type { Grid } from './grid.js';
import type { GridOptions } from '../controller/grid-controller.js';

/**
 * Reaching a cell with the mouse, and acting on it with the keyboard.
 *
 * Both were broken in ways the unit tests could not see: the focus ring was
 * `:focus-visible`, which by design never matches a mouse click, so a clicked
 * cell was genuinely focused and looked exactly like an unfocused one; and a
 * focused cell had no way to select its row, because focus sits on the cell
 * rather than on the checkbox inside it.
 */

interface Row {
  id: string;
  name: string;
  price: number;
}

const data: Row[] = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  price: i,
}));

let host: HTMLDivElement | undefined;

async function waitFor(condition: () => boolean, timeout = 2000): Promise<void> {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout) throw new Error('timed out');
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

async function mount(selection: { checkboxColumn?: boolean } = {}): Promise<Grid<Row>> {
  host = document.createElement('div');
  host.style.height = '400px';
  host.style.width = '600px';
  document.body.append(host);

  const grid = document.createElement('ls-grid') as Grid<Row>;
  grid.style.height = '100%';
  grid.gridOptions = {
    columns: [
      { field: 'name', width: 200 },
      { field: 'price', width: 100 },
    ],
    getRowId: (row) => row.id,
    modules: [new SelectionModule<Row>({ mode: 'multi', ...selection }), new KeyboardModule<Row>()],
  } satisfies GridOptions<Row>;
  grid.rowData = data;
  host.append(grid);

  await waitFor(() => cells(grid).length > 0);
  return grid;
}

const cells = (grid: Grid<Row>): HTMLElement[] => {
  const instance = grid.shadowRoot?.querySelector('ls-grid-instance');
  const rows = [...(instance?.shadowRoot?.querySelectorAll('ls-grid-row') ?? [])];
  return rows.flatMap((row) => [
    ...((row as HTMLElement).shadowRoot?.querySelectorAll('ls-grid-cell') ?? []),
  ]) as HTMLElement[];
};

afterEach(() => {
  host?.remove();
  host = undefined;
});

describe('focusing a cell with the mouse', () => {
  it('tells the grid where focus is', async () => {
    const grid = await mount();
    const cell = cells(grid)[5]!;

    cell.focus();
    await waitFor(() => grid.controller!.focus.focused.get() !== null);

    expect(grid.controller!.focus.focused.get()).not.toBeNull();
  });

  it('shows a focus ring, which :focus-visible would not have done', async () => {
    // The regression this file exists for. A mouse click focuses the cell but
    // never matches :focus-visible, so the ring has to come from the grid's own
    // focus state instead.
    const grid = await mount();
    const cell = cells(grid)[5]!;

    cell.focus();
    await waitFor(() => cell.hasAttribute('data-focused'));

    expect(getComputedStyle(cell).outlineStyle).toBe('solid');
    expect(getComputedStyle(cell).outlineWidth).not.toBe('0px');
  });

  it('moves the ring off the cell that had it', async () => {
    const grid = await mount();
    const [first, , third] = cells(grid);

    first!.focus();
    await waitFor(() => first!.hasAttribute('data-focused'));
    third!.focus();
    await waitFor(() => third!.hasAttribute('data-focused'));

    expect(first!.hasAttribute('data-focused')).toBe(false);
  });
});

describe('selecting from the keyboard', () => {
  /**
   * Space and Enter belong to the checkbox cell when the grid has one: the
   * checkbox is the thing being operated, and a key that selected from anywhere
   * would fight whatever a value cell wants Enter for.
   */
  const press = (grid: Grid<Row>, key: string) => {
    const target = cells(grid).find((cell) => cell.hasAttribute('data-focused')) ?? grid;
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };

  /** Focuses the checkbox cell of the second row. */
  const focusCheckbox = async (grid: Grid<Row>) => {
    const checkbox = cells(grid).find(
      (cell) =>
        (cell as unknown as { column?: { colId: string } }).column?.colId === 'ls-grid-selection',
    )!;
    checkbox.focus();
    await waitFor(() => grid.controller!.focus.focused.get() !== null);
  };

  it('selects the focused row from the checkbox cell with Space', async () => {
    const grid = await mount();
    await focusCheckbox(grid);

    press(grid, ' ');

    expect(grid.api.getSelectedCount()).toBe(1);
  });

  it('selects with Enter too', async () => {
    const grid = await mount();
    await focusCheckbox(grid);

    press(grid, 'Enter');

    expect(grid.api.getSelectedCount()).toBe(1);
  });

  it('toggles, so a second press deselects', async () => {
    const grid = await mount();
    await focusCheckbox(grid);

    press(grid, ' ');
    press(grid, ' ');

    expect(grid.api.getSelectedCount()).toBe(0);
  });

  it('stops Space scrolling the page', async () => {
    const grid = await mount();
    await focusCheckbox(grid);

    const event = press(grid, ' ');

    expect(event.defaultPrevented).toBe(true);
  });

  it('does nothing from a value cell while the checkbox column exists', async () => {
    const grid = await mount();
    const valueCell = cells(grid)[5]!;
    valueCell.focus();
    await waitFor(() => grid.controller!.focus.focused.get() !== null);

    press(grid, ' ');

    expect(grid.api.getSelectedCount()).toBe(0);
  });

  it('answers from any cell when there is no checkbox column', async () => {
    // Nothing to aim at, so refusing would leave the grid unselectable by
    // keyboard entirely.
    const grid = await mount({ checkboxColumn: false });
    cells(grid)[2]!.focus();
    await waitFor(() => grid.controller!.focus.focused.get() !== null);

    press(grid, ' ');

    expect(grid.api.getSelectedCount()).toBe(1);
  });

  it('does nothing when no cell is focused', async () => {
    const grid = await mount();

    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    grid.dispatchEvent(event);

    expect(grid.api.getSelectedCount()).toBe(0);
  });
});

describe('when focus leaves the grid', () => {
  /**
   * The position is remembered so Tab returns to the cell it left. That is not
   * the same as the grid being focused, and painting a ring on a remembered
   * position claims focus that something else holds.
   */
  const elsewhere = () => {
    const button = document.createElement('button');
    button.textContent = 'outside';
    document.body.append(button);
    return button;
  };

  it('stops painting the ring', async () => {
    const grid = await mount();
    const cell = cells(grid)[5]!;
    cell.focus();
    await waitFor(() => cell.hasAttribute('data-focused'));

    const outside = elsewhere();
    outside.focus();
    await waitFor(() => !cell.hasAttribute('data-focused'));

    expect(cell.hasAttribute('data-focused')).toBe(false);
    outside.remove();
  });

  it('remembers where it was, so Tab comes back to the same cell', async () => {
    const grid = await mount();
    const cell = cells(grid)[5]!;
    cell.focus();
    await waitFor(() => grid.controller!.focus.focused.get() !== null);
    const position = grid.controller!.focus.focused.get();

    const outside = elsewhere();
    outside.focus();
    await waitFor(() => !cell.hasAttribute('data-focused'));

    expect(grid.controller!.focus.focused.get()).toEqual(position);
    expect(cell.tabIndex).toBe(0);
    outside.remove();
  });

  it('paints again when focus returns', async () => {
    const grid = await mount();
    const cell = cells(grid)[5]!;
    cell.focus();
    await waitFor(() => cell.hasAttribute('data-focused'));

    const outside = elsewhere();
    outside.focus();
    await waitFor(() => !cell.hasAttribute('data-focused'));

    cell.focus();
    await waitFor(() => cell.hasAttribute('data-focused'));

    expect(cell.hasAttribute('data-focused')).toBe(true);
    outside.remove();
  });

  it('keeps the ring while focus moves between cells', async () => {
    // Moving within the grid fires focusout too; only leaving counts.
    const grid = await mount();
    const [first, , third] = cells(grid);

    first!.focus();
    await waitFor(() => first!.hasAttribute('data-focused'));
    third!.focus();
    await waitFor(() => third!.hasAttribute('data-focused'));

    expect(third!.hasAttribute('data-focused')).toBe(true);
  });
});
